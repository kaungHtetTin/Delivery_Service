<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirebaseCloudMessaging
{
    public function enabled(): bool
    {
        return (bool) config('services.firebase.push_enabled')
            && filled(config('services.firebase.project_id'))
            && filled(config('services.firebase.client_email'))
            && filled(config('services.firebase.private_key'));
    }

    public function sendToTokens(iterable $tokens, array $message): void
    {
        if (! $this->enabled()) {
            return;
        }

        $accessToken = $this->accessToken();
        $projectId = config('services.firebase.project_id');
        $endpoint = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        foreach (collect($tokens)->filter()->unique() as $token) {
            $response = Http::withToken($accessToken)
                ->timeout((int) config('services.firebase.timeout', 5))
                ->post($endpoint, [
                    'message' => $this->payload($token, $message),
                ]);

            if ($response->successful()) {
                continue;
            }

            Log::warning('[firebase] push_send_failed', [
                'status' => $response->status(),
                'body' => $response->json(),
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

        return [
            'token' => $token,
            'notification' => [
                'title' => $message['title'] ?? config('app.name'),
                'body' => $message['body'] ?? '',
            ],
            'data' => $data + [
                'title' => $message['title'] ?? config('app.name'),
                'body' => $message['body'] ?? '',
                'link' => $link,
            ],
            'webpush' => [
                'fcm_options' => [
                    'link' => $link,
                ],
                'notification' => [
                    'icon' => url('/pwa-icon-192.png'),
                    'badge' => url('/pwa-icon-192.png'),
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
