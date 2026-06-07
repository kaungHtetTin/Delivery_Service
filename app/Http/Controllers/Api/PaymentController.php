<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Payment;
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
        });

        return response()->json($payment->fresh()->load('deliveryOrder.rider', 'deliveryOrder.payments'));
    }
}
