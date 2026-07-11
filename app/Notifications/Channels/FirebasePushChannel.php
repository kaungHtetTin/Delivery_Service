<?php

namespace App\Notifications\Channels;

use App\Services\FirebaseCloudMessaging;
use Illuminate\Notifications\Notification;

class FirebasePushChannel
{
    public function __construct(private FirebaseCloudMessaging $messaging)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toFirebase')) {
            return;
        }

        $tokens = $notifiable
            ->pushSubscriptions()
            ->pluck('token');

        if ($tokens->isEmpty()) {
            return;
        }

        $this->messaging->sendToTokens($tokens, $notification->toFirebase($notifiable));
    }
}
