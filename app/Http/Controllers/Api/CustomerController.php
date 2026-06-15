<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $customers = Customer::query()
            ->withCount('deliveryOrders')
            ->when($request->string('type')->toString(), fn ($query, $type) => $query->where('type', $type))
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%"));
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50));

        return response()->json($customers);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $customer = Customer::create($validated);
        $this->log($request, 'customer_created', $customer, $validated);

        return response()->json($customer->loadCount('deliveryOrders'), 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer->load(['shops'])->loadCount('deliveryOrders'));
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validated = $request->validate($this->rules($customer));
        $previous = $customer->only(array_keys($validated));
        $customer->update($validated);
        $this->log($request, 'customer_updated', $customer, ['previous' => $previous, 'current' => $validated]);

        return response()->json($customer->fresh()->loadCount('deliveryOrders'));
    }

    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        $snapshot = $customer->only(['name', 'phone', 'email', 'type']);
        $id = $customer->id;
        $customer->delete();

        AdminLog::create([
            'action' => 'customer_deleted',
            'subject_type' => Customer::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Customer deleted.']);
    }

    private function rules(?Customer $customer = null): array
    {
        return [
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'name' => [$customer ? 'sometimes' : 'required', 'string', 'max:255'],
            'phone' => [$customer ? 'sometimes' : 'required', 'string', 'max:30', Rule::unique('customers', 'phone')->ignore($customer)],
            'email' => ['nullable', 'email', 'max:255'],
            'type' => ['nullable', 'in:individual,shop,business'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function log(Request $request, string $action, Customer $customer, array $metadata): void
    {
        AdminLog::create([
            'action' => $action,
            'subject_type' => Customer::class,
            'subject_id' => $customer->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $metadata,
        ]);
    }
}
