<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashCollection;
use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\Rider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $dateFrom = $request->date('date_from');
        $dateTo = $request->date('date_to');

        $orders = DeliveryOrder::query()
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo));

        $payments = Payment::query()
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo));

        $cashCollections = CashCollection::query()
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo));

        return response()->json([
            'orders' => [
                'total' => (clone $orders)->count(),
                'active' => (clone $orders)->whereNotIn('status', ['completed', 'failed', 'cancelled'])->count(),
                'completed' => (clone $orders)->where('status', 'completed')->count(),
                'failed' => (clone $orders)->where('status', 'failed')->count(),
                'cancelled' => (clone $orders)->where('status', 'cancelled')->count(),
            ],
            'payments' => [
                'pending_approval' => (clone $payments)->where('status', 'pending_approval')->count(),
                'paid' => (clone $payments)->where('status', 'paid')->count(),
                'rejected' => (clone $payments)->where('status', 'rejected')->count(),
                'approved_amount' => (float) (clone $payments)->where('status', 'paid')->sum('amount'),
            ],
            'cash_collections' => [
                'total_collected' => (float) (clone $cashCollections)->sum('total_cash_collected'),
                'confirmed' => (clone $cashCollections)->whereNotNull('confirmed_at')->count(),
            ],
            'riders' => Rider::query()
                ->withCount([
                    'deliveryOrders as active_orders_count' => fn ($query) => $query->whereNotIn('status', ['completed', 'failed', 'cancelled']),
                    'deliveryOrders as completed_orders_count' => fn ($query) => $query->where('status', 'completed'),
                ])
                ->orderByDesc('active_orders_count')
                ->get(['id', 'code', 'name', 'status', 'current_area', 'cash_held']),
        ]);
    }
}
