<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ShopController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shops = Shop::query()
            ->with('customer')
            ->withCount('deliveryOrders')
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->when($request->integer('customer_id'), fn ($query, $customerId) => $query->where('customer_id', $customerId))
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('contact_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%"));
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50));

        return response()->json($shops);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $shop = DB::transaction(function () use ($validated) {
            if ($validated['is_default'] ?? false) {
                Shop::query()
                    ->when(
                        $validated['customer_id'] ?? null,
                        fn ($query, $customerId) => $query->where('customer_id', $customerId),
                        fn ($query) => $query->whereNull('customer_id')
                    )
                    ->update(['is_default' => false]);
            }

            return Shop::create($validated);
        });

        $this->log($request, 'shop_created', $shop, $validated);

        return response()->json($shop->load('customer')->loadCount('deliveryOrders'), 201);
    }

    public function show(Shop $shop): JsonResponse
    {
        return response()->json($shop->load('customer')->loadCount('deliveryOrders'));
    }

    public function update(Request $request, Shop $shop): JsonResponse
    {
        $validated = $request->validate($this->rules($shop));
        $previous = $shop->only(array_keys($validated));

        DB::transaction(function () use ($shop, $validated) {
            if ($validated['is_default'] ?? false) {
                Shop::query()
                    ->whereKeyNot($shop->id)
                    ->when(
                        $validated['customer_id'] ?? $shop->customer_id,
                        fn ($query, $customerId) => $query->where('customer_id', $customerId),
                        fn ($query) => $query->whereNull('customer_id')
                    )
                    ->update(['is_default' => false]);
            }

            $shop->update($validated);
        });

        $this->log($request, 'shop_updated', $shop, ['previous' => $previous, 'current' => $validated]);

        return response()->json($shop->fresh()->load('customer')->loadCount('deliveryOrders'));
    }

    public function destroy(Request $request, Shop $shop): JsonResponse
    {
        $snapshot = $shop->only(['name', 'contact_name', 'phone', 'status']);
        $id = $shop->id;
        $shop->delete();

        AdminLog::create([
            'action' => 'shop_deleted',
            'subject_type' => Shop::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Shop deleted.']);
    }

    private function rules(?Shop $shop = null): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'name' => [$shop ? 'sometimes' : 'required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'phone' => [$shop ? 'sometimes' : 'required', 'string', 'max:30', Rule::unique('shops', 'phone')->ignore($shop)],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => [$shop ? 'sometimes' : 'required', 'string', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'is_default' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function log(Request $request, string $action, Shop $shop, array $metadata): void
    {
        AdminLog::create([
            'action' => $action,
            'subject_type' => Shop::class,
            'subject_id' => $shop->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $metadata,
        ]);
    }
}
