<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClientShopController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shops = Shop::query()
            ->whereIn('customer_id', $this->clientCustomerIds($request))
            ->with('customer')
            ->withCount('deliveryOrders')
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $shops]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $shop = DB::transaction(function () use ($request, $validated) {
            $validated['customer_id'] = $this->resolveCustomerId($request, $validated['customer_id'] ?? null);

            if (($validated['is_default'] ?? false) || ! $this->clientShopQuery($request)->exists()) {
                $this->clientShopQuery($request)->update(['is_default' => false]);
                $validated['is_default'] = true;
            }

            return Shop::create($validated);
        });

        return response()->json($shop->load('customer')->loadCount('deliveryOrders'), 201);
    }

    public function update(Request $request, Shop $shop): JsonResponse
    {
        $this->authorizeShop($request, $shop);
        $validated = $request->validate($this->rules($shop, true));

        DB::transaction(function () use ($request, $shop, $validated) {
            if (array_key_exists('customer_id', $validated)) {
                $validated['customer_id'] = $this->resolveCustomerId($request, $validated['customer_id']);
            }

            if ($validated['is_default'] ?? false) {
                $this->clientShopQuery($request)->whereKeyNot($shop->id)->update(['is_default' => false]);
            }

            $shop->update($validated);
        });

        return response()->json($shop->fresh()->load('customer')->loadCount('deliveryOrders'));
    }

    public function destroy(Request $request, Shop $shop): JsonResponse
    {
        $this->authorizeShop($request, $shop);

        DB::transaction(function () use ($request, $shop) {
            $wasDefault = $shop->is_default;
            $shop->delete();

            if ($wasDefault) {
                $nextShop = $this->clientShopQuery($request)->where('status', 'active')->first();
                $nextShop?->update(['is_default' => true]);
            }
        });

        return response()->json(['message' => 'Shop deleted.']);
    }

    public function makeDefault(Request $request, Shop $shop): JsonResponse
    {
        $this->authorizeShop($request, $shop);

        DB::transaction(function () use ($request, $shop) {
            $this->clientShopQuery($request)->whereKeyNot($shop->id)->update(['is_default' => false]);
            $shop->update(['is_default' => true]);
        });

        return response()->json($shop->fresh()->load('customer')->loadCount('deliveryOrders'));
    }

    private function rules(?Shop $shop = null, bool $partial = false): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'phone' => [$partial ? 'sometimes' : 'required', 'string', 'max:30', Rule::unique('shops', 'phone')->ignore($shop)],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => [$partial ? 'sometimes' : 'required', 'string', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'is_default' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function clientCustomerIds(Request $request)
    {
        return Customer::query()
            ->where('user_id', $request->user()->id)
            ->pluck('id');
    }

    private function clientShopQuery(Request $request)
    {
        return Shop::query()->whereIn('customer_id', $this->clientCustomerIds($request));
    }

    private function resolveCustomerId(Request $request, ?int $customerId): int
    {
        $customerIds = $this->clientCustomerIds($request);

        if ($customerId) {
            abort_unless($customerIds->contains($customerId), 403);

            return $customerId;
        }

        $customer = Customer::query()
            ->whereIn('id', $customerIds)
            ->orderByRaw("case when type in ('business', 'shop') then 0 else 1 end")
            ->first();

        abort_unless($customer, 422, 'Create a customer profile before saving a shop pickup address.');

        return $customer->id;
    }

    private function authorizeShop(Request $request, Shop $shop): void
    {
        abort_unless($this->clientCustomerIds($request)->contains($shop->customer_id), 403);
    }
}
