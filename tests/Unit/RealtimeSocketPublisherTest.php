<?php

namespace Tests\Unit;

use App\Services\RealtimeSocketPublisher;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RealtimeSocketPublisherTest extends TestCase
{
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
}
