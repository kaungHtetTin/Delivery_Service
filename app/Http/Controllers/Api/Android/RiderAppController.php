<?php

namespace App\Http\Controllers\Api\Android;

use App\Http\Controllers\Api\RiderController;
use App\Http\Controllers\Controller;
use App\Models\DeliveryOrder;
use App\Models\PushSubscription;
use App\Models\Rider;
use App\Services\RiderOrderWorkflow;
use App\Support\AndroidRiderPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RiderAppController extends Controller
{
    private const HISTORY_STATUSES = ['completed', 'failed', 'cancelled'];

    public function bootstrap(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $rider = $this->riderFor($request);

        return response()->json([
            'user' => $payload->user($request->user()),
            'rider' => $payload->rider($rider),
            'summary' => $payload->summary($rider, $request->user()),
            'app_config' => $payload->appConfig(),
        ]);
    }

    public function jobs(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $rider = $this->riderFor($request);
        $scope = $request->query('scope', 'active');
        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $orders = $rider->deliveryOrders()
            ->with(['rider.latestLocation', 'payments', 'customer', 'shop', 'clientUser'])
            ->when($scope === 'active', fn ($query) => $query->whereNotIn('status', self::HISTORY_STATUSES))
            ->when($scope === 'history', fn ($query) => $query->whereIn('status', self::HISTORY_STATUSES))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate($perPage);

        $orders->getCollection()->transform(fn (DeliveryOrder $order) => $payload->order($order));

        return response()->json($orders);
    }

    public function showJob(Request $request, DeliveryOrder $deliveryOrder, AndroidRiderPayload $payload): JsonResponse
    {
        $this->authorizeAssignedOrder($request, $deliveryOrder);

        $deliveryOrder->load([
            'rider.latestLocation',
            'customer',
            'shop',
            'clientUser',
            'statusHistories',
            'payments',
            'cashCollection',
        ]);

        return response()->json($payload->order($deliveryOrder, true));
    }

    public function progressJob(
        Request $request,
        DeliveryOrder $deliveryOrder,
        RiderOrderWorkflow $workflow,
        AndroidRiderPayload $payload
    ): JsonResponse {
        $rider = $this->riderFor($request);
        $this->authorizeAssignedOrder($request, $deliveryOrder);

        $validated = $request->validate([
            'status' => ['required', Rule::in(DeliveryOrder::STATUSES)],
            'delivery_fee' => [
                Rule::requiredIf(fn () => $request->input('status') === 'completed'),
                'nullable',
                'numeric',
                'min:0',
            ],
            'note' => ['nullable', 'string', 'max:1000'],
            'receiver_name' => ['nullable', 'string', 'max:255'],
            'receiver_phone' => [
                Rule::requiredIf(fn () => $request->input('status') === 'picked_up'),
                'nullable',
                'string',
                'max:30',
            ],
            'receiver_address' => [
                Rule::requiredIf(fn () => $request->input('status') === 'picked_up'),
                'nullable',
                'string',
                'max:1000',
            ],
            'product_payment_method' => ['nullable', 'in:already_paid,rider_collects'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $order = $workflow->progress($deliveryOrder, $rider, $request->user(), $validated);

        return response()->json($payload->order($order, true));
    }

    public function startDuty(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $rider = $this->riderFor($request);

        if ($rider->status === 'suspended') {
            throw ValidationException::withMessages([
                'status' => 'Suspended riders cannot start active duty.',
            ]);
        }

        $rider->update([
            'status' => $rider->status === 'busy' ? 'busy' : 'available',
            'last_active_at' => now(),
        ]);

        Log::info('android.rider.start_duty', [
            'rider_id' => $rider->id,
            'user_id' => $request->user()->id,
            'status' => $rider->fresh()->status,
        ]);

        return response()->json([
            'message' => 'Rider duty started.',
            'rider' => $payload->rider($rider->fresh(['latestLocation', 'user'])),
        ]);
    }

    public function stopDuty(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $rider = $this->riderFor($request);

        if ($rider->status !== 'suspended') {
            $rider->update([
                'status' => 'offline',
                'last_active_at' => now(),
            ]);
        }

        Log::info('android.rider.stop_duty', [
            'rider_id' => $rider->id,
            'user_id' => $request->user()->id,
            'status' => $rider->fresh()->status,
        ]);

        return response()->json([
            'message' => 'Rider duty stopped.',
            'rider' => $payload->rider($rider->fresh(['latestLocation', 'user'])),
        ]);
    }

    public function storeLocation(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $rider = $this->riderFor($request);
        $request->merge(['source' => $request->input('source', 'native')]);
        $response = app(RiderController::class)->storeLocation($request, $rider);
        $location = $rider->locations()->latest('id')->first();

        return response()->json([
            'message' => $response->getStatusCode() === 201 ? 'Location stored.' : 'Location already synced.',
            'location' => $payload->location($location),
            'rider' => $payload->rider($rider->fresh(['latestLocation', 'user'])),
        ], $response->getStatusCode());
    }

    public function gpsEvent(Request $request): JsonResponse
    {
        $rider = $this->riderFor($request);

        return app(RiderController::class)->reportGpsEvent($request, $rider);
    }

    public function notifications(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $perPage = min(max($request->integer('per_page', 50), 1), 100);
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->paginate($perPage);

        $notifications->getCollection()->transform(fn ($notification) => $payload->notification($notification));

        return response()->json($notifications);
    }

    public function markNotificationRead(Request $request, string $notification, AndroidRiderPayload $payload): JsonResponse
    {
        $record = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        $record->markAsRead();

        return response()->json($payload->notification($record->fresh()));
    }

    public function saveDeviceToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fcm_token' => ['required', 'string', 'max:512'],
        ]);

        $subscription = PushSubscription::query()->updateOrCreate(
            ['token' => $validated['fcm_token']],
            [
                'user_id' => $request->user()->id,
                'platform' => 'android',
                'user_agent' => $request->userAgent(),
                'last_seen_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Android device token saved.',
            'device' => [
                'id' => $subscription->id,
                'platform' => $subscription->platform,
                'last_seen_at' => $subscription->last_seen_at?->toIso8601String(),
            ],
        ]);
    }

    public function deleteDeviceToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fcm_token' => ['required', 'string', 'max:512'],
        ]);

        $request->user()
            ->pushSubscriptions()
            ->where('token', $validated['fcm_token'])
            ->delete();

        return response()->json(['message' => 'Android device token removed.']);
    }

    private function riderFor(Request $request): Rider
    {
        return Rider::query()
            ->with(['latestLocation', 'user'])
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
    }

    private function authorizeAssignedOrder(Request $request, DeliveryOrder $order): void
    {
        $rider = $this->riderFor($request);

        if ((int) $order->rider_id !== (int) $rider->id) {
            abort(403, 'You can only view orders assigned to your rider account.');
        }
    }
}
