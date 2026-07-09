<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\DeliveryOrder;
use App\Models\Rider;
use App\Models\RiderLocation;
use App\Models\RiderSettlement;
use App\Models\User;
use App\Services\RealtimeSocketPublisher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RiderController extends Controller
{
    private const LOCATION_MAX_AGE_MINUTES = 15;
    private const LOCATION_FUTURE_DRIFT_MINUTES = 2;
    private const TERMINAL_ORDER_STATUSES = ['completed', 'failed', 'cancelled'];
    private const LOCATION_AUTO_LINK_ORDER_STATUSES = [
        'picked_up',
        'going_to_delivery',
        'arrived_at_delivery',
        'delivered',
        'rider_accepted',
        'going_to_pickup',
        'arrived_at_pickup',
        'rider_assigned',
    ];

    public function index(Request $request): JsonResponse
    {
        $riders = Rider::query()
            ->with(['latestLocation', 'user'])
            ->withCount(['deliveryOrders as active_orders_count' => function ($query) {
                $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
            }])
            ->when($request->user()?->role === User::ROLE_RIDER, function ($query) use ($request) {
                $query->where('user_id', $request->user()->id);
            })
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $riders]);
    }

    public function store(Request $request): JsonResponse
    {
        $linkedUserId = $request->input('user_id');
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('riders', 'code')],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30', Rule::unique('riders', 'phone'), Rule::unique('users', 'phone')->ignore($linkedUserId)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('riders', 'email'), Rule::unique('users', 'email')->ignore($linkedUserId)],
            'password' => ['nullable', 'string', 'min:8'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:offline,online,available,busy,on_break,suspended'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'current_area' => ['nullable', 'string', 'max:255'],
        ]);

        $riderData = $validated;
        unset($riderData['password']);

        $rider = Rider::create($riderData);
        $rider = $this->syncRiderUser($rider, $validated);

        AdminLog::create([
            'action' => 'rider_created',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $this->safeRiderMetadata($validated),
        ]);

        return response()->json($this->riderForResponse($rider), 201);
    }

    public function update(Request $request, Rider $rider): JsonResponse
    {
        $linkedUserId = $request->input('user_id', $rider->user_id);
        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('riders', 'code')->ignore($rider)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('riders', 'phone')->ignore($rider), Rule::unique('users', 'phone')->ignore($linkedUserId)],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('riders', 'email')->ignore($rider), Rule::unique('users', 'email')->ignore($linkedUserId)],
            'password' => ['nullable', 'string', 'min:8'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:offline,online,available,busy,on_break,suspended'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'current_area' => ['nullable', 'string', 'max:255'],
        ]);

        $riderData = $validated;
        unset($riderData['password']);

        $previous = $rider->only(array_keys($riderData));
        $rider->update($riderData);
        $rider = $this->syncRiderUser($rider->fresh(), $validated);

        AdminLog::create([
            'action' => 'rider_updated',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'previous' => $previous,
                'current' => $this->safeRiderMetadata($validated),
            ],
        ]);

        return response()->json($this->riderForResponse($rider));
    }

    public function destroy(Request $request, Rider $rider): JsonResponse
    {
        $snapshot = $rider->only(['code', 'name', 'phone', 'status', 'current_area']);
        $id = $rider->id;
        $rider->delete();

        AdminLog::create([
            'action' => 'rider_deleted',
            'subject_type' => Rider::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Rider deleted.']);
    }

    public function collectHeldFees(Request $request, Rider $rider): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $result = DB::transaction(function () use ($rider, $request, $validated) {
            $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);
            $cashHeldBefore = (float) $lockedRider->cash_held;
            $amount = (float) $validated['amount'];

            if ($amount > $cashHeldBefore) {
                throw ValidationException::withMessages([
                    'amount' => 'Collection amount cannot be greater than the rider cash held.',
                ]);
            }

            $cashHeldAfter = $cashHeldBefore - $amount;

            $settlement = RiderSettlement::create([
                'rider_id' => $lockedRider->id,
                'collected_by' => $request->user()?->id,
                'amount' => $amount,
                'cash_held_before' => $cashHeldBefore,
                'cash_held_after' => $cashHeldAfter,
                'note' => $validated['note'] ?? null,
                'collected_at' => now(),
            ]);

            $lockedRider->update(['cash_held' => $cashHeldAfter]);

            AdminLog::create([
                'action' => 'rider_delivery_fees_collected',
                'subject_type' => Rider::class,
                'subject_id' => $lockedRider->id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => [
                    'settlement_id' => $settlement->id,
                    'amount' => $amount,
                    'cash_held_before' => $cashHeldBefore,
                    'cash_held_after' => $cashHeldAfter,
                ],
                'note' => $validated['note'] ?? null,
            ]);

            return [
                'rider' => $lockedRider->fresh(),
                'settlement' => $settlement->fresh('collector'),
            ];
        });

        return response()->json([
            'rider' => $this->riderForResponse($result['rider']),
            'settlement' => $result['settlement'],
        ]);
    }

    public function startActive(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderAccess($request, $rider);

        if ($rider->status === 'suspended') {
            throw ValidationException::withMessages([
                'status' => 'Suspended riders cannot start active duty.',
            ]);
        }

        $rider->update([
            'status' => $rider->status === 'busy' ? 'busy' : 'available',
            'last_active_at' => now(),
        ]);

        AdminLog::create([
            'action' => 'rider_started_active',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => $request->user()?->role === User::ROLE_RIDER ? 'rider' : 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'status' => $rider->fresh()->status,
            ],
        ]);

        Log::info('rider.start_active', [
            'rider_id' => $rider->id,
            'user_id' => $request->user()?->id,
            'status' => $rider->fresh()->status,
        ]);

        return response()->json($this->riderForResponse($rider));
    }

    public function stopActive(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderAccess($request, $rider);

        if ($rider->status !== 'suspended') {
            $rider->update([
                'status' => 'offline',
                'last_active_at' => now(),
            ]);
        }

        AdminLog::create([
            'action' => 'rider_stopped_active',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => $request->user()?->role === User::ROLE_RIDER ? 'rider' : 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'status' => $rider->fresh()->status,
            ],
        ]);

        Log::info('rider.stop_active', [
            'rider_id' => $rider->id,
            'user_id' => $request->user()?->id,
            'status' => $rider->fresh()->status,
        ]);

        return response()->json($this->riderForResponse($rider));
    }

    public function reportGpsEvent(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderAccess($request, $rider);

        $validated = $request->validate([
            'event' => ['required', 'string', Rule::in([
                'permission_denied',
                'position_unavailable',
                'timeout',
                'unsupported',
                'poor_accuracy',
                'offline_queued',
                'queue_flush_failed',
                'queue_flush_completed',
                'watcher_restarted',
            ])],
            'message' => ['nullable', 'string', 'max:500'],
            'permission' => ['nullable', 'string', 'max:30'],
            'tracking_state' => ['nullable', 'string', 'max:30'],
            'queued_count' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'accuracy' => ['nullable', 'numeric', 'between:0,5000'],
            'occurred_at' => ['nullable', 'date'],
        ]);

        $warningEvents = ['permission_denied', 'position_unavailable', 'unsupported', 'poor_accuracy', 'queue_flush_failed'];
        $action = 'rider_gps_'.$validated['event'];
        $metadata = [
            'event' => $validated['event'],
            'permission' => $validated['permission'] ?? null,
            'tracking_state' => $validated['tracking_state'] ?? null,
            'queued_count' => $validated['queued_count'] ?? null,
            'accuracy' => $validated['accuracy'] ?? null,
            'occurred_at' => $validated['occurred_at'] ?? now()->toIso8601String(),
        ];

        AdminLog::create([
            'action' => $action,
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => $request->user()?->role === User::ROLE_RIDER ? 'rider' : 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $metadata,
            'note' => $validated['message'] ?? null,
        ]);

        $logContext = [
            'rider_id' => $rider->id,
            'user_id' => $request->user()?->id,
            'event' => $validated['event'],
            'message' => $validated['message'] ?? null,
        ] + $metadata;

        if (in_array($validated['event'], $warningEvents, true)) {
            Log::warning('rider.gps_event', $logContext);
        } else {
            Log::info('rider.gps_event', $logContext);
        }

        return response()->json(['message' => 'GPS event recorded.']);
    }

    public function assignments(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderAccess($request, $rider);

        $orders = $rider->deliveryOrders()
            ->whereNotIn('status', ['completed', 'failed', 'cancelled'])
            ->latest()
            ->get();

        return response()->json(['data' => $orders]);
    }

    public function storeLocation(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderLocationWrite($request, $rider);

        $validated = $request->validate([
            'delivery_order_id' => ['nullable', 'integer', 'exists:delivery_orders,id'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'between:0,5000'],
            'speed' => ['nullable', 'numeric', 'between:0,80'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'battery_percent' => ['nullable', 'integer', 'between:0,100'],
            'source' => ['nullable', 'string', 'max:30', Rule::in(['browser', 'pwa', 'native'])],
            'recorded_at' => ['nullable', 'date'],
        ]);

        $validated['recorded_at'] = $this->normalizedLocationRecordedAt($validated['recorded_at'] ?? null);
        $validated['source'] ??= 'browser';
        $validated['delivery_order_id'] = $this->locationDeliveryOrderId($rider, $validated['delivery_order_id'] ?? null);

        if ($duplicate = $this->duplicateLocation($rider, $validated)) {
            $duplicate = $this->linkDuplicateLocationToOrder($duplicate, $validated['delivery_order_id']);

            Log::debug('rider.location_duplicate', [
                'rider_id' => $rider->id,
                'location_id' => $duplicate->id,
                'delivery_order_id' => $duplicate->delivery_order_id,
                'recorded_at' => $duplicate->recorded_at?->toIso8601String(),
            ]);

            return response()->json($duplicate->fresh('rider'));
        }

        $previousLocation = $rider->latestLocation()->first();

        if (
            $previousLocation?->recorded_at
            && $previousLocation->recorded_at->diffInSeconds($validated['recorded_at'], false) < 5
        ) {
            Log::warning('rider.location_frequency_high', [
                'rider_id' => $rider->id,
                'previous_location_id' => $previousLocation->id,
                'previous_recorded_at' => $previousLocation->recorded_at->toIso8601String(),
                'recorded_at' => $validated['recorded_at']->toIso8601String(),
            ]);
        }

        $location = $rider->locations()->create($validated);

        $rider->update([
            'last_active_at' => $rider->last_active_at && $rider->last_active_at->greaterThan($location->recorded_at)
                ? $rider->last_active_at
                : $location->recorded_at,
            'status' => $rider->status === 'offline' ? 'available' : $rider->status,
        ]);

        app(RealtimeSocketPublisher::class)->riderLocationUpdated($location);

        Log::debug('rider.location_stored', [
            'rider_id' => $rider->id,
            'location_id' => $location->id,
            'delivery_order_id' => $location->delivery_order_id,
            'accuracy' => $location->accuracy,
            'freshness' => $location->freshness,
            'recorded_at' => $location->recorded_at?->toIso8601String(),
        ]);

        return response()->json($location->fresh('rider'), 201);
    }

    private function authorizeRiderAccess(Request $request, Rider $rider): void
    {
        if ($request->user()?->role === User::ROLE_RIDER && (int) $rider->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }

    private function authorizeRiderLocationWrite(Request $request, Rider $rider): void
    {
        if ($request->user()?->role !== User::ROLE_RIDER) {
            abort(403);
        }

        $this->authorizeRiderAccess($request, $rider);
    }

    private function normalizedLocationRecordedAt(?string $value): Carbon
    {
        $recordedAt = $value ? Carbon::parse($value) : now();
        $now = now();

        if ($recordedAt->lt($now->copy()->subMinutes(self::LOCATION_MAX_AGE_MINUTES))) {
            throw ValidationException::withMessages([
                'recorded_at' => 'Location timestamp is too old for live tracking.',
            ]);
        }

        if ($recordedAt->gt($now->copy()->addMinutes(self::LOCATION_FUTURE_DRIFT_MINUTES))) {
            throw ValidationException::withMessages([
                'recorded_at' => 'Location timestamp is too far in the future.',
            ]);
        }

        return $recordedAt;
    }

    private function locationDeliveryOrderId(Rider $rider, ?int $deliveryOrderId): ?int
    {
        if (! $deliveryOrderId) {
            return $this->currentTrackableOrderId($rider);
        }

        $order = DeliveryOrder::find($deliveryOrderId);

        if (! $order || (int) $order->rider_id !== (int) $rider->id) {
            throw ValidationException::withMessages([
                'delivery_order_id' => 'Location can only be linked to an order assigned to this rider.',
            ]);
        }

        if (in_array($order->status, self::TERMINAL_ORDER_STATUSES, true)) {
            return null;
        }

        return $order->id;
    }

    private function currentTrackableOrderId(Rider $rider): ?int
    {
        return $rider->deliveryOrders()
            ->whereIn('status', self::LOCATION_AUTO_LINK_ORDER_STATUSES)
            ->orderByRaw("
                CASE status
                    WHEN 'picked_up' THEN 0
                    WHEN 'going_to_delivery' THEN 1
                    WHEN 'arrived_at_delivery' THEN 2
                    WHEN 'delivered' THEN 3
                    WHEN 'rider_accepted' THEN 4
                    WHEN 'going_to_pickup' THEN 5
                    WHEN 'arrived_at_pickup' THEN 6
                    WHEN 'rider_assigned' THEN 7
                    ELSE 99
                END
            ")
            ->latest()
            ->value('id');
    }

    private function duplicateLocation(Rider $rider, array $validated): ?RiderLocation
    {
        return $rider->locations()
            ->where('recorded_at', $validated['recorded_at'])
            ->where('latitude', round((float) $validated['latitude'], 7))
            ->where('longitude', round((float) $validated['longitude'], 7))
            ->latest('id')
            ->first();
    }

    private function linkDuplicateLocationToOrder(RiderLocation $location, ?int $deliveryOrderId): RiderLocation
    {
        if (! $deliveryOrderId || (int) $location->delivery_order_id === (int) $deliveryOrderId) {
            return $location;
        }

        if ($location->delivery_order_id === null) {
            $location->update(['delivery_order_id' => $deliveryOrderId]);
            app(RealtimeSocketPublisher::class)->riderLocationUpdated($location->fresh());

            return $location->fresh();
        }

        return $location;
    }

    private function syncRiderUser(Rider $rider, array $validated): Rider
    {
        $password = $validated['password'] ?? null;
        $user = null;

        if (! empty($validated['user_id'])) {
            $user = User::find($validated['user_id']);
        } elseif ($rider->user_id) {
            $user = $rider->user()->first();
        }

        if (! $user && ! $password) {
            return $rider;
        }

        if (! $user && empty($validated['email'])) {
            throw ValidationException::withMessages([
                'email' => 'Email is required to create rider login credentials.',
            ]);
        }

        $user ??= new User();
        $user->fill([
            'name' => $validated['name'] ?? $rider->name,
            'email' => $validated['email'] ?? $rider->email,
            'phone' => $validated['phone'] ?? $rider->phone,
            'role' => User::ROLE_RIDER,
        ]);

        if ($password) {
            $user->password = Hash::make($password);
        }

        $user->save();

        if ((int) $rider->user_id !== (int) $user->id) {
            $rider->forceFill(['user_id' => $user->id])->save();
        }

        return $rider->fresh();
    }

    private function riderForResponse(Rider $rider): Rider
    {
        return $rider->fresh()
            ->load(['latestLocation', 'user'])
            ->loadCount(['deliveryOrders as active_orders_count' => function ($query) {
                $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
            }]);
    }

    private function safeRiderMetadata(array $metadata): array
    {
        if (array_key_exists('password', $metadata)) {
            $metadata['password_changed'] = (bool) $metadata['password'];
            unset($metadata['password']);
        }

        return $metadata;
    }
}
