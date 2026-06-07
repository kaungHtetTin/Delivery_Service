<?php

namespace Tests\Feature;

use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\Rider;
use App\Models\CashCollection;
use App\Models\AdminLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DeliveryOrderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_submit_a_delivery_request()
    {
        $response = $this->postJson('/api/delivery-orders', $this->validOrderPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('payment_status', 'pending_approval')
            ->assertJsonCount(1, 'status_histories')
            ->assertJsonCount(1, 'payments');

        $this->assertDatabaseHas('delivery_orders', [
            'client_phone' => '09 774 221 890',
            'status' => 'pending',
        ]);
    }

    public function test_office_can_assign_an_available_rider()
    {
        $rider = $this->createRider();
        $order = DeliveryOrder::create($this->validOrderPayload());
        $order->statusHistories()->create(['status' => 'pending']);

        $response = $this->postJson("/api/delivery-orders/{$order->id}/assign", [
            'rider_id' => $rider->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'rider_assigned')
            ->assertJsonPath('rider.id', $rider->id);

        $this->assertDatabaseHas('order_status_histories', [
            'delivery_order_id' => $order->id,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('order_status_histories', [
            'delivery_order_id' => $order->id,
            'status' => 'rider_assigned',
        ]);
        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'status' => 'busy',
        ]);
    }

    public function test_rider_cannot_skip_required_workflow_steps()
    {
        $rider = $this->createRider(['status' => 'busy']);
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'rider_assigned',
            'rider_id' => $rider->id,
        ]);

        $this->patchJson("/api/delivery-orders/{$order->id}/status", [
            'status' => 'delivered',
        ])->assertUnprocessable();

        $this->patchJson("/api/delivery-orders/{$order->id}/status", [
            'status' => 'rider_accepted',
            'actor_type' => 'rider',
            'actor_id' => $rider->id,
        ])->assertOk()->assertJsonPath('status', 'rider_accepted');
    }

    public function test_reassignment_releases_previous_rider_when_idle()
    {
        $previousRider = $this->createRider([
            'code' => 'R-PREVIOUS',
            'phone' => '09 111 222 334',
            'status' => 'busy',
        ]);
        $nextRider = $this->createRider([
            'code' => 'R-NEXT',
            'phone' => '09 111 222 335',
        ]);
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'rider_assigned',
            'rider_id' => $previousRider->id,
        ]);

        $this->postJson("/api/delivery-orders/{$order->id}/assign", [
            'rider_id' => $nextRider->id,
        ])->assertOk()->assertJsonPath('rider.id', $nextRider->id);

        $this->assertDatabaseHas('riders', [
            'id' => $previousRider->id,
            'status' => 'available',
        ]);
        $this->assertDatabaseHas('riders', [
            'id' => $nextRider->id,
            'status' => 'busy',
        ]);
    }

    public function test_rider_can_report_a_gps_location()
    {
        $rider = $this->createRider(['status' => 'offline']);

        $this->postJson("/api/riders/{$rider->id}/locations", [
            'latitude' => 16.840939,
            'longitude' => 96.173526,
            'battery_percent' => 84,
        ])->assertCreated()->assertJsonPath('battery_percent', 84);

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'status' => 'online',
        ]);
    }

    public function test_client_can_upload_mobile_banking_screenshot()
    {
        Storage::fake('local');

        $order = DeliveryOrder::create($this->validOrderPayload());
        $payment = $order->payments()->create([
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 3000,
            'status' => 'pending_approval',
        ]);

        $response = $this->postJson("/api/payments/{$payment->id}/screenshot", [
            'screenshot' => $this->fakePngUpload(),
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'pending_approval');

        $payment->refresh();

        $this->assertNotNull($payment->screenshot_path);
        Storage::disk('local')->assertExists($payment->screenshot_path);
    }

    public function test_office_can_approve_or_reject_a_mobile_banking_payment()
    {
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'payment_status' => 'pending_approval',
        ]);
        $payment = $order->payments()->create([
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 3000,
            'status' => 'pending_approval',
        ]);

        $this->patchJson("/api/payments/{$payment->id}/review", [
            'status' => 'paid',
        ])->assertOk()->assertJsonPath('status', 'paid');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'payment_status' => 'paid',
        ]);

        $secondPayment = Payment::create([
            'delivery_order_id' => $order->id,
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 3000,
            'status' => 'pending_approval',
        ]);

        $this->patchJson("/api/payments/{$secondPayment->id}/review", [
            'status' => 'rejected',
            'note' => 'Transfer amount does not match.',
        ])->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertDatabaseHas('payments', [
            'id' => $secondPayment->id,
            'status' => 'rejected',
            'note' => 'Transfer amount does not match.',
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'payment_reviewed',
            'subject_type' => Payment::class,
            'subject_id' => $secondPayment->id,
        ]);
    }

    public function test_office_can_filter_orders_by_search_status_payment_and_date()
    {
        $matchingOrder = DeliveryOrder::create($this->validOrderPayload() + [
            'client_name' => 'Moe Thandar',
            'receiver_name' => 'May Thu',
            'status' => 'pending',
            'payment_status' => 'pending_approval',
        ]);
        $matchingOrder->forceFill(['created_at' => now()->subDay()])->save();

        $olderOrder = DeliveryOrder::create($this->validOrderPayload() + [
            'client_name' => 'City Mart',
            'receiver_name' => 'Ko Aung',
            'client_phone' => '09 555 111 222',
            'status' => 'completed',
            'payment_status' => 'paid',
        ]);
        $olderOrder->forceFill(['created_at' => now()->subDays(10)])->save();

        $this->getJson('/api/delivery-orders?search=May&status=pending&payment_status=pending_approval&date_from=' . now()->subDays(2)->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.receiver_name', 'May Thu');
    }

    public function test_office_can_view_summary_reports()
    {
        $rider = $this->createRider();
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'completed',
            'payment_status' => 'paid',
            'rider_id' => $rider->id,
        ]);
        Payment::create([
            'delivery_order_id' => $order->id,
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 3000,
            'status' => 'paid',
        ]);
        CashCollection::create([
            'delivery_order_id' => $order->id,
            'rider_id' => $rider->id,
            'product_cash_collected' => 10000,
            'delivery_fee_collected' => 3000,
            'total_cash_collected' => 13000,
            'confirmed_at' => now(),
        ]);

        $this->getJson('/api/reports/summary')
            ->assertOk()
            ->assertJsonPath('orders.total', 1)
            ->assertJsonPath('orders.completed', 1)
            ->assertJsonPath('payments.approved_amount', 3000)
            ->assertJsonPath('cash_collections.total_collected', 13000)
            ->assertJsonPath('riders.0.name', 'Test Rider');
    }

    public function test_office_can_view_admin_logs()
    {
        AdminLog::create([
            'action' => 'payment_reviewed',
            'subject_type' => Payment::class,
            'subject_id' => 10,
            'actor_type' => 'office_admin',
            'metadata' => ['status' => 'paid'],
        ]);

        $this->getJson('/api/admin-logs?action=payment_reviewed')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'payment_reviewed');
    }

    private function createRider(array $attributes = []): Rider
    {
        return Rider::create($attributes + [
            'code' => 'R-TEST',
            'name' => 'Test Rider',
            'phone' => '09 111 222 333',
            'status' => 'available',
        ]);
    }

    private function validOrderPayload(): array
    {
        return [
            'client_name' => 'Moe Thandar',
            'client_phone' => '09 774 221 890',
            'pickup_contact_name' => 'Linn Fashion',
            'pickup_phone' => '09 790 331 482',
            'pickup_address' => 'Kabar Aye Market, Yankin',
            'receiver_name' => 'May Thu',
            'receiver_phone' => '09 420 882 144',
            'receiver_address' => 'Sanchaung Street, Sanchaung',
            'product_name' => 'Clothing package',
            'quantity' => 1,
            'delivery_fee_payment_method' => 'mobile_banking',
            'product_payment_method' => 'already_paid',
            'delivery_fee' => 3000,
        ];
    }

    private function fakePngUpload(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'payment-proof');
        file_put_contents(
            $path,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=')
        );

        return new UploadedFile($path, 'proof.png', 'image/png', null, true);
    }
}
