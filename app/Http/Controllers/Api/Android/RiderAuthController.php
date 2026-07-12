<?php

namespace App\Http\Controllers\Api\Android;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\Rider;
use App\Models\User;
use App\Support\AndroidRiderPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class RiderAuthController extends Controller
{
    public function token(Request $request, AndroidRiderPayload $payload): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'fcm_token' => ['nullable', 'string', 'max:512'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'The provided credentials are incorrect.',
            ]);
        }

        if ($user->role !== User::ROLE_RIDER) {
            throw ValidationException::withMessages([
                'email' => 'This account is not a rider account.',
            ]);
        }

        $rider = Rider::query()
            ->with(['latestLocation', 'user'])
            ->where('user_id', $user->id)
            ->first();

        if (! $rider) {
            throw ValidationException::withMessages([
                'email' => 'No rider profile is linked to this account.',
            ]);
        }

        if (! empty($validated['fcm_token'])) {
            PushSubscription::query()->updateOrCreate(
                ['token' => $validated['fcm_token']],
                [
                    'user_id' => $user->id,
                    'platform' => 'android',
                    'user_agent' => $request->userAgent(),
                    'last_seen_at' => now(),
                ]
            );
        }

        return response()->json([
            'token_type' => 'Bearer',
            'token' => $user->createToken($validated['device_name'] ?? 'FlowDrop Android Rider')->plainTextToken,
            'user' => $payload->user($user),
            'rider' => $payload->rider($rider),
            'app_config' => $payload->appConfig(),
        ]);
    }
}
