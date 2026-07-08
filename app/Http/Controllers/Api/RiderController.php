<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Rider;
use App\Models\User;
use App\Services\RealtimeSocketPublisher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RiderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $riders = Rider::query()
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
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('riders', 'code')],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30', Rule::unique('riders', 'phone')],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('riders', 'email')],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:offline,online,available,busy,on_break,suspended'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'current_area' => ['nullable', 'string', 'max:255'],
            'cash_held' => ['nullable', 'numeric', 'min:0'],
        ]);

        $rider = Rider::create($validated);

        AdminLog::create([
            'action' => 'rider_created',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $validated,
        ]);

        return response()->json($rider->loadCount(['deliveryOrders as active_orders_count' => function ($query) {
            $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
        }]), 201);
    }

    public function update(Request $request, Rider $rider): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('riders', 'code')->ignore($rider)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('riders', 'phone')->ignore($rider)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('riders', 'email')->ignore($rider)],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:offline,online,available,busy,on_break,suspended'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'current_area' => ['nullable', 'string', 'max:255'],
            'cash_held' => ['nullable', 'numeric', 'min:0'],
        ]);

        $previous = $rider->only(array_keys($validated));
        $rider->update($validated);

        AdminLog::create([
            'action' => 'rider_updated',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'previous' => $previous,
                'current' => $validated,
            ],
        ]);

        return response()->json($rider->fresh()->loadCount(['deliveryOrders as active_orders_count' => function ($query) {
            $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
        }]));
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
        $this->authorizeRiderAccess($request, $rider);

        $validated = $request->validate([
            'delivery_order_id' => ['nullable', 'integer', 'exists:delivery_orders,id'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'speed' => ['nullable', 'numeric', 'min:0'],
            'battery_percent' => ['nullable', 'integer', 'between:0,100'],
            'recorded_at' => ['nullable', 'date'],
        ]);

        $validated['recorded_at'] ??= now();
        $location = $rider->locations()->create($validated);

        $rider->update([
            'last_active_at' => $location->recorded_at,
            'status' => $rider->status === 'offline' ? 'online' : $rider->status,
        ]);

        app(RealtimeSocketPublisher::class)->riderLocationUpdated($location);

        return response()->json($location, 201);
    }

    private function authorizeRiderAccess(Request $request, Rider $rider): void
    {
        if ($request->user()?->role === User::ROLE_RIDER && (int) $rider->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }
}
