<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class FirebaseCloudMessaging
{
    public function enabled(): bool
    {
        return filter_var(config('services.firebase.push_enabled'), FILTER_VALIDATE_BOOL)
            && filled(config('services.firebase.project_id'))
            && filled(config('services.firebase.client_email'))
            && filled(config('services.firebase.private_key'));
    }

    public function sendToTokens(iterable $tokens, array $message): void
    {
        if (! $this->enabled()) {
            Log::warning('[firebase] push_send_skipped', [
                'reason' => 'disabled_or_unconfigured',
                'push_enabled' => filter_var(config('services.firebase.push_enabled'), FILTER_VALIDATE_BOOL),
                'has_project_id' => filled(config('services.firebase.project_id')),
                'has_client_email' => filled(config('services.firebase.client_email')),
                'has_private_key' => filled(config('services.firebase.private_key')),
            ]);

            return;
        }

        try {
            $accessToken = $this->accessToken();
        } catch (Throwable $exception) {
            Log::error('[firebase] access_token_failed', [
                'message' => $exception->getMessage(),
                'project_id' => config('services.firebase.project_id'),
            ]);

            return;
        }

        $projectId = config('services.firebase.project_id');
        $endpoint = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        foreach (collect($tokens)->filter()->unique() as $token) {
            try {
                $response = Http::withToken($accessToken)
                    ->timeout((int) config('services.firebase.timeout', 5))
                    ->post($endpoint, [
                        'message' => $this->payload($token, $message),
                    ]);
            } catch (Throwable $exception) {
                Log::error('[firebase] push_send_exception', [
                    'message' => $exception->getMessage(),
                    'token_hash' => hash('sha256', $token),
                    'project_id' => $projectId,
                ]);

                continue;
            }

            if ($response->successful()) {
                Log::info('[firebase] push_send_success', [
                    'token_hash' => hash('sha256', $token),
                    'project_id' => $projectId,
                    'title' => $message['title'] ?? config('app.name'),
                ]);

                continue;
            }

            Log::warning('[firebase] push_send_failed', [
                'status' => $response->status(),
                'body' => $response->json(),
                'token_hash' => hash('sha256', $token),
                'project_id' => $projectId,
            ]);

            if (in_array($response->status(), [400, 404], true)) {
                PushSubscription::query()->where('token', $token)->delete();
            }
        }
    }

    private function payload(string $token, array $message): array
    {
        $data = collect($message['data'] ?? [])
            ->map(fn ($value) => is_scalar($value) || $value === null ? (string) $value : json_encode($value))
            ->all();
        $link = $message['link'] ?? url('/client');
        $title = $message['title'] ?? config('app.name');
        $body = $message['body'] ?? '';

        return [
            'token' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body,
            ],
            'data' => $data + [
                'title' => $title,
                'body' => $body,
                'link' => $link,
                'icon' => url('/pwa-icon-192.png'),
            ],
            'webpush' => [
                'fcm_options' => [
                    'link' => $link,
                ],
                'notification' => [
                    'icon' => url('/pwa-icon-192.png'),
                    'badge' => url('/pwa-icon-192.png'),
                    'tag' => $data['notification_id'] ?? $data['order_id'] ?? null,
                    'renotify' => false,
                ],
            ],
        ];
    }

    private function accessToken(): string
    {
        return Cache::remember('firebase.messaging.access_token', 3300, function () {
            $response = Http::asForm()
                ->timeout((int) config('services.firebase.timeout', 5))
                ->post('https://oauth2.googleapis.com/token', [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $this->serviceAccountJwt(),
                ]);

            $response->throw();

            return $response->json('access_token');
        });
    }

    private function serviceAccountJwt(): string
    {
        $now = time();
        $header = $this->base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claims = $this->base64UrlEncode(json_encode([
            'iss' => config('services.firebase.client_email'),
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ]));
        $unsigned = "{$header}.{$claims}";
        $privateKey = str_replace('\n', "\n", (string) config('services.firebase.private_key'));

        if (! openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('Unable to sign Firebase service account JWT.');
        }

        return "{$unsigned}.{$this->base64UrlEncode($signature)}";
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
