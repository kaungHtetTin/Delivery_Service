<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\CommissionRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommissionRuleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rules = CommissionRule::query()
            ->with('rider')
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->integer('rider_id'), fn ($query, $riderId) => $query->where('rider_id', $riderId))
            ->orderByDesc('is_active')
            ->latest('id')
            ->get();

        return response()->json(['data' => $rules]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $rule = CommissionRule::create($validated);

        AdminLog::create([
            'action' => 'commission_rule_created',
            'subject_type' => CommissionRule::class,
            'subject_id' => $rule->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $rule->only(['rider_id', 'name', 'type', 'fixed_amount', 'percentage', 'is_active']),
        ]);

        return response()->json($rule->fresh('rider'), 201);
    }

    public function update(Request $request, CommissionRule $commissionRule): JsonResponse
    {
        $validated = $this->validated($request, true);
        $previous = $commissionRule->only(array_keys($validated));

        $commissionRule->update($validated);

        AdminLog::create([
            'action' => 'commission_rule_updated',
            'subject_type' => CommissionRule::class,
            'subject_id' => $commissionRule->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'previous' => $previous,
                'current' => $validated,
            ],
        ]);

        return response()->json($commissionRule->fresh('rider'));
    }

    public function destroy(Request $request, CommissionRule $commissionRule): JsonResponse
    {
        $snapshot = $commissionRule->only(['rider_id', 'name', 'type', 'fixed_amount', 'percentage', 'is_active']);
        $id = $commissionRule->id;
        $commissionRule->delete();

        AdminLog::create([
            'action' => 'commission_rule_deleted',
            'subject_type' => CommissionRule::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Commission rule deleted.']);
    }

    private function validated(Request $request, bool $isUpdate = false): array
    {
        $validated = $request->validate([
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
            'name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'type' => [$isUpdate ? 'sometimes' : 'required', Rule::in(CommissionRule::TYPES)],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (! $isUpdate || array_key_exists('fixed_amount', $validated)) {
            $validated['fixed_amount'] = $validated['fixed_amount'] ?? 0;
        }

        if (! $isUpdate || array_key_exists('percentage', $validated)) {
            $validated['percentage'] = $validated['percentage'] ?? 0;
        }

        if (! $isUpdate || array_key_exists('is_active', $validated)) {
            $validated['is_active'] = $validated['is_active'] ?? true;
        }

        return $validated;
    }
}
