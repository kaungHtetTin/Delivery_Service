<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\CashCollection;
use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\Rider;
use App\Models\RiderLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    private const TRACKED_RIDER_STATUSES = ['available', 'online', 'busy', 'on_break'];
    private const TERMINAL_ORDER_STATUSES = ['completed', 'failed', 'cancelled'];
    private const POOR_ACCURACY_METERS = 100;

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

        $riderCollectedFees = CashCollection::query()
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo));

        $riders = Rider::query()
            ->with('latestLocation')
            ->withCount([
                'deliveryOrders as active_orders_count' => fn ($query) => $query->whereNotIn('status', self::TERMINAL_ORDER_STATUSES),
                'deliveryOrders as completed_orders_count' => fn ($query) => $query->where('status', 'completed'),
            ])
            ->orderByDesc('active_orders_count')
            ->get(['id', 'code', 'name', 'status', 'current_area', 'cash_held', 'last_active_at']);

        return response()->json([
            'orders' => [
                'total' => (clone $orders)->count(),
                'active' => (clone $orders)->whereNotIn('status', self::TERMINAL_ORDER_STATUSES)->count(),
                'completed' => (clone $orders)->where('status', 'completed')->count(),
                'failed' => (clone $orders)->where('status', 'failed')->count(),
                'cancelled' => (clone $orders)->where('status', 'cancelled')->count(),
            ],
            'payments' => [
                'unpaid' => (clone $payments)->where('status', 'unpaid')->count(),
                'pending_approval' => (clone $payments)->where('status', 'pending_approval')->count(),
                'paid' => (clone $payments)->where('status', 'paid')->count(),
                'rejected' => (clone $payments)->where('status', 'rejected')->count(),
                'refunded' => (clone $payments)->where('status', 'refunded')->count(),
                'approved_amount' => (float) (clone $payments)->where('status', 'paid')->sum('amount'),
            ],
            'delivery_fees' => [
                'rider_collected' => (float) (clone $riderCollectedFees)->sum('delivery_fee_collected'),
                'records' => (clone $riderCollectedFees)->count(),
            ],
            'gps' => $this->gpsSummary($riders),
            'gps_alerts' => $this->gpsAlerts($riders),
            'riders' => $riders,
        ]);
    }

    private function gpsSummary($riders): array
    {
        $trackedRiders = $riders->whereIn('status', self::TRACKED_RIDER_STATUSES);
        $updatesLastMinute = RiderLocation::query()
            ->where('recorded_at', '>=', now()->subMinute())
            ->count();
        $averageAccuracy = RiderLocation::query()
            ->where('recorded_at', '>=', now()->subMinutes(10))
            ->whereNotNull('accuracy')
            ->avg('accuracy');

        return [
            'active_riders' => $trackedRiders->count(),
            'fresh_riders' => $trackedRiders->filter(fn (Rider $rider) => $this->gpsFreshness($rider) === 'fresh')->count(),
            'warning_riders' => $trackedRiders->filter(fn (Rider $rider) => $this->gpsFreshness($rider) === 'warning')->count(),
            'stale_riders' => $trackedRiders->filter(fn (Rider $rider) => $this->gpsFreshness($rider) === 'stale')->count(),
            'no_gps_riders' => $trackedRiders->filter(fn (Rider $rider) => $this->gpsFreshness($rider) === 'no_gps')->count(),
            'poor_accuracy_riders' => $trackedRiders->filter(fn (Rider $rider) => $this->hasPoorAccuracy($rider))->count(),
            'updates_last_minute' => $updatesLastMinute,
            'average_accuracy' => $averageAccuracy ? round((float) $averageAccuracy, 1) : null,
        ];
    }

    private function gpsAlerts($riders): array
    {
        $alerts = collect();
        $trackedRiders = $riders->whereIn('status', self::TRACKED_RIDER_STATUSES);
        $ridersById = $riders->keyBy('id');

        foreach ($trackedRiders as $rider) {
            $freshness = $this->gpsFreshness($rider);
            $activeOrders = (int) ($rider->active_orders_count ?? 0);

            if ($freshness === 'no_gps') {
                $alerts->push($this->gpsAlert(
                    $rider,
                    $activeOrders > 0 ? 'danger' : 'warning',
                    'no_gps',
                    $activeOrders > 0 ? 'Active rider has no GPS' : 'Online rider has no GPS',
                    $activeOrders > 0
                        ? "{$rider->name} has active delivery work but no GPS point yet."
                        : "{$rider->name} is online but has not sent a GPS point."
                ));

                continue;
            }

            if ($freshness === 'stale') {
                $alerts->push($this->gpsAlert(
                    $rider,
                    $activeOrders > 0 ? 'danger' : 'warning',
                    'stale',
                    $activeOrders > 0 ? 'Active delivery GPS stale' : 'Rider GPS stale',
                    "{$rider->name} last updated {$this->gpsAgeLabel($rider)}."
                ));
            }

            if ($this->hasPoorAccuracy($rider)) {
                $alerts->push($this->gpsAlert(
                    $rider,
                    'warning',
                    'poor_accuracy',
                    'GPS accuracy is weak',
                    "{$rider->name} last reported about ".round((float) $rider->latestLocation->accuracy).'m accuracy.'
                ));
            }
        }

        AdminLog::query()
            ->whereIn('action', ['rider_gps_permission_denied', 'rider_gps_position_unavailable', 'rider_gps_unsupported'])
            ->where('created_at', '>=', now()->subHours(8))
            ->latest()
            ->limit(5)
            ->get()
            ->each(function (AdminLog $log) use ($alerts, $ridersById) {
                $rider = $ridersById->get($log->subject_id);
                $name = $rider?->name ?? 'Rider';

                $alerts->push([
                    'type' => $log->action,
                    'severity' => 'warning',
                    'title' => 'Rider GPS permission problem',
                    'message' => $log->note ?: "{$name} reported a GPS browser issue.",
                    'rider_id' => $rider?->id,
                    'rider_code' => $rider?->code,
                    'rider_name' => $name,
                    'created_at' => $log->created_at?->toIso8601String(),
                ]);
            });

        return $alerts
            ->take(12)
            ->values()
            ->all();
    }

    private function gpsFreshness(Rider $rider): string
    {
        $location = $rider->latestLocation;

        if (! $location?->recorded_at) {
            return 'no_gps';
        }

        return $location->freshness;
    }

    private function hasPoorAccuracy(Rider $rider): bool
    {
        return $rider->latestLocation
            && $rider->latestLocation->accuracy !== null
            && (float) $rider->latestLocation->accuracy > self::POOR_ACCURACY_METERS;
    }

    private function gpsAgeLabel(Rider $rider): string
    {
        $recordedAt = $rider->latestLocation?->recorded_at;

        if (! $recordedAt) {
            return 'never';
        }

        $minutes = max(1, (int) round($recordedAt->diffInSeconds(now()) / 60));

        return $minutes < 60 ? "{$minutes}m ago" : round($minutes / 60).'h ago';
    }

    private function gpsAlert(Rider $rider, string $severity, string $type, string $title, string $message): array
    {
        return [
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'message' => $message,
            'rider_id' => $rider->id,
            'rider_code' => $rider->code,
            'rider_name' => $rider->name,
            'created_at' => now()->toIso8601String(),
        ];
    }
}
