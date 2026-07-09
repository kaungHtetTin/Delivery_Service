<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryOrder;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RealtimeTokenController extends Controller
{
    private const TERMINAL_ORDER_STATUSES = ['completed', 'failed', 'cancelled'];

    public function show(Request $request): JsonResponse
    {
        $secret = (string) config('services.socket_server.auth_secret');

        if ($secret === '') {
            return response()->json([
                'message' => 'Realtime socket auth is not configured.',
            ], 503);
        }

        $payload = $this->payloadForUser($request->user());
        $expiresAt = now()->addSeconds((int) config('services.socket_server.token_ttl', 3600))->timestamp;
        $signedPayload = array_merge($payload, ['exp' => $expiresAt]);

        return response()->json([
            'token' => $this->sign($signedPayload, $secret),
            'expires_at' => $expiresAt,
            'payload' => $payload,
        ]);
    }

    private function payloadForUser(User $user): array
    {
        $role = $this->socketRole($user);

        return [
            'role' => $role,
            'userId' => (string) $user->id,
            'riderId' => $role === 'rider' ? $this->riderIdForUser($user) : '',
            'orderIds' => $this->orderIdsForUser($user, $role),
        ];
    }

    private function socketRole(User $user): string
    {
        if ($user->role === User::ROLE_RIDER) {
            return 'rider';
        }

        if ($user->role === User::ROLE_CLIENT) {
            return 'client';
        }

        if (in_array($user->role, [User::ROLE_OFFICE_ADMIN, User::ROLE_SUPER_ADMIN], true)) {
            return 'office';
        }

        abort(403, 'This role cannot use realtime sockets.');
    }

    private function riderIdForUser(User $user): string
    {
        return (string) (Rider::where('user_id', $user->id)->value('id') ?: '');
    }

    private function orderIdsForUser(User $user, string $role): array
    {
        if ($role === 'office') {
            return [];
        }

        $query = DeliveryOrder::query()
            ->whereNotIn('status', self::TERMINAL_ORDER_STATUSES)
            ->orderBy('id');

        if ($role === 'client') {
            $query->where('client_user_id', $user->id);
        }

        if ($role === 'rider') {
            $riderId = $this->riderIdForUser($user);

            if ($riderId === '') {
                return [];
            }

            $query->where('rider_id', $riderId);
        }

        return $query->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();
    }

    private function sign(array $payload, string $secret): string
    {
        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, $secret, true);

        return $encodedPayload . '.' . $this->base64UrlEncode($signature);
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
