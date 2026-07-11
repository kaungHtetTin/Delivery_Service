<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class SystemHealthController extends Controller
{
    public function show(): JsonResponse
    {
        $socket = $this->socketHealth();
        $firebase = $this->firebaseHealth();

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'overall' => $this->overallStatus([$socket, $firebase]),
            'laravel' => $this->laravelHealth(),
            'socket' => $socket,
            'firebase' => $firebase,
        ]);
    }

    private function laravelHealth(): array
    {
        return [
            'status' => 'ok',
            'app_url' => config('app.url'),
            'environment' => app()->environment(),
            'debug' => (bool) config('app.debug'),
            'config_cached' => app()->configurationIsCached(),
            'routes_cached' => app()->routesAreCached(),
            'queue_connection' => config('queue.default'),
            'cache_driver' => config('cache.default'),
        ];
    }

    private function socketHealth(): array
    {
        $enabled = filter_var(config('services.socket_server.enabled'), FILTER_VALIDATE_BOOL);
        $url = rtrim((string) config('services.socket_server.url'), '/');
        $hasKey = filled(config('services.socket_server.key'));
        $hasAuthSecret = filled(config('services.socket_server.auth_secret'));
        $timeout = (float) config('services.socket_server.timeout', 2);
        $checks = [
            'enabled' => $enabled,
            'has_url' => $url !== '',
            'has_internal_key' => $hasKey,
            'has_auth_secret' => $hasAuthSecret,
        ];
        $live = [
            'checked' => false,
            'ok' => false,
            'status' => null,
            'latency_ms' => null,
            'message' => $enabled ? 'Socket server health check was not run.' : 'Socket server is disabled.',
            'data' => null,
        ];

        if ($enabled && $url !== '') {
            $started = microtime(true);

            try {
                $response = Http::timeout($timeout)->acceptJson()->get("{$url}/health");
                $live = [
                    'checked' => true,
                    'ok' => $response->successful() && $response->json('ok') === true,
                    'status' => $response->status(),
                    'latency_ms' => (int) round((microtime(true) - $started) * 1000),
                    'message' => $response->successful() ? 'Socket health endpoint responded.' : 'Socket health endpoint returned an error.',
                    'data' => $response->json(),
                ];
            } catch (Throwable $exception) {
                $live = [
                    'checked' => true,
                    'ok' => false,
                    'status' => null,
                    'latency_ms' => (int) round((microtime(true) - $started) * 1000),
                    'message' => $exception->getMessage(),
                    'data' => null,
                ];
            }
        }

        $ready = $enabled && $url !== '' && $hasKey && $hasAuthSecret && ($live['checked'] ? $live['ok'] : true);

        return [
            'status' => $ready ? 'ok' : ($enabled ? 'warning' : 'disabled'),
            'ready' => $ready,
            'url' => $url,
            'timeout' => $timeout,
            'checks' => $checks,
            'live' => $live,
        ];
    }

    private function firebaseHealth(): array
    {
        $pushEnabled = filter_var(config('services.firebase.push_enabled'), FILTER_VALIDATE_BOOL);
        $publicConfig = (array) config('services.firebase.public', []);
        $publicChecks = [
            'has_api_key' => filled($publicConfig['apiKey'] ?? null),
            'has_auth_domain' => filled($publicConfig['authDomain'] ?? null),
            'has_project_id' => filled($publicConfig['projectId'] ?? null),
            'has_storage_bucket' => filled($publicConfig['storageBucket'] ?? null),
            'has_sender_id' => filled($publicConfig['messagingSenderId'] ?? null),
            'has_app_id' => filled($publicConfig['appId'] ?? null),
            'has_vapid_key' => filled(config('services.firebase.vapid_key')),
        ];
        $adminChecks = [
            'push_enabled' => $pushEnabled,
            'has_project_id' => filled(config('services.firebase.project_id')),
            'has_client_email' => filled(config('services.firebase.client_email')),
            'has_private_key' => filled(config('services.firebase.private_key')),
        ];
        $serviceWorker = [
            'url' => url('/firebase-messaging-sw.js'),
            'has_public_config' => collect($publicChecks)->every(fn ($ready) => $ready),
        ];
        $subscriptionsByRole = PushSubscription::query()
            ->join('users', 'users.id', '=', 'push_subscriptions.user_id')
            ->selectRaw('users.role, count(*) as total')
            ->groupBy('users.role')
            ->pluck('total', 'users.role');
        $lastSuccess = $this->latestFirebaseLog('[firebase] push_send_success');
        $lastFailure = $this->latestFirebaseLog('[firebase] push_send_failed')
            ?? $this->latestFirebaseLog('[firebase] push_send_exception')
            ?? $this->latestFirebaseLog('[firebase] access_token_failed');
        $accessTokenCached = Cache::has('firebase.messaging.access_token');
        $adminReady = collect($adminChecks)->every(fn ($ready) => $ready);
        $publicReady = collect($publicChecks)->every(fn ($ready) => $ready);
        $ready = $adminReady && $publicReady;

        return [
            'status' => $ready ? 'ok' : ($pushEnabled ? 'warning' : 'disabled'),
            'ready' => $ready,
            'project_id' => config('services.firebase.project_id') ?: ($publicConfig['projectId'] ?? null),
            'admin' => [
                'ready' => $adminReady,
                'checks' => $adminChecks,
            ],
            'web' => [
                'ready' => $publicReady,
                'checks' => $publicChecks,
                'service_worker' => $serviceWorker,
            ],
            'access_token_cached' => $accessTokenCached,
            'subscriptions' => [
                'total' => PushSubscription::query()->count(),
                'by_role' => $subscriptionsByRole,
                'recent_24h' => PushSubscription::query()->where('last_seen_at', '>=', now()->subDay())->count(),
            ],
            'last_success' => $lastSuccess,
            'last_failure' => $lastFailure,
        ];
    }

    private function latestFirebaseLog(string $needle): ?array
    {
        foreach (glob(storage_path('logs/laravel*.log')) ?: [] as $file) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];

            foreach (array_reverse($lines) as $line) {
                if (! str_contains($line, $needle)) {
                    continue;
                }

                return [
                    'message' => $needle,
                    'line' => str($line)->limit(260)->toString(),
                    'file' => basename($file),
                ];
            }
        }

        return null;
    }

    private function overallStatus(array $sections): string
    {
        if (collect($sections)->every(fn ($section) => ($section['status'] ?? null) === 'ok')) {
            return 'ok';
        }

        if (collect($sections)->contains(fn ($section) => ($section['status'] ?? null) === 'disabled')) {
            return 'warning';
        }

        return 'warning';
    }
}
