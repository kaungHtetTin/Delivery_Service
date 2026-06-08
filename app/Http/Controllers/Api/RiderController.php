<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        return response()->json($location, 201);
    }

    private function authorizeRiderAccess(Request $request, Rider $rider): void
    {
        if ($request->user()?->role === User::ROLE_RIDER && (int) $rider->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }
}
