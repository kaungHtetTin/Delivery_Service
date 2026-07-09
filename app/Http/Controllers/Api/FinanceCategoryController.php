<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\FinanceCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FinanceCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = FinanceCategory::query()
            ->when($request->string('type')->toString(), fn ($query, $type) => $query->where('type', $type))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $validated['created_by'] = $request->user()?->id;

        $category = FinanceCategory::create($validated);

        AdminLog::create([
            'action' => 'finance_category_created',
            'subject_type' => FinanceCategory::class,
            'subject_id' => $category->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $category->only(['name', 'type', 'description', 'is_active']),
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, FinanceCategory $category): JsonResponse
    {
        $validated = $this->validated($request, $category);
        $previous = $category->only(array_keys($validated));

        $category->update($validated);

        AdminLog::create([
            'action' => 'finance_category_updated',
            'subject_type' => FinanceCategory::class,
            'subject_id' => $category->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'previous' => $previous,
                'current' => $validated,
            ],
        ]);

        return response()->json($category->fresh());
    }

    public function destroy(Request $request, FinanceCategory $category): JsonResponse
    {
        if ($category->transactions()->exists()) {
            $category->update(['is_active' => false]);

            return response()->json([
                'message' => 'Category has transactions, so it was disabled instead of deleted.',
                'category' => $category->fresh(),
            ]);
        }

        $snapshot = $category->only(['name', 'type', 'description', 'is_active']);
        $id = $category->id;
        $category->delete();

        AdminLog::create([
            'action' => 'finance_category_deleted',
            'subject_type' => FinanceCategory::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Finance category deleted.']);
    }

    private function validated(Request $request, ?FinanceCategory $category = null): array
    {
        $type = $request->input('type', $category?->type);

        $validated = $request->validate([
            'name' => [
                $category ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('finance_categories', 'name')
                    ->where(fn ($query) => $query->where('type', $type))
                    ->ignore($category),
            ],
            'type' => [$category ? 'sometimes' : 'required', Rule::in(FinanceCategory::TYPES)],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($category && array_key_exists('type', $validated) && $category->transactions()->exists() && $validated['type'] !== $category->type) {
            throw ValidationException::withMessages([
                'type' => 'Category type cannot be changed after transactions use it.',
            ]);
        }

        if (! $category) {
            $validated['is_active'] = $validated['is_active'] ?? true;
        }

        return $validated;
    }
}
