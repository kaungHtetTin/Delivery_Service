<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Rider;
use App\Models\RiderSettlement;
use App\Models\User;
use App\Services\RealtimeSocketPublisher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RiderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $riders = Rider::query()
            ->with('user')
            ->withCount(['deliveryOrders as active_orders_count' => function ($query) {
                $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
            }])
            ->when($request->user()?->role === User::ROLE_RIDER, function ($query) use ($request) {
                $query->where('user_id', $request->user()->id);
            })
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $riders]);
    }

    public function store(Request $request): JsonResponse
    {
        $linkedUserId = $request->input('user_id');
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('riders', 'code')],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30', Rule::unique('riders', 'phone'), Rule::unique('users', 'phone')->ignore($linkedUserId)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('riders', 'email'), Rule::unique('users', 'email')->ignore($linkedUserId)],
            'password' => ['nullable', 'string', 'min:8'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:offline,online,available,busy,on_break,suspended'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'current_area' => ['nullable', 'string', 'max:255'],
        ]);

        $riderData = $validated;
        unset($riderData['password']);

        $rider = Rider::create($riderData);
        $rider = $this->syncRiderUser($rider, $validated);

        AdminLog::create([
            'action' => 'rider_created',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $this->safeRiderMetadata($validated),
        ]);

        return response()->json($this->riderForResponse($rider), 201);
    }

    public function update(Request $request, Rider $rider): JsonResponse
    {
        $linkedUserId = $request->input('user_id', $rider->user_id);
        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('riders', 'code')->ignore($rider)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('riders', 'phone')->ignore($rider), Rule::unique('users', 'phone')->ignore($linkedUserId)],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('riders', 'email')->ignore($rider), Rule::unique('users', 'email')->ignore($linkedUserId)],
            'password' => ['nullable', 'string', 'min:8'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:offline,online,available,busy,on_break,suspended'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'current_area' => ['nullable', 'string', 'max:255'],
        ]);

        $riderData = $validated;
        unset($riderData['password']);

        $previous = $rider->only(array_keys($riderData));
        $rider->update($riderData);
        $rider = $this->syncRiderUser($rider->fresh(), $validated);

        AdminLog::create([
            'action' => 'rider_updated',
            'subject_type' => Rider::class,
            'subject_id' => $rider->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'previous' => $previous,
                'current' => $this->safeRiderMetadata($validated),
            ],
        ]);

        return response()->json($this->riderForResponse($rider));
    }

    public function destroy(Request $request, Rider $rider): JsonResponse
    {
        $snapshot = $rider->only(['code', 'name', 'phone', 'status', 'current_area']);
        $id = $rider->id;
        $rider->delete();

        AdminLog::create([
            'action' => 'rider_deleted',
            'subject_type' => Rider::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Rider deleted.']);
    }

    public function collectHeldFees(Request $request, Rider $rider): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $result = DB::transaction(function () use ($rider, $request, $validated) {
            $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);
            $cashHeldBefore = (float) $lockedRider->cash_held;
            $amount = (float) $validated['amount'];

            if ($amount > $cashHeldBefore) {
                throw ValidationException::withMessages([
                    'amount' => 'Collection amount cannot be greater than the rider cash held.',
                ]);
            }

            $cashHeldAfter = $cashHeldBefore - $amount;

            $settlement = RiderSettlement::create([
                'rider_id' => $lockedRider->id,
                'collected_by' => $request->user()?->id,
                'amount' => $amount,
                'cash_held_before' => $cashHeldBefore,
                'cash_held_after' => $cashHeldAfter,
                'note' => $validated['note'] ?? null,
                'collected_at' => now(),
            ]);

            $lockedRider->update(['cash_held' => $cashHeldAfter]);

            AdminLog::create([
                'action' => 'rider_delivery_fees_collected',
                'subject_type' => Rider::class,
                'subject_id' => $lockedRider->id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => [
                    'settlement_id' => $settlement->id,
                    'amount' => $amount,
                    'cash_held_before' => $cashHeldBefore,
                    'cash_held_after' => $cashHeldAfter,
                ],
                'note' => $validated['note'] ?? null,
            ]);

            return [
                'rider' => $lockedRider->fresh(),
                'settlement' => $settlement->fresh('collector'),
            ];
        });

        return response()->json([
            'rider' => $result['rider']->loadCount(['deliveryOrders as active_orders_count' => function ($query) {
                $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
            }]),
            'settlement' => $result['settlement'],
        ]);
    }

    public function assignments(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderAccess($request, $rider);

        $orders = $rider->deliveryOrders()
            ->whereNotIn('status', ['completed', 'failed', 'cancelled'])
            ->latest()
            ->get();

        return response()->json(['data' => $orders]);
    }

    public function storeLocation(Request $request, Rider $rider): JsonResponse
    {
        $this->authorizeRiderAccess($request, $rider);

        $validated = $request->validate([
            'delivery_order_id' => ['nullable', 'integer', 'exists:delivery_orders,id'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'speed' => ['nullable', 'numeric', 'min:0'],
            'battery_percent' => ['nullable', 'integer', 'between:0,100'],
            'recorded_at' => ['nullable', 'date'],
        ]);

        $validated['recorded_at'] ??= now();
        $location = $rider->locations()->create($validated);

        $rider->update([
            'last_active_at' => $location->recorded_at,
            'status' => $rider->status === 'offline' ? 'online' : $rider->status,
        ]);

        app(RealtimeSocketPublisher::class)->riderLocationUpdated($location);

        return response()->json($location, 201);
    }

    private function authorizeRiderAccess(Request $request, Rider $rider): void
    {
        if ($request->user()?->role === User::ROLE_RIDER && (int) $rider->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }

    private function syncRiderUser(Rider $rider, array $validated): Rider
    {
        $password = $validated['password'] ?? null;
        $user = null;

        if (! empty($validated['user_id'])) {
            $user = User::find($validated['user_id']);
        } elseif ($rider->user_id) {
            $user = $rider->user()->first();
        }

        if (! $user && ! $password) {
            return $rider;
        }

        if (! $user && empty($validated['email'])) {
            throw ValidationException::withMessages([
                'email' => 'Email is required to create rider login credentials.',
            ]);
        }

        $user ??= new User();
        $user->fill([
            'name' => $validated['name'] ?? $rider->name,
            'email' => $validated['email'] ?? $rider->email,
            'phone' => $validated['phone'] ?? $rider->phone,
            'role' => User::ROLE_RIDER,
        ]);

        if ($password) {
            $user->password = Hash::make($password);
        }

        $user->save();

        if ((int) $rider->user_id !== (int) $user->id) {
            $rider->forceFill(['user_id' => $user->id])->save();
        }

        return $rider->fresh();
    }

    private function riderForResponse(Rider $rider): Rider
    {
        return $rider->fresh()
            ->load('user')
            ->loadCount(['deliveryOrders as active_orders_count' => function ($query) {
                $query->whereNotIn('status', ['completed', 'failed', 'cancelled']);
            }]);
    }

    private function safeRiderMetadata(array $metadata): array
    {
        if (array_key_exists('password', $metadata)) {
            $metadata['password_changed'] = (bool) $metadata['password'];
            unset($metadata['password']);
        }

        return $metadata;
    }
}
