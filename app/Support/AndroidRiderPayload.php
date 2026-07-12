<?php

namespace App\Support;

use App\Models\DeliveryOrder;
use App\Models\Rider;
use App\Models\RiderLocation;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;

class AndroidRiderPayload
{
    private const HISTORY_STATUSES = ['completed', 'failed', 'cancelled'];

    private const NEXT_ACTIONS = [
        'rider_assigned' => ['label' => 'Confirm Accept', 'status' => 'rider_accepted'],
        'rider_accepted' => ['label' => 'Pick up', 'status' => 'picked_up'],
        'picked_up' => ['label' => 'Delivered', 'status' => 'delivered'],
        'delivered' => ['label' => 'Complete order', 'status' => 'completed'],
    ];

    public function appConfig(): array
    {
        $settings = SystemSetting::query()
            ->whereIn('key', ['app_name', 'brand_color', 'app_icon'])
            ->pluck('value', 'key');

        return [
            'app_name' => $settings->get('app_name') ?: 'FlowDrop Delivery',
            'portal_name' => 'Rider',
            'brand_color' => $settings->get('brand_color') ?: '#087f74',
            'app_icon_url' => $settings->get('app_icon') ?: url('/pwa-icon-192.png'),
            'map_tile_url' => url('/map-tiles/{z}/{x}/{y}'),
            'socket_enabled' => (bool) config('services.socket_server.enabled'),
            'socket_url' => config('services.socket_server.url'),
            'socket_path' => '/socket.io',
            'socket_token_endpoint' => url('/api/realtime/token'),
            'gps' => [
                'active_statuses' => ['online', 'available', 'busy'],
                'moving_interval_seconds' => 15,
                'stationary_interval_seconds' => 45,
                'stale_after_seconds' => 120,
            ],
            'tabs' => [
                ['key' => 'jobs', 'label' => 'Jobs', 'icon' => 'box'],
                ['key' => 'history', 'label' => 'History', 'icon' => 'clock'],
                ['key' => 'gps', 'label' => 'GPS', 'icon' => 'location'],
                ['key' => 'notifications', 'label' => 'Alerts', 'icon' => 'bell'],
                ['key' => 'account', 'label' => 'Account', 'icon' => 'user'],
            ],
        ];
    }

    public function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'profile_photo_url' => $user->profile_photo_url,
        ];
    }

    public function rider(Rider $rider): array
    {
        $rider->loadMissing(['latestLocation', 'user']);

        return [
            'id' => $rider->id,
            'code' => $rider->code,
            'name' => $rider->name,
            'initials' => $this->initials($rider->name),
            'phone' => $rider->phone ?: $rider->user?->phone,
            'email' => $rider->email ?: $rider->user?->email,
            'status' => $rider->status,
            'status_label' => $this->label($rider->status),
            'vehicle_type' => $rider->vehicle_type,
            'vehicle_label' => $this->label($rider->vehicle_type ?: 'motorbike'),
            'current_area' => $rider->current_area ?: 'Area unavailable',
            'cash_held' => (float) $rider->cash_held,
            'last_active_at' => $this->iso($rider->last_active_at),
            'last_active_label' => $rider->last_active_at?->toDateTimeString(),
            'current_location' => $this->location($rider->latestLocation),
            'profile_photo_url' => $rider->user?->profile_photo_url,
        ];
    }

    public function order(DeliveryOrder $order, bool $detail = false): array
    {
        $order->loadMissing(['rider.latestLocation', 'payments', 'customer', 'shop', 'clientUser']);
        $nextAction = self::NEXT_ACTIONS[$order->status] ?? null;

        $payload = [
            'id' => $order->id,
            'code' => $order->code,
            'status' => $order->status,
            'status_label' => $this->label($order->status),
            'is_history' => in_array($order->status, self::HISTORY_STATUSES, true),
            'next_action' => $nextAction,
            'can_report_issue' => ! in_array($order->status, ['delivered', 'completed', 'failed', 'cancelled'], true),
            'created_at' => $this->iso($order->created_at),
            'updated_at' => $this->iso($order->updated_at),
            'assigned_at' => $this->iso($order->assigned_at),
            'picked_up_at' => $this->iso($order->picked_up_at),
            'delivered_at' => $this->iso($order->delivered_at),
            'completed_at' => $this->iso($order->completed_at),
            'client' => [
                'name' => $order->clientUser?->name ?: $order->client_name,
                'phone' => $order->clientUser?->phone ?: $order->client_phone,
                'email' => $order->clientUser?->email,
            ],
            'pickup' => [
                'contact_name' => $order->pickup_contact_name,
                'phone' => $order->pickup_phone,
                'address' => $order->pickup_address,
                'latitude' => $order->pickup_latitude !== null ? (float) $order->pickup_latitude : null,
                'longitude' => $order->pickup_longitude !== null ? (float) $order->pickup_longitude : null,
                'phone_uri' => $this->phoneUri($order->pickup_phone),
                'map_uri' => $this->mapUri($order->pickup_address),
            ],
            'delivery' => [
                'receiver_name' => $order->receiver_name,
                'receiver_phone' => $order->receiver_phone,
                'address' => $order->receiver_address,
                'latitude' => $order->receiver_latitude !== null ? (float) $order->receiver_latitude : null,
                'longitude' => $order->receiver_longitude !== null ? (float) $order->receiver_longitude : null,
                'phone_uri' => $this->phoneUri($order->receiver_phone),
                'map_uri' => $this->mapUri($order->receiver_address),
            ],
            'package' => [
                'name' => $order->product_name,
                'category' => $order->product_category ?: 'Package',
                'quantity' => (int) $order->quantity,
                'is_fragile' => (bool) $order->is_fragile,
                'note' => $order->client_note ?: $order->special_handling_note,
            ],
            'money' => [
                'delivery_fee' => (float) $order->delivery_fee,
                'delivery_fee_payment_method' => $order->delivery_fee_payment_method,
                'payment_status' => $order->payment_status,
                'product_payment_method' => $order->product_payment_method,
                'cod_enabled' => $order->product_payment_method === 'rider_collects',
                'cod_amount' => (float) $order->cod_amount,
            ],
            'rider' => $order->rider ? $this->rider($order->rider) : null,
        ];

        if ($detail) {
            $order->loadMissing(['statusHistories', 'cashCollection']);
            $payload['status_history'] = $order->statusHistories
                ->sortByDesc('created_at')
                ->values()
                ->map(fn ($history) => [
                    'id' => $history->id,
                    'status' => $history->status,
                    'status_label' => $this->label($history->status),
                    'actor_type' => $history->actor_type,
                    'note' => $history->note,
                    'created_at' => $this->iso($history->created_at),
                ])
                ->all();
            $payload['cash_collection'] = $order->cashCollection ? [
                'delivery_fee_collected' => (float) $order->cashCollection->delivery_fee_collected,
                'product_cash_collected' => (float) $order->cashCollection->product_cash_collected,
                'total_cash_collected' => (float) $order->cashCollection->total_cash_collected,
            ] : null;
        }

        return $payload;
    }

    public function location(?RiderLocation $location): ?array
    {
        if (! $location) {
            return null;
        }

        return [
            'id' => $location->id,
            'delivery_order_id' => $location->delivery_order_id,
            'latitude' => (float) $location->latitude,
            'longitude' => (float) $location->longitude,
            'accuracy' => $location->accuracy !== null ? (float) $location->accuracy : null,
            'speed' => $location->speed !== null ? (float) $location->speed : null,
            'heading' => $location->heading !== null ? (float) $location->heading : null,
            'battery_percent' => $location->battery_percent !== null ? (int) $location->battery_percent : null,
            'source' => $location->source ?: 'native',
            'recorded_at' => $this->iso($location->recorded_at),
            'freshness' => $location->freshness,
            'is_stale' => (bool) $location->is_stale,
        ];
    }

    public function notification(DatabaseNotification $notification): array
    {
        $data = $notification->data ?: [];

        return [
            'id' => $notification->id,
            'title' => $data['title'] ?? 'Delivery update',
            'body' => $data['body'] ?? '',
            'kind' => $data['kind'] ?? 'activity',
            'order_id' => $data['order_id'] ?? null,
            'order_code' => $data['order_code'] ?? '',
            'status' => $data['status'] ?? null,
            'read_at' => $this->iso($notification->read_at),
            'created_at' => $this->iso($notification->created_at),
            'data' => $data,
        ];
    }

    public function summary(Rider $rider, User $user): array
    {
        $activeStatuses = ['completed', 'failed', 'cancelled'];

        $activeJobs = $rider->deliveryOrders()
            ->whereNotIn('status', $activeStatuses)
            ->count();
        $historyJobs = $rider->deliveryOrders()
            ->whereIn('status', $activeStatuses)
            ->count();
        $completedJobs = $rider->deliveryOrders()
            ->where('status', 'completed')
            ->count();
        $deliveryFees = $rider->deliveryOrders()
            ->where('status', 'completed')
            ->sum('delivery_fee');

        return [
            'active_jobs' => $activeJobs,
            'history_jobs' => $historyJobs,
            'completed_jobs' => $completedJobs,
            'delivery_fees_total' => (float) $deliveryFees,
            'cash_held' => (float) $rider->cash_held,
            'unread_notifications' => $user->unreadNotifications()->count(),
        ];
    }

    private function label(?string $value): string
    {
        return str($value ?: '')
            ->replace('_', ' ')
            ->title()
            ->toString();
    }

    private function initials(string $name): string
    {
        return str(collect(explode(' ', $name))
            ->filter()
            ->map(fn (string $part) => $part[0])
            ->implode(''))
            ->upper()
            ->toString();
    }

    private function iso($date): ?string
    {
        return $date?->toIso8601String();
    }

    private function phoneUri(?string $phone): ?string
    {
        if (! $phone) {
            return null;
        }

        $normalized = preg_replace('/[^\d+]/', '', $phone);

        return $normalized ? "tel:{$normalized}" : null;
    }

    private function mapUri(?string $address): ?string
    {
        return $address
            ? 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($address)
            : null;
    }
}
