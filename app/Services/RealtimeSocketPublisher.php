<?php

namespace App\Services;

use App\Models\CashCollection;
use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\RiderLocation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class RealtimeSocketPublisher
{
    public function publish(string $type, array $data = [], array $recipients = []): void
    {
        if (! config('services.socket_server.enabled')) {
            Log::debug('realtime_publish_skipped', [
                'type' => $type,
                'reason' => 'disabled',
            ]);

            return;
        }

        $url = rtrim((string) config('services.socket_server.url'), '/');
        $key = (string) config('services.socket_server.key');

        if ($url === '' || $key === '') {
            Log::warning('realtime_publish_skipped', [
                'type' => $type,
                'reason' => 'missing_socket_server_config',
                'has_url' => $url !== '',
                'has_key' => $key !== '',
            ]);

            return;
        }

        try {
            $response = Http::timeout((float) config('services.socket_server.timeout', 2))
                ->withHeaders(['X-Socket-Server-Key' => $key])
                ->post("{$url}/events", [
                    'type' => $type,
                    'data' => $data,
                    'recipients' => $recipients,
                ]);

            if ($response->successful()) {
                Log::info('realtime_publish_success', [
                    'type' => $type,
                    'event' => $response->json('event'),
                    'rooms' => $response->json('rooms'),
                ]);

                return;
            }

            Log::warning('realtime_publish_failed', [
                'type' => $type,
                'status' => $response->status(),
                'body' => $response->json() ?? $response->body(),
            ]);
        } catch (Throwable $exception) {
            Log::warning('realtime_publish_unavailable', [
                'type' => $type,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function orderCreated(DeliveryOrder $order): void
    {
        $this->publish('order.created', $this->orderPayload($order));
    }

    public function orderUpdated(DeliveryOrder $order): void
    {
        $this->publish('order.updated', $this->orderPayload($order));
    }

    public function orderDeleted(int $orderId, array $snapshot): void
    {
        $this->publish('order.deleted', array_merge([
            'id' => $orderId,
            'order_id' => $orderId,
        ], $snapshot), [
            'order_id' => $orderId,
            'client_user_id' => $snapshot['client_user_id'] ?? null,
            'rider_id' => $snapshot['rider_id'] ?? null,
        ]);
    }

    public function orderAssigned(DeliveryOrder $order): void
    {
        $this->publish('order.assigned', $this->orderPayload($order));
    }

    public function orderStatusUpdated(DeliveryOrder $order): void
    {
        $this->publish('order.status.updated', $this->orderPayload($order));
    }

    public function paymentUpdated(Payment $payment): void
    {
        $payment->loadMissing('deliveryOrder.rider');
        $order = $payment->deliveryOrder;

        $this->publish('payment.updated', [
            'id' => $payment->id,
            'payment_id' => $payment->id,
            'delivery_order_id' => $payment->delivery_order_id,
            'order_id' => $payment->delivery_order_id,
            'type' => $payment->type,
            'method' => $payment->method,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'client_user_id' => $order?->client_user_id,
            'rider_id' => $order?->rider_id,
        ]);
    }

    public function paymentDeleted(int $paymentId, array $snapshot): void
    {
        $this->publish('payment.deleted', array_merge([
            'id' => $paymentId,
            'payment_id' => $paymentId,
            'order_id' => $snapshot['delivery_order_id'] ?? null,
        ], $snapshot), [
            'order_id' => $snapshot['delivery_order_id'] ?? null,
        ]);
    }

    public function cashCollectionUpdated(CashCollection $collection): void
    {
        $collection->loadMissing('deliveryOrder');
        $order = $collection->deliveryOrder;

        $this->publish('cash.collection.updated', [
            'id' => $collection->id,
            'cash_collection_id' => $collection->id,
            'delivery_order_id' => $collection->delivery_order_id,
            'order_id' => $collection->delivery_order_id,
            'rider_id' => $collection->rider_id,
            'client_user_id' => $order?->client_user_id,
            'delivery_fee_collected' => $collection->delivery_fee_collected,
            'total_cash_collected' => $collection->total_cash_collected,
        ]);
    }

    public function riderLocationUpdated(RiderLocation $location): void
    {
        $location->loadMissing('rider', 'deliveryOrder');
        $order = $location->deliveryOrder;
        $clientTrackingVisible = $order
            && (int) $order->rider_id === (int) $location->rider_id
            && in_array($order->status, ['picked_up', 'going_to_delivery', 'arrived_at_delivery', 'delivered'], true);

        $this->publish('rider.location.updated', [
            'id' => $location->id,
            'rider_id' => $location->rider_id,
            'delivery_order_id' => $location->delivery_order_id,
            'order_id' => $location->delivery_order_id,
            'client_user_id' => $clientTrackingVisible ? $order?->client_user_id : null,
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'accuracy' => $location->accuracy,
            'speed' => $location->speed,
            'heading' => $location->heading,
            'battery_percent' => $location->battery_percent,
            'source' => $location->source,
            'freshness' => $location->freshness,
            'is_stale' => $location->is_stale,
            'client_tracking_visible' => (bool) $clientTrackingVisible,
            'recorded_at' => $location->recorded_at,
            'user_id' => $location->rider?->user_id,
        ]);
    }

    private function orderPayload(DeliveryOrder $order): array
    {
        $order->loadMissing('rider');

        return [
            'id' => $order->id,
            'order_id' => $order->id,
            'code' => $order->code,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'client_user_id' => $order->client_user_id,
            'rider_id' => $order->rider_id,
            'rider_user_id' => $order->rider?->user_id,
            'updated_at' => $order->updated_at?->toIso8601String(),
        ];
    }
}
