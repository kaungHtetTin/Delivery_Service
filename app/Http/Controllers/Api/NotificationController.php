<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\User;
use App\Notifications\BroadcastPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        return response()->json($subscription);
    }

    public function destroyPushSubscription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        $request->user()
            ->pushSubscriptions()
            ->where('token', $validated['token'])
            ->delete();

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
}
