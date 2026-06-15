<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->when($request->string('role')->toString(), fn ($query, $role) => $query->where('role', $role))
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $validated['password'] = Hash::make($validated['password'] ?? 'password');

        $user = User::create($validated);
        $this->log($request, 'user_created', $user, $validated);

        return response()->json($user, 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate($this->rules($user));

        if (array_key_exists('password', $validated) && $validated['password']) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $previous = $user->only(array_keys($validated));
        $user->update($validated);
        $this->log($request, 'user_updated', $user, ['previous' => $previous, 'current' => $validated]);

        return response()->json($user->fresh());
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ((int) $request->user()?->id === (int) $user->id) {
            abort(422, 'You cannot delete your own account.');
        }

        $snapshot = $user->only(['name', 'email', 'phone', 'role']);
        $id = $user->id;
        $user->delete();

        AdminLog::create([
            'action' => 'user_deleted',
            'subject_type' => User::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'User deleted.']);
    }

    private function rules(?User $user = null): array
    {
        return [
            'name' => [$user ? 'sometimes' : 'required', 'string', 'max:255'],
            'email' => [$user ? 'sometimes' : 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'phone' => [$user ? 'sometimes' : 'required', 'string', 'max:30', Rule::unique('users', 'phone')->ignore($user)],
            'role' => [$user ? 'sometimes' : 'required', Rule::in([
                User::ROLE_CLIENT,
                User::ROLE_RIDER,
                User::ROLE_OFFICE_ADMIN,
                User::ROLE_SUPER_ADMIN,
            ])],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:8'],
        ];
    }

    private function log(Request $request, string $action, User $user, array $metadata): void
    {
        AdminLog::create([
            'action' => $action,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $metadata,
        ]);
    }
}
