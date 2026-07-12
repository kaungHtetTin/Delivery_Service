<?php

namespace App\Services;

use App\Models\CashCollection;
use App\Models\CommissionRule;
use App\Models\DeliveryOrder;
use App\Models\FinanceCategory;
use App\Models\FinanceTransaction;
use App\Models\Rider;
use App\Models\User;
use App\Notifications\OrderActivityNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RiderOrderWorkflow
{
    public function progress(DeliveryOrder $order, Rider $rider, User $user, array $attributes): DeliveryOrder
    {
        $order->loadMissing(['rider', 'cashCollection']);

        if ((int) $order->rider_id !== (int) $rider->id || (int) $rider->user_id !== (int) $user->id) {
            abort(403, 'You can only update orders assigned to your rider account.');
        }

        $status = $attributes['status'];

        if (! $order->canTransitionTo($status)) {
            throw ValidationException::withMessages([
                'status' => "Cannot move delivery from {$order->status} to {$status}.",
            ]);
        }

        DB::transaction(function () use ($order, $rider, $user, $attributes, $status) {
            $existingCollection = $order->cashCollection()->first();
            $timestamps = match ($status) {
                'picked_up' => ['picked_up_at' => now()],
                'delivered' => ['delivered_at' => now()],
                'completed' => ['completed_at' => now()],
                default => [],
            };
            $updates = ['status' => $status] + $timestamps;

            if ($status === 'picked_up') {
                $updates['receiver_name'] = $attributes['receiver_name'] ?? '';
                $updates['receiver_phone'] = $attributes['receiver_phone'];
                $updates['receiver_address'] = $attributes['receiver_address'];
                $updates['product_payment_method'] = $attributes['product_payment_method'] ?? 'already_paid';
                $updates['cod_amount'] = $updates['product_payment_method'] === 'rider_collects'
                    ? ($attributes['cod_amount'] ?? 0)
                    : 0;
            }

            if ($status === 'completed') {
                $updates['delivery_fee'] = (float) $attributes['delivery_fee'];
                $updates['delivery_fee_payment_method'] = 'cash';
                $updates['payment_status'] = 'paid';
            }

            $order->update($updates);
            $order->statusHistories()->create([
                'status' => $status,
                'actor_type' => User::ROLE_RIDER,
                'actor_id' => $user->id,
                'note' => $attributes['note'] ?? null,
            ]);

            if ($status === 'completed' && ! $existingCollection && (float) $attributes['delivery_fee'] > 0) {
                $deliveryFee = (float) $attributes['delivery_fee'];

                CashCollection::create([
                    'delivery_order_id' => $order->id,
                    'rider_id' => $rider->id,
                    'product_cash_collected' => 0,
                    'delivery_fee_collected' => $deliveryFee,
                    'total_cash_collected' => $deliveryFee,
                ]);

                $rider->increment('cash_held', $deliveryFee);
            }

            $this->notifyClient(
                $order,
                'status_updated',
                'Delivery status updated',
                "{$order->code} is now {$this->statusLabel($status)}.",
                ['status' => $status]
            );
            $this->notifyOffice(
                $order,
                'status_updated',
                'Delivery status updated',
                "{$order->code} is now {$this->statusLabel($status)}.",
                ['status' => $status]
            );

            if (in_array($status, ['completed', 'failed', 'cancelled'], true)) {
                $this->releaseRiderWhenIdle($rider, $order->id);
            }

            if ($status === 'completed') {
                $this->deleteCompletedOrderNotifications($order);
                $this->createOrUpdateCommissionExpense($order, $user->id);
            }
        });

        $freshOrder = $order->fresh()->load([
            'rider.latestLocation',
            'customer',
            'shop',
            'clientUser',
            'statusHistories',
            'payments',
            'cashCollection',
        ]);

        app(RealtimeSocketPublisher::class)->orderStatusUpdated($freshOrder);

        return $freshOrder;
    }

    private function notifyClient(DeliveryOrder $order, string $kind, string $title, string $body, array $meta = []): void
    {
        $order->loadMissing('clientUser');

        $order->clientUser?->notify(new OrderActivityNotification($order, $kind, $title, $body, $meta));
    }

    private function notifyOffice(DeliveryOrder $order, string $kind, string $title, string $body, array $meta = []): void
    {
        User::query()
            ->whereIn('role', [User::ROLE_OFFICE_ADMIN, User::ROLE_SUPER_ADMIN])
            ->get()
            ->each(fn (User $user) => $user->notify(new OrderActivityNotification($order, $kind, $title, $body, $meta)));
    }

    private function releaseRiderWhenIdle(Rider $rider, int $exceptOrderId): void
    {
        $hasOtherActiveOrders = $rider->deliveryOrders()
            ->whereKeyNot($exceptOrderId)
            ->whereNotIn('status', ['completed', 'failed', 'cancelled'])
            ->exists();

        if (! $hasOtherActiveOrders) {
            $rider->update(['status' => 'available']);
        }
    }

    private function createOrUpdateCommissionExpense(DeliveryOrder $order, ?int $actorId): void
    {
        $order->refresh();

        if (! $order->rider_id || $order->status !== 'completed') {
            return;
        }

        $rule = CommissionRule::activeForRider($order->rider_id);
        $amount = $rule ? $rule->calculate((float) $order->delivery_fee) : 0;
        $category = FinanceCategory::riderCommissionExpenseCategory($actorId);
        $query = FinanceTransaction::query()
            ->where('type', FinanceTransaction::TYPE_EXPENSE)
            ->where('category_id', $category->id)
            ->where('reference_type', DeliveryOrder::class)
            ->where('reference_id', $order->id);

        if ($amount <= 0) {
            $query->delete();
            return;
        }

        $query->updateOrCreate(
            [
                'type' => FinanceTransaction::TYPE_EXPENSE,
                'category_id' => $category->id,
                'reference_type' => DeliveryOrder::class,
                'reference_id' => $order->id,
            ],
            [
                'amount' => $amount,
                'payment_method' => 'cash',
                'transaction_date' => $order->completed_at?->toDateString() ?? today()->toDateString(),
                'description' => "Rider commission for {$order->code}" . ($rule ? " ({$rule->name})." : '.'),
                'rider_id' => $order->rider_id,
                'delivery_order_id' => $order->id,
                'customer_id' => $order->customer_id,
                'client_user_id' => $order->client_user_id,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]
        );
    }

    private function deleteCompletedOrderNotifications(DeliveryOrder $order): void
    {
        $order->loadMissing(['clientUser', 'rider.user']);

        collect([$order->clientUser, $order->rider?->user])
            ->filter()
            ->unique('id')
            ->each(function (User $user) use ($order) {
                $user->notifications()
                    ->where('data->order_id', $order->id)
                    ->delete();
            });
    }

    private function statusLabel(string $status): string
    {
        return str($status)->replace('_', ' ')->title()->toString();
    }
}
