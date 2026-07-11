<?php

namespace Tests\Unit;

use App\Services\FirebaseCloudMessaging;
use ReflectionMethod;
use Tests\TestCase;

class FirebaseCloudMessagingTest extends TestCase
{
    public function test_web_push_payload_includes_visible_notification_for_safari(): void
    {
        config()->set('app.name', 'FlowDrop Test');

        $payloadMethod = new ReflectionMethod(FirebaseCloudMessaging::class, 'payload');
        $payloadMethod->setAccessible(true);

        $payload = $payloadMethod->invoke(app(FirebaseCloudMessaging::class), 'token-123', [
            'title' => 'Rider assigned',
            'body' => 'A rider has been assigned.',
            'link' => url('/client'),
            'data' => [
                'kind' => 'status_updated',
                'order_id' => 42,
            ],
        ]);

        $this->assertSame('Rider assigned', $payload['notification']['title']);
        $this->assertSame('A rider has been assigned.', $payload['notification']['body']);
        $this->assertSame(url('/pwa-icon-192.png'), $payload['webpush']['notification']['icon']);
        $this->assertFalse($payload['webpush']['notification']['renotify']);
        $this->assertSame('Rider assigned', $payload['data']['title']);
        $this->assertSame('A rider has been assigned.', $payload['data']['body']);
        $this->assertSame('42', $payload['data']['order_id']);
    }
}
