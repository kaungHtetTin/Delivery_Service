<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\FinanceCategory;
use App\Models\FinanceTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FinanceTransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $transactions = $this->filteredQuery($request)
            ->with(['category', 'rider', 'deliveryOrder.clientUser', 'customer', 'clientUser'])
            ->latest('transaction_date')
            ->latest('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json($transactions);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $validated['created_by'] = $request->user()?->id;
        $validated['updated_by'] = $request->user()?->id;

        $transaction = FinanceTransaction::create($validated);

        AdminLog::create([
            'action' => 'finance_transaction_created',
            'subject_type' => FinanceTransaction::class,
            'subject_id' => $transaction->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $transaction->only(['type', 'category_id', 'amount', 'payment_method', 'transaction_date']),
        ]);

        return response()->json($transaction->fresh(['category', 'rider', 'deliveryOrder.clientUser', 'customer', 'clientUser']), 201);
    }

    public function update(Request $request, FinanceTransaction $transaction): JsonResponse
    {
        $validated = $this->validated($request, $transaction);
        $validated['updated_by'] = $request->user()?->id;
        $previous = $transaction->only(array_keys($validated));

        $transaction->update($validated);

        AdminLog::create([
            'action' => 'finance_transaction_updated',
            'subject_type' => FinanceTransaction::class,
            'subject_id' => $transaction->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => [
                'previous' => $previous,
                'current' => $validated,
            ],
        ]);

        return response()->json($transaction->fresh(['category', 'rider', 'deliveryOrder.clientUser', 'customer', 'clientUser']));
    }

    public function destroy(Request $request, FinanceTransaction $transaction): JsonResponse
    {
        $snapshot = $transaction->only(['type', 'category_id', 'amount', 'payment_method', 'transaction_date', 'reference_type', 'reference_id']);
        $id = $transaction->id;
        $transaction->delete();

        AdminLog::create([
            'action' => 'finance_transaction_deleted',
            'subject_type' => FinanceTransaction::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Finance transaction deleted.']);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = $this->filteredQuery($request);
        $income = (float) (clone $query)->where('type', FinanceTransaction::TYPE_INCOME)->sum('amount');
        $expense = (float) (clone $query)->where('type', FinanceTransaction::TYPE_EXPENSE)->sum('amount');

        return response()->json([
            'totals' => [
                'income' => round($income, 2),
                'expense' => round($expense, 2),
                'net' => round($income - $expense, 2),
            ],
            'by_category' => $this->groupedTotals((clone $query), 'category_id'),
            'by_payment_method' => $this->groupedTotals((clone $query), 'payment_method'),
            'by_rider' => $this->groupedTotals((clone $query)->whereNotNull('rider_id'), 'rider_id'),
        ]);
    }

    private function filteredQuery(Request $request): Builder
    {
        return FinanceTransaction::query()
            ->when($request->string('type')->toString(), fn ($query, $type) => $query->where('type', $type))
            ->when($request->integer('category_id'), fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->when($request->date('date_from'), fn ($query, $date) => $query->whereDate('transaction_date', '>=', $date))
            ->when($request->date('date_to'), fn ($query, $date) => $query->whereDate('transaction_date', '<=', $date));
    }

    private function validated(Request $request, ?FinanceTransaction $transaction = null): array
    {
        $type = $request->input('type', $transaction?->type);

        $validated = $request->validate([
            'type' => [$transaction ? 'sometimes' : 'required', Rule::in(FinanceTransaction::TYPES)],
            'category_id' => ['nullable', 'integer', 'exists:finance_categories,id'],
            'amount' => [$transaction ? 'sometimes' : 'required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', Rule::in(FinanceTransaction::PAYMENT_METHODS)],
            'transaction_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string', 'max:1000'],
            'reference_type' => ['nullable', 'string', 'max:255'],
            'reference_id' => ['nullable', 'integer', 'min:1'],
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
            'delivery_order_id' => ['nullable', 'integer', 'exists:delivery_orders,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'client_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if (! empty($validated['category_id'])) {
            $category = FinanceCategory::findOrFail($validated['category_id']);

            if ($category->type !== $type) {
                throw ValidationException::withMessages([
                    'category_id' => 'Category type must match transaction type.',
                ]);
            }
        }

        $validated['payment_method'] = $validated['payment_method'] ?? $transaction?->payment_method ?? 'cash';
        $validated['transaction_date'] = isset($validated['transaction_date'])
            ? Carbon::parse($validated['transaction_date'])->toDateString()
            : ($transaction?->transaction_date?->toDateString() ?? today()->toDateString());

        return $validated;
    }

    private function groupedTotals(Builder $query, string $column): array
    {
        return $query
            ->selectRaw("{$column} as group_key")
            ->selectRaw("sum(case when type = ? then amount else 0 end) as income", [FinanceTransaction::TYPE_INCOME])
            ->selectRaw("sum(case when type = ? then amount else 0 end) as expense", [FinanceTransaction::TYPE_EXPENSE])
            ->groupBy($column)
            ->get()
            ->map(fn ($row) => [
                'key' => $row->group_key,
                'income' => round((float) $row->income, 2),
                'expense' => round((float) $row->expense, 2),
                'net' => round((float) $row->income - (float) $row->expense, 2),
            ])
            ->values()
            ->all();
    }
}
