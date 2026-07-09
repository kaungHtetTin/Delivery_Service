<?php

namespace Tests\Unit;

use App\Models\DeliveryOrder;
use App\Models\Rider;
use App\Models\User;
use App\Services\RealtimeSocketPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RealtimeSocketPublisherTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_posts_events_to_the_socket_server(): void
    {
        config()->set('services.socket_server.enabled', true);
        config()->set('services.socket_server.url', 'http://socket.test');
        config()->set('services.socket_server.key', 'test-key');

        Http::fake([
            'socket.test/events' => Http::response([
                'ok' => true,
                'event' => 'order:updated',
                'rooms' => ['office'],
            ]),
        ]);

        app(RealtimeSocketPublisher::class)->publish('order.updated', [
            'order_id' => 12,
        ]);

        Http::assertSent(function ($request) {
            return $request->url() === 'http://socket.test/events'
                && $request->hasHeader('X-Socket-Server-Key', 'test-key')
                && $request['type'] === 'order.updated'
                && $request['data']['order_id'] === 12;
        });
    }

    public function test_it_does_not_throw_when_socket_server_is_unavailable(): void
    {
        config()->set('services.socket_server.enabled', true);
        config()->set('services.socket_server.url', 'http://socket.test');
        config()->set('services.socket_server.key', 'test-key');

        Http::fake(function () {
            throw new ConnectionException('Connection refused.');
        });

        app(RealtimeSocketPublisher::class)->publish('order.updated', [
            'order_id' => 12,
        ]);

        $this->assertTrue(true);
    }

    public function test_rider_location_payload_is_hidden_from_client_before_pickup(): void
    {
        config()->set('services.socket_server.enabled', true);
        config()->set('services.socket_server.url', 'http://socket.test');
        config()->set('services.socket_server.key', 'test-key');

        $rider = Rider::create([
            'code' => 'R-SOCKET-HIDDEN',
            'name' => 'Socket Hidden Rider',
            'phone' => '09 111 222 551',
            'status' => 'busy',
        ]);
        $client = $this->createClientUser('hidden-client@example.test');
        $order = DeliveryOrder::create($this->orderPayload() + [
            'client_user_id' => $client->id,
            'rider_id' => $rider->id,
            'status' => 'rider_accepted',
        ]);
        $location = $rider->locations()->create([
            'delivery_order_id' => $order->id,
            'latitude' => 16.840939,
            'longitude' => 96.173526,
            'recorded_at' => now(),
        ]);

        Http::fake(['socket.test/events' => Http::response(['ok' => true])]);

        app(RealtimeSocketPublisher::class)->riderLocationUpdated($location);

        Http::assertSent(function ($request) {
            return $request['type'] === 'rider.location.updated'
                && $request['data']['client_tracking_visible'] === false
                && $request['data']['client_user_id'] === null;
        });
    }

    public function test_rider_location_payload_is_visible_to_client_after_pickup(): void
    {
        config()->set('services.socket_server.enabled', true);
        config()->set('services.socket_server.url', 'http://socket.test');
        config()->set('services.socket_server.key', 'test-key');

        $rider = Rider::create([
            'code' => 'R-SOCKET-VISIBLE',
            'name' => 'Socket Visible Rider',
            'phone' => '09 111 222 552',
            'status' => 'busy',
        ]);
        $client = $this->createClientUser('visible-client@example.test');
        $order = DeliveryOrder::create($this->orderPayload() + [
            'client_user_id' => $client->id,
            'rider_id' => $rider->id,
            'status' => 'picked_up',
        ]);
        $location = $rider->locations()->create([
            'delivery_order_id' => $order->id,
            'latitude' => 16.840939,
            'longitude' => 96.173526,
            'recorded_at' => now(),
        ]);

        Http::fake(['socket.test/events' => Http::response(['ok' => true])]);

        app(RealtimeSocketPublisher::class)->riderLocationUpdated($location);

        Http::assertSent(function ($request) use ($client) {
            return $request['type'] === 'rider.location.updated'
                && $request['data']['client_tracking_visible'] === true
                && (int) $request['data']['client_user_id'] === (int) $client->id;
        });
    }

    private function createClientUser(string $email): User
    {
        return User::create([
            'name' => 'Socket Client',
            'email' => $email,
            'phone' => '09 ' . random_int(100, 999) . ' ' . random_int(100, 999) . ' ' . random_int(100, 999),
            'password' => bcrypt('password'),
            'role' => User::ROLE_CLIENT,
        ]);
    }

    private function orderPayload(): array
    {
        return [
            'client_name' => 'Socket Client',
            'client_phone' => '09 111 222 553',
            'pickup_contact_name' => 'Socket Pickup',
            'pickup_phone' => '09 111 222 554',
            'pickup_address' => 'Pickup Street',
            'receiver_name' => 'Socket Receiver',
            'receiver_phone' => '09 111 222 555',
            'receiver_address' => 'Receiver Street',
            'product_name' => 'Parcel',
            'quantity' => 1,
            'delivery_fee_payment_method' => 'cash',
            'product_payment_method' => 'already_paid',
            'delivery_fee' => 0,
        ];
    }
}
