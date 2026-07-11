<?php

namespace App\Notifications;

use App\Notifications\Channels\FirebasePushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class BroadcastPushNotification extends Notification
{
    use Queueable;

    public function __construct(
        private string $topic,
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
            'kind' => 'broadcast',
            'topic' => $this->topic,
            'title' => $this->title,
            'body' => $this->body,
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
