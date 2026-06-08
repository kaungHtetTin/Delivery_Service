<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeliveryOrderRequest;
use App\Http\Requests\UpdateDeliveryOrderStatusRequest;
use App\Models\DeliveryOrder;
use App\Models\Rider;
use App\Models\User;
use App\Notifications\OrderActivityNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $orders = DeliveryOrder::query()
            ->with(['rider', 'payments'])
            ->when($request->user()?->role === User::ROLE_CLIENT, function ($query) use ($request) {
                $query->where('client_user_id', $request->user()->id);
            })
            ->when($request->user()?->role === User::ROLE_RIDER, function ($query) use ($request) {
                $query->whereHas('rider', fn ($query) => $query->where('user_id', $request->user()->id));
            })
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->when($request->string('payment_status')->toString(), fn ($query, $status) => $query->where('payment_status', $status))
            ->when($request->integer('rider_id'), fn ($query, $riderId) => $query->where('rider_id', $riderId))
            ->when($request->date('date_from'), fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($request->date('date_to'), fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query
                        ->where('code', 'like', "%{$search}%")
                        ->orWhere('client_phone', 'like', "%{$search}%")
                        ->orWhere('receiver_phone', 'like', "%{$search}%")
                        ->orWhere('receiver_name', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($orders);
    }

    public function store(StoreDeliveryOrderRequest $request): JsonResponse
    {
        $order = DB::transaction(function () use ($request) {
            $attributes = $request->validated();
            $attributes['client_user_id'] = $request->user()?->role === User::ROLE_CLIENT
                ? $request->user()->id
                : null;
            $attributes['payment_status'] = $attributes['delivery_fee_payment_method'] === 'mobile_banking'
                ? 'pending_approval'
                : 'unpaid';

            $order = DeliveryOrder::create($attributes);
            $order->statusHistories()->create(['status' => 'pending']);

            if ($order->delivery_fee_payment_method === 'mobile_banking') {
                $order->payments()->create([
                    'type' => 'delivery_fee',
                    'method' => 'mobile_banking',
                    'amount' => $order->delivery_fee,
                    'status' => 'pending_approval',
                ]);
            }

            $this->notifyClient(
                $order,
                'order_created',
                'Delivery request received',
                "Your request {$order->code} is waiting for office review."
            );

            return $order;
        });

        return response()->json($order->fresh()->load(['rider', 'statusHistories', 'payments']), 201);
    }

    public function show(DeliveryOrder $deliveryOrder): JsonResponse
    {
        return response()->json($deliveryOrder->load([
            'rider',
            'statusHistories',
            'payments',
            'cashCollection',
        ]));
    }

    public function assign(Request $request, DeliveryOrder $deliveryOrder): JsonResponse
    {
        $validated = $request->validate([
            'rider_id' => ['required', 'integer', 'exists:riders,id'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! in_array($deliveryOrder->status, ['pending', 'approved', 'rider_assigned'], true)) {
            throw ValidationException::withMessages([
                'order' => 'This delivery can no longer be assigned from its current status.',
            ]);
        }

        $rider = Rider::findOrFail($validated['rider_id']);

        if (! in_array($rider->status, ['available', 'online'], true)) {
            throw ValidationException::withMessages([
                'rider_id' => 'Select a rider who is currently available.',
            ]);
        }

        DB::transaction(function () use ($deliveryOrder, $rider, $validated) {
            $previousRiderId = $deliveryOrder->rider_id;
            $previousRider = $deliveryOrder->rider;

            if ($deliveryOrder->status === 'pending') {
                $deliveryOrder->update([
                    'status' => 'approved',
                    'approved_at' => now(),
                ]);
                $deliveryOrder->statusHistories()->create([
                    'status' => 'approved',
                    'actor_type' => 'office_admin',
                ]);
            }

            $deliveryOrder->update([
                'rider_id' => $rider->id,
                'status' => 'rider_assigned',
                'assigned_at' => now(),
            ]);
            $deliveryOrder->statusHistories()->create([
                'status' => 'rider_assigned',
                'actor_type' => 'office_admin',
                'note' => $validated['note'] ?? null,
                'metadata' => [
                    'previous_rider_id' => $previousRiderId,
                    'rider_id' => $rider->id,
                ],
            ]);

            $rider->update(['status' => 'busy']);

            $this->notifyClient(
                $deliveryOrder,
                'rider_assigned',
                'Rider assigned',
                "{$rider->name} has been assigned to {$deliveryOrder->code}.",
                ['rider_id' => $rider->id, 'rider_name' => $rider->name]
            );
            $this->notifyRider(
                $rider,
                $deliveryOrder,
                'new_assignment',
                'New delivery assignment',
                "Pickup is ready for {$deliveryOrder->code}."
            );

            if ($previousRider && $previousRider->isNot($rider)) {
                $this->releaseRiderWhenIdle($previousRider, $deliveryOrder->id);
            }
        });

        return response()->json($deliveryOrder->fresh()->load(['rider', 'statusHistories']));
    }

    public function updateStatus(
        UpdateDeliveryOrderStatusRequest $request,
        DeliveryOrder $deliveryOrder
    ): JsonResponse {
        $validated = $request->validated();
        $status = $validated['status'];

        if (! $deliveryOrder->canTransitionTo($status)) {
            throw ValidationException::withMessages([
                'status' => "Cannot move delivery from {$deliveryOrder->status} to {$status}.",
            ]);
        }

        DB::transaction(function () use ($deliveryOrder, $validated, $status) {
            $timestamps = match ($status) {
                'picked_up' => ['picked_up_at' => now()],
                'delivered' => ['delivered_at' => now()],
                'completed' => ['completed_at' => now()],
                default => [],
            };

            $deliveryOrder->update(['status' => $status] + $timestamps);
            $deliveryOrder->statusHistories()->create([
                'status' => $status,
                'actor_type' => $validated['actor_type'] ?? null,
                'actor_id' => $validated['actor_id'] ?? null,
                'note' => $validated['note'] ?? null,
            ]);

            $this->notifyClient(
                $deliveryOrder,
                'status_updated',
                'Delivery status updated',
                "{$deliveryOrder->code} is now {$this->statusLabel($status)}.",
                ['status' => $status]
            );

            if (in_array($status, ['completed', 'failed', 'cancelled'], true) && $deliveryOrder->rider) {
                $this->releaseRiderWhenIdle($deliveryOrder->rider, $deliveryOrder->id);
            }
        });

        return response()->json($deliveryOrder->fresh()->load(['rider', 'statusHistories']));
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

    private function notifyClient(DeliveryOrder $order, string $kind, string $title, string $body, array $meta = []): void
    {
        $order->loadMissing('clientUser');

        $order->clientUser?->notify(new OrderActivityNotification($order, $kind, $title, $body, $meta));
    }

    private function notifyRider(Rider $rider, DeliveryOrder $order, string $kind, string $title, string $body, array $meta = []): void
    {
        $rider->loadMissing('user');

        $rider->user?->notify(new OrderActivityNotification($order, $kind, $title, $body, $meta));
    }

    private function statusLabel(string $status): string
    {
        return str($status)->replace('_', ' ')->title()->toString();
    }
}
