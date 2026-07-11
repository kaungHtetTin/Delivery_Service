<?php

namespace App\Notifications;

use App\Models\DeliveryOrder;
use App\Notifications\Channels\FirebasePushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OrderActivityNotification extends Notification
{
    use Queueable;

    public function __construct(
        private DeliveryOrder $order,
        private string $kind,
        private string $title,
        private string $body,
        private array $meta = []
    ) {
    }

    public function via($notifiable): array
    {
        $channels = ['database'];

        if (config('services.firebase.push_enabled')) {
            $channels[] = FirebasePushChannel::class;
        }

        return $channels;
    }

    public function toArray($notifiable): array
    {
        return [
            'kind' => $this->kind,
            'title' => $this->title,
            'body' => $this->body,
            'order_id' => $this->order->id,
            'order_code' => $this->order->code,
            'status' => $this->order->status,
        ] + $this->meta;
    }

    public function toFirebase($notifiable): array
    {
        $link = match ($notifiable->role ?? null) {
            'rider' => url('/rider'),
            'office_admin', 'super_admin' => url('/office'),
            default => url('/client'),
        };

        return [
            'title' => $this->title,
            'body' => $this->body,
            'link' => $link,
            'data' => $this->toArray($notifiable) + [
                'portal' => ltrim(parse_url($link, PHP_URL_PATH) ?: '/client', '/'),
            ],
        ];
    }
}
