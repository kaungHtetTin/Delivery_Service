<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeliveryOrderRequest;
use App\Http\Requests\UpdateDeliveryOrderStatusRequest;
use App\Models\AdminLog;
use App\Models\CashCollection;
use App\Models\Customer;
use App\Models\DeliveryOrder;
use App\Models\Rider;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\OrderActivityNotification;
use App\Services\RealtimeSocketPublisher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $orders = DeliveryOrder::query()
            ->with(['rider', 'payments', 'customer', 'shop', 'clientUser'])
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
                        ->orWhere('client_name', 'like', "%{$search}%")
                        ->orWhere('client_phone', 'like', "%{$search}%")
                        ->orWhere('receiver_phone', 'like', "%{$search}%")
                        ->orWhere('receiver_name', 'like', "%{$search}%")
                        ->orWhereHas('clientUser', function ($query) use ($search) {
                            $query
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%")
                                ->orWhere('phone', 'like', "%{$search}%");
                        });
                });
            })
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($orders);
    }

    public function store(StoreDeliveryOrderRequest $request): JsonResponse
    {
        $clientUser = $request->user() ?? Auth::guard('sanctum')->user();

        $order = DB::transaction(function () use ($request, $clientUser) {
            $attributes = $request->validated();
            $this->normalizeOptionalRequesterFields($attributes);
            $this->normalizeOptionalDestinationFields($attributes);
            $attributes['client_user_id'] = $clientUser?->role === User::ROLE_CLIENT
                ? $clientUser->id
                : null;

            if ($clientUser?->role === User::ROLE_CLIENT) {
                $customer = Customer::query()
                    ->where('user_id', $clientUser->id)
                    ->orWhere('phone', $attributes['client_phone'])
                    ->first();

                if (! $customer) {
                    $customer = Customer::create([
                        'user_id' => $clientUser->id,
                        'name' => $attributes['client_name'],
                        'phone' => $attributes['client_phone'],
                        'email' => $clientUser->email,
                        'type' => 'individual',
                    ]);
                } elseif (! $customer->user_id) {
                    $customer->update(['user_id' => $clientUser->id]);
                }

                $shop = Shop::firstOrCreate(
                    ['phone' => $attributes['pickup_phone']],
                    [
                        'customer_id' => $customer->id,
                        'name' => $attributes['pickup_contact_name'],
                        'contact_name' => $attributes['pickup_contact_name'],
                        'address' => $attributes['pickup_address'],
                        'status' => 'active',
                    ]
                );

                $attributes['customer_id'] ??= $customer->id;
                $attributes['shop_id'] ??= $shop->id;
            }

            $attributes['delivery_fee_payment_method'] = $attributes['delivery_fee_payment_method'] ?? 'cash';
            $attributes['delivery_fee'] = $attributes['delivery_fee'] ?? 0;
            $attributes['product_payment_method'] = $attributes['product_payment_method'] ?? 'already_paid';
            $attributes['cod_amount'] = $attributes['product_payment_method'] === 'rider_collects'
                ? ($attributes['cod_amount'] ?? 0)
                : 0;
            $attributes['payment_status'] = 'unpaid';

            $order = DeliveryOrder::create($attributes);
            $order->statusHistories()->create(['status' => 'pending']);

            $this->notifyClient(
                $order,
                'order_created',
                'Delivery request received',
                "Your request {$order->code} is waiting for office review."
            );

            return $order;
        });

        $freshOrder = $order->fresh()->load(['rider', 'clientUser', 'statusHistories', 'payments']);
        app(RealtimeSocketPublisher::class)->orderCreated($freshOrder);

        return response()->json($freshOrder, 201);
    }

    public function show(DeliveryOrder $deliveryOrder): JsonResponse
    {
        return response()->json($deliveryOrder->load([
            'rider',
            'customer',
            'shop',
            'clientUser',
            'statusHistories',
            'payments',
            'cashCollection',
        ]));
    }

    public function update(Request $request, DeliveryOrder $deliveryOrder): JsonResponse
    {
        $isClient = $request->user()?->role === User::ROLE_CLIENT;

        if ($isClient) {
            $this->authorizeClientPendingOrder($request, $deliveryOrder);
        }

        $validated = $request->validate($isClient
            ? $this->clientUpdateRules()
            : $this->officeUpdateRules()
        );

        $this->normalizeOptionalRequesterFields($validated, false);
        $this->normalizeOptionalDestinationFields($validated, false);

        if (array_key_exists('product_payment_method', $validated) && $validated['product_payment_method'] === 'already_paid') {
            $validated['cod_amount'] = 0;
        }

        $previous = $deliveryOrder->only(array_keys($validated));
        $previousStatus = $deliveryOrder->status;

        DB::transaction(function () use ($deliveryOrder, $validated, $previous, $previousStatus, $request) {
            $deliveryOrder->update($validated);

            if (array_key_exists('status', $validated) && $validated['status'] !== $previousStatus) {
                $deliveryOrder->statusHistories()->create([
                    'status' => $validated['status'],
                    'actor_type' => $request->user()?->role,
                    'actor_id' => $request->user()?->id,
                    'note' => $validated['internal_note'] ?? null,
                    'metadata' => ['previous_status' => $previousStatus],
                ]);
            }

            AdminLog::create([
                'action' => 'delivery_order_updated',
                'subject_type' => DeliveryOrder::class,
                'subject_id' => $deliveryOrder->id,
                'actor_type' => $request->user()?->role,
                'actor_id' => $request->user()?->id,
                'metadata' => [
                    'previous' => $previous,
                    'current' => $validated,
                ],
            ]);
        });

        $freshOrder = $deliveryOrder->fresh()->load(['rider', 'customer', 'shop', 'clientUser', 'statusHistories', 'payments', 'cashCollection']);

        if (array_key_exists('status', $validated) && $validated['status'] !== $previousStatus) {
            app(RealtimeSocketPublisher::class)->orderStatusUpdated($freshOrder);
        } else {
            app(RealtimeSocketPublisher::class)->orderUpdated($freshOrder);
        }

        return response()->json($freshOrder);
    }

    public function destroy(Request $request, DeliveryOrder $deliveryOrder): JsonResponse
    {
        if ($request->user()?->role === User::ROLE_CLIENT) {
            $this->authorizeClientPendingOrder($request, $deliveryOrder);
        }

        $rider = $deliveryOrder->rider;
        $snapshot = $deliveryOrder->only([
            'code',
            'client_name',
            'client_phone',
            'status',
            'payment_status',
            'rider_id',
            'client_user_id',
        ]);

        DB::transaction(function () use ($deliveryOrder, $request, $snapshot, $rider) {
            $id = $deliveryOrder->id;
            $deliveryOrder->delete();

            if ($rider) {
                $this->releaseRiderWhenIdle($rider, $id);
            }

            AdminLog::create([
                'action' => 'delivery_order_deleted',
                'subject_type' => DeliveryOrder::class,
                'subject_id' => $id,
                'actor_type' => $request->user()?->role,
                'actor_id' => $request->user()?->id,
                'metadata' => $snapshot,
            ]);
        });

        app(RealtimeSocketPublisher::class)->orderDeleted($deliveryOrder->id, $snapshot);

        return response()->json(['message' => 'Delivery order deleted.']);
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

        $freshOrder = $deliveryOrder->fresh()->load(['rider', 'customer', 'shop', 'clientUser', 'statusHistories']);
        app(RealtimeSocketPublisher::class)->orderAssigned($freshOrder);

        return response()->json($freshOrder);
    }

    public function updateStatus(
        UpdateDeliveryOrderStatusRequest $request,
        DeliveryOrder $deliveryOrder
    ): JsonResponse {
        if ($request->user()?->role === User::ROLE_RIDER) {
            $deliveryOrder->loadMissing('rider');

            if ((int) $deliveryOrder->rider?->user_id !== (int) $request->user()->id) {
                abort(403, 'You can only update orders assigned to your rider account.');
            }
        }

        $validated = $request->validated();
        $status = $validated['status'];

        if (! $deliveryOrder->canTransitionTo($status)) {
            throw ValidationException::withMessages([
                'status' => "Cannot move delivery from {$deliveryOrder->status} to {$status}.",
            ]);
        }

        DB::transaction(function () use ($deliveryOrder, $validated, $status) {
            $existingCollection = $deliveryOrder->cashCollection;

            $timestamps = match ($status) {
                'picked_up' => ['picked_up_at' => now()],
                'delivered' => ['delivered_at' => now()],
                'completed' => ['completed_at' => now()],
                default => [],
            };

            $updates = ['status' => $status] + $timestamps;

            if ($status === 'picked_up') {
                $updates['receiver_name'] = $validated['receiver_name'] ?? '';
                $updates['receiver_phone'] = $validated['receiver_phone'];
                $updates['receiver_address'] = $validated['receiver_address'];
                $updates['product_payment_method'] = $validated['product_payment_method'] ?? 'already_paid';
                $updates['cod_amount'] = $updates['product_payment_method'] === 'rider_collects'
                    ? ($validated['cod_amount'] ?? 0)
                    : 0;
            }

            if ($status === 'completed') {
                $deliveryFee = (float) $validated['delivery_fee'];
                $updates['delivery_fee'] = $deliveryFee;
                $updates['delivery_fee_payment_method'] = 'cash';
                $updates['payment_status'] = 'paid';
            }

            $deliveryOrder->update($updates);
            $deliveryOrder->statusHistories()->create([
                'status' => $status,
                'actor_type' => $validated['actor_type'] ?? null,
                'actor_id' => $validated['actor_id'] ?? null,
                'note' => $validated['note'] ?? null,
            ]);

            if ($status === 'completed' && $deliveryOrder->rider_id && ! $existingCollection) {
                $deliveryFee = (float) $validated['delivery_fee'];

                if ($deliveryFee > 0) {
                    CashCollection::create([
                        'delivery_order_id' => $deliveryOrder->id,
                        'rider_id' => $deliveryOrder->rider_id,
                        'product_cash_collected' => 0,
                        'delivery_fee_collected' => $deliveryFee,
                        'total_cash_collected' => $deliveryFee,
                    ]);

                    $deliveryOrder->rider()->increment('cash_held', $deliveryFee);
                }
            }

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

        $freshOrder = $deliveryOrder->fresh()->load(['rider', 'customer', 'shop', 'clientUser', 'statusHistories', 'cashCollection']);
        app(RealtimeSocketPublisher::class)->orderStatusUpdated($freshOrder);

        return response()->json($freshOrder);
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

    private function authorizeClientPendingOrder(Request $request, DeliveryOrder $deliveryOrder): void
    {
        if ((int) $deliveryOrder->client_user_id !== (int) $request->user()?->id) {
            abort(403, 'You can only change your own delivery requests.');
        }

        if ($deliveryOrder->status !== 'pending') {
            throw ValidationException::withMessages([
                'order' => 'This delivery request can no longer be edited or deleted after office review starts.',
            ]);
        }
    }

    private function clientUpdateRules(): array
    {
        return [
            'client_name' => ['sometimes', 'required', 'string', 'max:255'],
            'client_phone' => ['sometimes', 'required', 'string', 'max:30'],
            'pickup_contact_name' => ['sometimes', 'required', 'string', 'max:255'],
            'pickup_phone' => ['sometimes', 'required', 'string', 'max:30'],
            'pickup_address' => ['sometimes', 'required', 'string', 'max:1000'],
            'pickup_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'pickup_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'receiver_name' => ['nullable', 'string', 'max:255'],
            'receiver_phone' => ['nullable', 'string', 'max:30'],
            'receiver_address' => ['nullable', 'string', 'max:1000'],
            'receiver_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'receiver_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'product_name' => ['sometimes', 'required', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', 'max:100'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:999'],
            'product_value' => ['nullable', 'numeric', 'min:0'],
            'is_fragile' => ['nullable', 'boolean'],
            'special_handling_note' => ['nullable', 'string', 'max:1000'],
            'delivery_fee_payment_method' => ['sometimes', 'required', 'in:cash,mobile_banking'],
            'product_payment_method' => ['nullable', 'in:already_paid,rider_collects'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
            'prepaid_amount' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'client_note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function officeUpdateRules(): array
    {
        return [
            'client_name' => ['nullable', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'client_phone' => ['nullable', 'string', 'max:30'],
            'pickup_contact_name' => ['sometimes', 'required', 'string', 'max:255'],
            'pickup_phone' => ['sometimes', 'required', 'string', 'max:30'],
            'pickup_address' => ['sometimes', 'required', 'string', 'max:1000'],
            'pickup_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'pickup_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'receiver_name' => ['nullable', 'string', 'max:255'],
            'receiver_phone' => ['nullable', 'string', 'max:30'],
            'receiver_address' => ['nullable', 'string', 'max:1000'],
            'receiver_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'receiver_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'product_name' => ['sometimes', 'required', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', 'max:100'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:999'],
            'product_value' => ['nullable', 'numeric', 'min:0'],
            'is_fragile' => ['nullable', 'boolean'],
            'special_handling_note' => ['nullable', 'string', 'max:1000'],
            'delivery_fee_payment_method' => ['sometimes', 'required', 'in:cash,mobile_banking'],
            'product_payment_method' => ['sometimes', 'required', 'in:already_paid,rider_collects,shop_collects_separately,mobile_banking'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
            'prepaid_amount' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'payment_status' => ['sometimes', 'required', 'in:unpaid,pending_approval,paid,rejected,refunded'],
            'status' => ['sometimes', 'required', 'in:' . implode(',', DeliveryOrder::STATUSES)],
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
            'client_note' => ['nullable', 'string', 'max:1000'],
            'internal_note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function notifyClient(DeliveryOrder $order, string $kind, string $title, string $body, array $meta = []): void
    {
        $order->loadMissing('clientUser');

        $order->clientUser?->notify(new OrderActivityNotification($order, $kind, $title, $body, $meta));
    }

    private function normalizeOptionalDestinationFields(array &$attributes, bool $includeMissing = true): void
    {
        foreach (['receiver_name', 'receiver_phone', 'receiver_address'] as $field) {
            if ($includeMissing || array_key_exists($field, $attributes)) {
                $attributes[$field] = $attributes[$field] ?? '';
            }
        }
    }

    private function normalizeOptionalRequesterFields(array &$attributes, bool $includeMissing = true): void
    {
        foreach (['client_name', 'client_phone'] as $field) {
            if ($includeMissing || array_key_exists($field, $attributes)) {
                $attributes[$field] = $attributes[$field] ?? '';
            }
        }
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
