<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Payment;
use App\Notifications\OrderActivityNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::query()
            ->with('deliveryOrder.rider')
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($payments);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'delivery_order_id' => ['required', 'integer', 'exists:delivery_orders,id'],
            'type' => ['required', 'in:delivery_fee,product_payment,adjustment'],
            'method' => ['required', 'in:cash,cash_on_delivery,prepaid,mobile_banking'],
            'amount' => ['required', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:unpaid,pending_approval,paid,rejected,refunded'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $payment = DB::transaction(function () use ($validated, $request) {
            $payment = Payment::create($validated);

            if (($validated['type'] ?? null) === 'delivery_fee') {
                $payment->deliveryOrder()->update([
                    'payment_status' => $validated['status'] ?? 'unpaid',
                ]);
            }

            AdminLog::create([
                'action' => 'payment_created',
                'subject_type' => Payment::class,
                'subject_id' => $payment->id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => $validated,
            ]);

            return $payment;
        });

        return response()->json($payment->fresh()->load('deliveryOrder.rider'), 201);
    }

    public function show(Payment $payment): JsonResponse
    {
        return response()->json($payment->load('deliveryOrder.rider', 'reviewer'));
    }

    public function update(Request $request, Payment $payment): JsonResponse
    {
        $validated = $request->validate([
            'delivery_order_id' => ['sometimes', 'required', 'integer', 'exists:delivery_orders,id'],
            'type' => ['sometimes', 'required', 'in:delivery_fee,product_payment,adjustment'],
            'method' => ['sometimes', 'required', 'in:cash,cash_on_delivery,prepaid,mobile_banking'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'status' => ['sometimes', 'required', 'in:unpaid,pending_approval,paid,rejected,refunded'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($payment, $validated, $request) {
            $previous = $payment->only(array_keys($validated));

            $payment->update($validated);

            if (($validated['type'] ?? $payment->type) === 'delivery_fee' && array_key_exists('status', $validated)) {
                $payment->deliveryOrder()->update([
                    'payment_status' => $validated['status'],
                ]);
            }

            AdminLog::create([
                'action' => 'payment_updated',
                'subject_type' => Payment::class,
                'subject_id' => $payment->id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => [
                    'previous' => $previous,
                    'current' => $validated,
                ],
            ]);
        });

        return response()->json($payment->fresh()->load('deliveryOrder.rider', 'reviewer'));
    }

    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        $snapshot = $payment->only(['delivery_order_id', 'type', 'method', 'amount', 'status']);
        $id = $payment->id;

        DB::transaction(function () use ($payment, $request, $snapshot, $id) {
            $deliveryOrder = $payment->deliveryOrder;
            $isDeliveryFee = $payment->type === 'delivery_fee';
            $payment->delete();

            if ($isDeliveryFee && $deliveryOrder) {
                $nextStatus = $deliveryOrder->payments()
                    ->where('type', 'delivery_fee')
                    ->latest()
                    ->value('status') ?? 'unpaid';
                $deliveryOrder->update(['payment_status' => $nextStatus]);
            }

            AdminLog::create([
                'action' => 'payment_deleted',
                'subject_type' => Payment::class,
                'subject_id' => $id,
                'actor_type' => 'office_admin',
                'actor_id' => $request->user()?->id,
                'metadata' => $snapshot,
            ]);
        });

        return response()->json(['message' => 'Payment deleted.']);
    }

    public function uploadScreenshot(Request $request, Payment $payment): JsonResponse
    {
        $validated = $request->validate([
            'screenshot' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $path = $validated['screenshot']->store('payment-screenshots');

        $payment->update([
            'screenshot_path' => $path,
            'status' => 'pending_approval',
        ]);
        $payment->deliveryOrder()->update(['payment_status' => 'pending_approval']);

        return response()->json($payment->fresh()->load('deliveryOrder'));
    }

    public function review(Request $request, Payment $payment): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['paid', 'rejected'])],
            'reviewed_by' => ['nullable', 'integer', 'exists:users,id'],
            'note' => ['nullable', 'required_if:status,rejected', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($payment, $validated) {
            $previousStatus = $payment->status;

            $payment->update([
                'status' => $validated['status'],
                'reviewed_by' => $validated['reviewed_by'] ?? null,
                'reviewed_at' => now(),
                'note' => $validated['note'] ?? null,
            ]);

            $payment->deliveryOrder()->update([
                'payment_status' => $validated['status'],
            ]);
            $payment->load('deliveryOrder.clientUser');

            AdminLog::create([
                'action' => 'payment_reviewed',
                'subject_type' => Payment::class,
                'subject_id' => $payment->id,
                'actor_type' => 'office_admin',
                'actor_id' => $validated['reviewed_by'] ?? null,
                'metadata' => [
                    'previous_status' => $previousStatus,
                    'status' => $validated['status'],
                    'delivery_order_id' => $payment->delivery_order_id,
                ],
                'note' => $validated['note'] ?? null,
            ]);

            $payment->deliveryOrder->clientUser?->notify(new OrderActivityNotification(
                $payment->deliveryOrder,
                'payment_reviewed',
                $validated['status'] === 'paid' ? 'Payment approved' : 'Payment rejected',
                $validated['status'] === 'paid'
                    ? "Payment for {$payment->deliveryOrder->code} has been approved."
                    : "Payment for {$payment->deliveryOrder->code} needs attention.",
                ['payment_status' => $validated['status']]
            ));
        });

        return response()->json($payment->fresh()->load('deliveryOrder.rider', 'deliveryOrder.payments'));
    }
}
