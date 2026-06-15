<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\CashCollection;
use App\Models\Rider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CashCollectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $collections = CashCollection::query()
            ->with(['deliveryOrder', 'rider'])
            ->when($request->integer('rider_id'), fn ($query, $riderId) => $query->where('rider_id', $riderId))
            ->when($request->integer('delivery_order_id'), fn ($query, $orderId) => $query->where('delivery_order_id', $orderId))
            ->when($request->boolean('confirmed'), fn ($query) => $query->whereNotNull('confirmed_at'))
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($collections);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateCollection($request);

        $collection = DB::transaction(function () use ($validated, $request) {
            $collection = CashCollection::create($this->withCalculatedTotal($validated));
            $collection->rider()->increment('cash_held', $this->deliveryFeeHeld($collection));

            AdminLog::create([
                'action' => 'cash_collection_created',
                'subject_type' => CashCollection::class,
                'subject_id' => $collection->id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => $validated,
            ]);

            return $collection;
        });

        return response()->json($collection->fresh()->load(['deliveryOrder', 'rider']), 201);
    }

    public function show(CashCollection $cashCollection): JsonResponse
    {
        return response()->json($cashCollection->load(['deliveryOrder', 'rider']));
    }

    public function update(Request $request, CashCollection $cashCollection): JsonResponse
    {
        $validated = $this->validateCollection($request, $cashCollection);

        DB::transaction(function () use ($cashCollection, $validated, $request) {
            $previousRiderId = $cashCollection->rider_id;
            $previousDeliveryFee = $this->deliveryFeeHeld($cashCollection);
            $previous = $cashCollection->only(array_keys($validated));

            $cashCollection->update($this->withCalculatedTotal($validated, $cashCollection));
            $currentDeliveryFee = $this->deliveryFeeHeld($cashCollection);

            if ((int) $previousRiderId !== (int) $cashCollection->rider_id) {
                Rider::whereKey($previousRiderId)->decrement('cash_held', $previousDeliveryFee);
                $cashCollection->rider()->increment('cash_held', $currentDeliveryFee);
            } else {
                $difference = $currentDeliveryFee - $previousDeliveryFee;

                if ($difference !== 0.0) {
                    $cashCollection->rider()->increment('cash_held', $difference);
                }
            }

            AdminLog::create([
                'action' => 'cash_collection_updated',
                'subject_type' => CashCollection::class,
                'subject_id' => $cashCollection->id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => [
                    'previous' => $previous,
                    'current' => $validated,
                ],
            ]);
        });

        return response()->json($cashCollection->fresh()->load(['deliveryOrder', 'rider']));
    }

    public function destroy(Request $request, CashCollection $cashCollection): JsonResponse
    {
        $snapshot = $cashCollection->only([
            'delivery_order_id',
            'rider_id',
            'product_cash_collected',
            'delivery_fee_collected',
            'total_cash_collected',
        ]);
        $id = $cashCollection->id;

        DB::transaction(function () use ($cashCollection, $request, $snapshot, $id) {
            $cashCollection->rider()->decrement('cash_held', $this->deliveryFeeHeld($cashCollection));
            $cashCollection->delete();

            AdminLog::create([
                'action' => 'cash_collection_deleted',
                'subject_type' => CashCollection::class,
                'subject_id' => $id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => $snapshot,
            ]);
        });

        return response()->json(['message' => 'Cash collection deleted.']);
    }

    private function validateCollection(Request $request, ?CashCollection $cashCollection = null): array
    {
        $deliveryOrderRule = Rule::unique('cash_collections', 'delivery_order_id');

        if ($cashCollection) {
            $deliveryOrderRule->ignore($cashCollection);
        }

        return $request->validate([
            'delivery_order_id' => [
                $cashCollection ? 'sometimes' : 'required',
                'integer',
                'exists:delivery_orders,id',
                $deliveryOrderRule,
            ],
            'rider_id' => [$cashCollection ? 'sometimes' : 'required', 'integer', 'exists:riders,id'],
            'delivery_fee_collected' => ['nullable', 'numeric', 'min:0'],
            'payment_note' => ['nullable', 'string', 'max:1000'],
            'confirmed_at' => ['nullable', 'date'],
        ]);
    }

    private function withCalculatedTotal(array $validated, ?CashCollection $cashCollection = null): array
    {
        $deliveryFee = array_key_exists('delivery_fee_collected', $validated)
            ? (float) $validated['delivery_fee_collected']
            : (float) ($cashCollection?->delivery_fee_collected ?? 0);

        $validated['product_cash_collected'] = 0;
        $validated['total_cash_collected'] = $deliveryFee;

        return $validated;
    }

    private function deliveryFeeHeld(CashCollection $collection): float
    {
        return (float) $collection->delivery_fee_collected;
    }
}
