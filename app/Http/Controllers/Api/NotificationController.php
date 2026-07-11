<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\User;
use App\Notifications\BroadcastPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json($notifications);
    }

    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        $record = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        $record->markAsRead();

        return response()->json($record->fresh());
    }

    public function storePushSubscription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
            'platform' => ['nullable', 'string', 'max:30'],
        ]);

        $subscription = PushSubscription::query()->updateOrCreate(
            ['token' => $validated['token']],
            [
                'user_id' => $request->user()->id,
                'platform' => $validated['platform'] ?? 'web',
                'user_agent' => $request->userAgent(),
                'last_seen_at' => now(),
            ]
        );

        Log::info('[firebase] push_subscription_saved', [
            'user_id' => $request->user()->id,
            'role' => $request->user()->role,
            'subscription_id' => $subscription->id,
            'token_hash' => hash('sha256', $validated['token']),
            'platform' => $subscription->platform,
        ]);

        return response()->json($subscription);
    }

    public function destroyPushSubscription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        $deleted = $request->user()
            ->pushSubscriptions()
            ->where('token', $validated['token'])
            ->delete();

        Log::info('[firebase] push_subscription_removed', [
            'user_id' => $request->user()->id,
            'role' => $request->user()->role,
            'token_hash' => hash('sha256', $validated['token']),
            'deleted' => $deleted,
        ]);

        return response()->json(['message' => 'Push subscription removed.']);
    }

    public function broadcast(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'audience' => ['required', 'in:clients,riders,clients_riders'],
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:500'],
        ]);
        $roles = match ($validated['audience']) {
            'clients' => [User::ROLE_CLIENT],
            'riders' => [User::ROLE_RIDER],
            default => [User::ROLE_CLIENT, User::ROLE_RIDER],
        };
        $users = User::query()
            ->whereIn('role', $roles)
            ->get();
        $notification = new BroadcastPushNotification(
            $validated['audience'],
            $validated['title'],
            $validated['body'],
            [
                'sent_by' => $request->user()->id,
                'sent_by_name' => $request->user()->name,
                'target_roles' => $roles,
            ]
        );

        $users->each(fn (User $user) => $user->notify($notification));

        return response()->json([
            'message' => 'Broadcast notification queued.',
            'audience' => $validated['audience'],
            'target_count' => $users->count(),
            'push_subscription_count' => PushSubscription::query()
                ->whereIn('user_id', $users->pluck('id'))
                ->count(),
        ]);
    }

    public function pushLogs(Request $request): JsonResponse
    {
        $limit = min(max($request->integer('limit', 100), 1), 300);
        $entries = [];

        foreach ($this->logFiles() as $file) {
            foreach (array_reverse(file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []) as $line) {
                if (! str_contains($line, '[firebase]')) {
                    continue;
                }

                $entries[] = $this->parseLogLine($line, $file);

                if (count($entries) >= $limit) {
                    break 2;
                }
            }
        }

        return response()->json([
            'data' => $entries,
            'summary' => [
                'push_enabled' => filter_var(config('services.firebase.push_enabled'), FILTER_VALIDATE_BOOL),
                'has_project_id' => filled(config('services.firebase.project_id')),
                'has_client_email' => filled(config('services.firebase.client_email')),
                'has_private_key' => filled(config('services.firebase.private_key')),
                'subscriptions' => PushSubscription::query()->count(),
                'subscriptions_by_role' => PushSubscription::query()
                    ->join('users', 'users.id', '=', 'push_subscriptions.user_id')
                    ->selectRaw('users.role, count(*) as total')
                    ->groupBy('users.role')
                    ->pluck('total', 'users.role'),
            ],
        ]);
    }

    private function logFiles(): array
    {
        return collect(File::glob(storage_path('logs/laravel*.log')) ?: [])
            ->filter(fn (string $file) => File::isFile($file))
            ->sortByDesc(fn (string $file) => File::lastModified($file))
            ->values()
            ->all();
    }

    private function parseLogLine(string $line, string $file): array
    {
        $entry = [
            'timestamp' => null,
            'environment' => null,
            'level' => null,
            'message' => $line,
            'context' => null,
            'file' => basename($file),
        ];

        if (! preg_match('/^\[(?<timestamp>[^\]]+)\]\s+(?<environment>[^.]+)\.(?<level>[^:]+):\s+(?<body>.*)$/', $line, $matches)) {
            return $entry;
        }

        $body = $matches['body'];
        $context = null;

        if (preg_match('/^(?<message>.*?)\s+(?<context>\{.*\})$/', $body, $bodyMatches)) {
            $decoded = json_decode($bodyMatches['context'], true);

            if (json_last_error() === JSON_ERROR_NONE) {
                $body = $bodyMatches['message'];
                $context = $decoded;
            }
        }

        return [
            'timestamp' => $matches['timestamp'],
            'environment' => $matches['environment'],
            'level' => strtolower($matches['level']),
            'message' => $body,
            'context' => $context,
            'file' => basename($file),
        ];
    }
}
