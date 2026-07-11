<?php

namespace App\Notifications\Channels;

use App\Services\FirebaseCloudMessaging;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class FirebasePushChannel
{
    public function __construct(private FirebaseCloudMessaging $messaging)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toFirebase')) {
            Log::info('[firebase] push_channel_skipped', [
                'reason' => 'missing_toFirebase',
                'notification' => $notification::class,
                'notifiable_id' => $notifiable->id ?? null,
                'notifiable_role' => $notifiable->role ?? null,
            ]);

            return;
        }

        $tokens = $notifiable
            ->pushSubscriptions()
            ->pluck('token');

        if ($tokens->isEmpty()) {
            Log::info('[firebase] push_channel_skipped', [
                'reason' => 'no_push_tokens',
                'notification' => $notification::class,
                'notifiable_id' => $notifiable->id ?? null,
                'notifiable_role' => $notifiable->role ?? null,
            ]);

            return;
        }

        Log::info('[firebase] push_channel_sending', [
            'notification' => $notification::class,
            'notifiable_id' => $notifiable->id ?? null,
            'notifiable_role' => $notifiable->role ?? null,
            'token_count' => $tokens->count(),
        ]);

        $this->messaging->sendToTokens($tokens, $notification->toFirebase($notifiable));
    }
}
