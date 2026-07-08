<?php

namespace Tests\Feature;

use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\Rider;
use App\Models\CashCollection;
use App\Models\AdminLog;
use App\Models\ClientAddress;
use App\Models\Customer;
use App\Models\User;
use App\Models\Shop;
use App\Models\SystemSetting;
use Database\Seeders\DeliveryDemoSeeder;
use Database\Seeders\SystemSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
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
            ->assertJsonPath('payment_status', 'unpaid')
            ->assertJsonPath('delivery_fee_payment_method', 'cash')
            ->assertJsonCount(1, 'status_histories')
            ->assertJsonCount(0, 'payments');

        $this->assertDatabaseHas('delivery_orders', [
            'client_phone' => '09 774 221 890',
            'status' => 'pending',
        ]);
    }

    public function test_office_can_create_delivery_order_without_requester_or_destination_details()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $payload = $this->validOrderPayload();
        unset(
            $payload['client_name'],
            $payload['client_phone'],
            $payload['receiver_name'],
            $payload['receiver_phone'],
            $payload['receiver_address']
        );

        $this->postJson('/api/delivery-orders', $payload)
            ->assertCreated()
            ->assertJsonPath('client_name', '')
            ->assertJsonPath('client_phone', '')
            ->assertJsonPath('receiver_name', '')
            ->assertJsonPath('receiver_phone', '')
            ->assertJsonPath('receiver_address', '');

        $this->assertDatabaseHas('delivery_orders', [
            'client_name' => '',
            'client_phone' => '',
            'receiver_name' => '',
            'receiver_phone' => '',
            'receiver_address' => '',
        ]);
    }

    public function test_office_can_assign_an_available_rider()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

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

        $this->assertDatabaseMissing('order_status_histories', [
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

    public function test_office_cannot_assign_a_busy_rider()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $rider = $this->createRider(['status' => 'busy']);
        $order = DeliveryOrder::create($this->validOrderPayload());

        $this->postJson("/api/delivery-orders/{$order->id}/assign", [
            'rider_id' => $rider->id,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rider_id');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'status' => 'pending',
            'rider_id' => null,
        ]);
    }

    public function test_rider_cannot_complete_without_delivery_fee()
    {
        $riderUser = $this->actingAsRole(User::ROLE_RIDER);

        $rider = $this->createRider([
            'status' => 'busy',
            'user_id' => $riderUser->id,
        ]);
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'delivered',
            'rider_id' => $rider->id,
        ]);

        $this->patchJson("/api/delivery-orders/{$order->id}/status", [
            'status' => 'completed',
            'actor_type' => 'rider',
            'actor_id' => $rider->id,
        ])->assertUnprocessable();
    }

    public function test_rider_completion_sets_delivery_fee_and_creates_cash_collection()
    {
        $riderUser = $this->actingAsRole(User::ROLE_RIDER);

        $rider = $this->createRider([
            'status' => 'busy',
            'cash_held' => 0,
            'user_id' => $riderUser->id,
        ]);
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'delivered',
            'delivery_fee' => 0,
            'rider_id' => $rider->id,
        ]);

        $this->patchJson("/api/delivery-orders/{$order->id}/status", [
            'status' => 'completed',
            'delivery_fee' => 4500,
            'actor_type' => 'rider',
            'actor_id' => $rider->id,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('delivery_fee', '4500.00')
            ->assertJsonPath('delivery_fee_payment_method', 'cash')
            ->assertJsonPath('payment_status', 'paid');

        $this->assertDatabaseHas('cash_collections', [
            'delivery_order_id' => $order->id,
            'rider_id' => $rider->id,
            'delivery_fee_collected' => 4500,
        ]);

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 4500,
        ]);
    }

    public function test_order_without_delivery_fee_payment_method_defaults_to_cash()
    {
        $payload = $this->validOrderPayload();
        unset($payload['delivery_fee_payment_method']);

        $this->postJson('/api/delivery-orders', $payload)
            ->assertCreated()
            ->assertJsonPath('delivery_fee_payment_method', 'cash')
            ->assertJsonPath('payment_status', 'unpaid');
    }

    public function test_delivery_fee_payment_method_only_allows_cash_or_banking()
    {
        foreach (['cash_on_delivery', 'prepaid'] as $method) {
            $this->postJson('/api/delivery-orders', array_merge($this->validOrderPayload(), [
                'delivery_fee_payment_method' => $method,
            ]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('delivery_fee_payment_method');
        }

        $this->postJson('/api/delivery-orders', array_merge($this->validOrderPayload(), [
            'delivery_fee_payment_method' => 'mobile_banking',
        ]))
            ->assertCreated()
            ->assertJsonPath('delivery_fee_payment_method', 'mobile_banking');
    }

    public function test_authenticated_client_can_create_a_delivery_request_with_product_cod_on()
    {
        $client = $this->createUser([
            'email' => 'cod-client@example.test',
            'role' => User::ROLE_CLIENT,
        ]);

        Sanctum::actingAs($client);

        $this->postJson('/api/delivery-orders', array_merge($this->validOrderPayload(), [
            'client_name' => $client->name,
            'client_phone' => $client->phone,
            'product_payment_method' => 'rider_collects',
            'cod_amount' => 0,
        ]))
            ->assertCreated()
            ->assertJsonPath('client_user_id', $client->id)
            ->assertJsonPath('product_payment_method', 'rider_collects')
            ->assertJsonPath('cod_amount', '0.00');
    }

    public function test_authenticated_client_can_create_delivery_request_without_destination_details()
    {
        $client = $this->createUser([
            'email' => 'optional-destination-client@example.test',
            'role' => User::ROLE_CLIENT,
        ]);

        Sanctum::actingAs($client);

        $payload = $this->validOrderPayload();
        unset($payload['receiver_name'], $payload['receiver_phone'], $payload['receiver_address']);

        $this->postJson('/api/delivery-orders', array_merge($payload, [
            'client_name' => $client->name,
            'client_phone' => $client->phone,
        ]))
            ->assertCreated()
            ->assertJsonPath('client_user_id', $client->id)
            ->assertJsonPath('receiver_name', '')
            ->assertJsonPath('receiver_phone', '')
            ->assertJsonPath('receiver_address', '');
    }

    public function test_rider_cannot_skip_required_workflow_steps()
    {
        $riderUser = $this->actingAsRole(User::ROLE_RIDER);

        $rider = $this->createRider([
            'status' => 'busy',
            'user_id' => $riderUser->id,
        ]);
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

    public function test_rider_pickup_updates_destination_and_cod_details()
    {
        $riderUser = $this->actingAsRole(User::ROLE_RIDER);

        $rider = $this->createRider([
            'status' => 'busy',
            'user_id' => $riderUser->id,
        ]);
        $order = DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'status' => 'rider_accepted',
            'receiver_name' => '',
            'receiver_phone' => '',
            'receiver_address' => '',
            'product_payment_method' => 'already_paid',
            'cod_amount' => 0,
            'rider_id' => $rider->id,
        ]));

        $this->patchJson("/api/delivery-orders/{$order->id}/status", [
            'status' => 'picked_up',
            'receiver_name' => 'Daw Hnin',
            'receiver_phone' => '09 555 222 777',
            'receiver_address' => 'Bahan Street, Yangon',
            'product_payment_method' => 'rider_collects',
            'cod_amount' => 12500,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'picked_up')
            ->assertJsonPath('receiver_name', 'Daw Hnin')
            ->assertJsonPath('receiver_phone', '09 555 222 777')
            ->assertJsonPath('receiver_address', 'Bahan Street, Yangon')
            ->assertJsonPath('product_payment_method', 'rider_collects')
            ->assertJsonPath('cod_amount', '12500.00');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'status' => 'picked_up',
            'receiver_phone' => '09 555 222 777',
            'receiver_address' => 'Bahan Street, Yangon',
            'product_payment_method' => 'rider_collects',
            'cod_amount' => 12500,
        ]);
    }

    public function test_rider_cannot_progress_an_order_assigned_to_another_rider()
    {
        $riderUser = $this->actingAsRole(User::ROLE_RIDER);
        $this->createRider([
            'code' => 'R-AUTH',
            'phone' => '09 111 222 336',
            'user_id' => $riderUser->id,
        ]);
        $otherRider = $this->createRider([
            'code' => 'R-OTHER-JOB',
            'phone' => '09 111 222 337',
            'status' => 'busy',
        ]);
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'rider_assigned',
            'rider_id' => $otherRider->id,
        ]);

        $this->patchJson("/api/delivery-orders/{$order->id}/status", [
            'status' => 'rider_accepted',
        ])->assertForbidden();

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'status' => 'rider_assigned',
            'rider_id' => $otherRider->id,
        ]);
    }

    public function test_reassignment_releases_previous_rider_when_idle()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

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
        $user = $this->actingAsRole(User::ROLE_RIDER);

        $rider = $this->createRider([
            'status' => 'offline',
            'user_id' => $user->id,
        ]);

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

    public function test_rider_only_sees_and_updates_their_own_profile()
    {
        $riderUser = $this->createUser([
            'email' => 'scoped-rider@example.test',
            'role' => User::ROLE_RIDER,
        ]);
        $ownRider = $this->createRider([
            'code' => 'R-OWN',
            'phone' => '09 333 444 555',
            'user_id' => $riderUser->id,
        ]);
        $otherRider = $this->createRider([
            'code' => 'R-OTHER',
            'phone' => '09 333 444 556',
        ]);

        Sanctum::actingAs($riderUser);

        $this->getJson('/api/riders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'R-OWN');

        $this->postJson("/api/riders/{$otherRider->id}/locations", [
            'latitude' => 16.840939,
            'longitude' => 96.173526,
        ])->assertForbidden();

        $this->postJson("/api/riders/{$ownRider->id}/locations", [
            'latitude' => 16.840939,
            'longitude' => 96.173526,
        ])->assertCreated();
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
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

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
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

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
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

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
            'product_cash_collected' => 0,
            'delivery_fee_collected' => 3000,
            'total_cash_collected' => 3000,
            'confirmed_at' => now(),
        ]);
        $pendingRider = $this->createRider([
            'code' => 'R-REPORT-PENDING',
            'phone' => '09 700 100 199',
        ]);
        $pendingOrder = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'completed',
            'payment_status' => 'paid',
            'rider_id' => $pendingRider->id,
        ]);
        CashCollection::create([
            'delivery_order_id' => $pendingOrder->id,
            'rider_id' => $pendingRider->id,
            'product_cash_collected' => 0,
            'delivery_fee_collected' => 2000,
            'total_cash_collected' => 2000,
        ]);
        $failedOrder = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'failed',
            'payment_status' => 'pending_approval',
        ]);
        Payment::create([
            'delivery_order_id' => $failedOrder->id,
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 1500,
            'status' => 'pending_approval',
        ]);
        $cancelledOrder = DeliveryOrder::create($this->validOrderPayload() + [
            'status' => 'cancelled',
            'payment_status' => 'rejected',
        ]);
        Payment::create([
            'delivery_order_id' => $cancelledOrder->id,
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 1000,
            'status' => 'rejected',
        ]);

        $this->getJson('/api/reports/summary')
            ->assertOk()
            ->assertJsonPath('orders.total', 4)
            ->assertJsonPath('orders.active', 0)
            ->assertJsonPath('orders.completed', 2)
            ->assertJsonPath('orders.failed', 1)
            ->assertJsonPath('orders.cancelled', 1)
            ->assertJsonPath('payments.pending_approval', 1)
            ->assertJsonPath('payments.paid', 1)
            ->assertJsonPath('payments.rejected', 1)
            ->assertJsonPath('payments.approved_amount', 3000)
            ->assertJsonPath('cash_collections.total_collected', 5000)
            ->assertJsonPath('cash_collections.confirmed_amount', 3000)
            ->assertJsonPath('cash_collections.pending_amount', 2000)
            ->assertJsonPath('cash_collections.confirmed', 1)
            ->assertJsonPath('cash_collections.pending', 1)
            ->assertJsonCount(2, 'riders');
    }

    public function test_office_can_view_admin_logs()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

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

    public function test_office_can_update_and_delete_a_delivery_order()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $order = DeliveryOrder::create($this->validOrderPayload());

        $this->patchJson("/api/delivery-orders/{$order->id}", [
            'client_name' => 'Updated Client',
            'status' => 'approved',
            'internal_note' => 'Office verified details.',
        ])
            ->assertOk()
            ->assertJsonPath('client_name', 'Updated Client')
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('order_status_histories', [
            'delivery_order_id' => $order->id,
            'status' => 'approved',
            'actor_type' => 'office_admin',
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'delivery_order_updated',
            'subject_type' => DeliveryOrder::class,
            'subject_id' => $order->id,
        ]);

        $this->deleteJson("/api/delivery-orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Delivery order deleted.');

        $this->assertDatabaseMissing('delivery_orders', ['id' => $order->id]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'delivery_order_deleted',
            'subject_type' => DeliveryOrder::class,
            'subject_id' => $order->id,
        ]);
    }

    public function test_office_can_save_payment_cod_on_order_without_affecting_rider_cash_held()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $rider = $this->createRider();
        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'rider_id' => $rider->id,
        ]);

        $this->patchJson("/api/delivery-orders/{$order->id}", [
            'product_payment_method' => 'rider_collects',
            'cod_amount' => 15000,
        ])
            ->assertOk()
            ->assertJsonPath('product_payment_method', 'rider_collects')
            ->assertJsonPath('cod_amount', '15000.00');

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 0,
        ]);

        $this->postJson('/api/cash-collections', [
            'delivery_order_id' => $order->id,
            'rider_id' => $rider->id,
            'delivery_fee_collected' => 3000,
        ])
            ->assertCreated()
            ->assertJsonPath('total_cash_collected', '3000.00');

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 3000,
        ]);

        $this->patchJson("/api/delivery-orders/{$order->id}", [
            'product_payment_method' => 'already_paid',
            'cod_amount' => 0,
        ])
            ->assertOk()
            ->assertJsonPath('product_payment_method', 'already_paid')
            ->assertJsonPath('cod_amount', '0.00');
    }

    public function test_office_can_create_update_and_delete_a_rider()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $response = $this->postJson('/api/riders', [
            'code' => 'R-CRUD',
            'name' => 'CRUD Rider',
            'phone' => '09 700 100 200',
            'status' => 'available',
            'vehicle_type' => 'motorbike',
            'current_area' => 'Yankin',
        ])
            ->assertCreated()
            ->assertJsonPath('code', 'R-CRUD')
            ->assertJsonPath('current_area', 'Yankin');

        $riderId = $response->json('id');

        $this->patchJson("/api/riders/{$riderId}", [
            'status' => 'on_break',
            'current_area' => 'Bahan',
            'cash_held' => 5000,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'on_break')
            ->assertJsonPath('current_area', 'Bahan');

        $this->deleteJson("/api/riders/{$riderId}")
            ->assertOk()
            ->assertJsonPath('message', 'Rider deleted.');

        $this->assertDatabaseMissing('riders', ['id' => $riderId]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'rider_deleted',
            'subject_type' => Rider::class,
            'subject_id' => $riderId,
        ]);
    }

    public function test_office_can_create_update_and_delete_a_payment()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $order = DeliveryOrder::create($this->validOrderPayload() + [
            'payment_status' => 'unpaid',
        ]);

        $response = $this->postJson('/api/payments', [
            'delivery_order_id' => $order->id,
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 3000,
            'status' => 'pending_approval',
        ])
            ->assertCreated()
            ->assertJsonPath('status', 'pending_approval');

        $paymentId = $response->json('id');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'payment_status' => 'pending_approval',
        ]);

        $this->patchJson("/api/payments/{$paymentId}", [
            'amount' => 3500,
            'status' => 'paid',
            'note' => 'Adjusted fee approved.',
        ])
            ->assertOk()
            ->assertJsonPath('amount', '3500.00')
            ->assertJsonPath('status', 'paid');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'payment_status' => 'paid',
        ]);

        $this->deleteJson("/api/payments/{$paymentId}")
            ->assertOk()
            ->assertJsonPath('message', 'Payment deleted.');

        $this->assertDatabaseMissing('payments', ['id' => $paymentId]);
        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'payment_status' => 'unpaid',
        ]);
    }

    public function test_office_can_create_update_transfer_and_delete_cash_collection()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $order = DeliveryOrder::create($this->validOrderPayload());
        $rider = $this->createRider();
        $nextRider = $this->createRider([
            'code' => 'R-CASH-2',
            'phone' => '09 700 100 201',
        ]);

        $response = $this->postJson('/api/cash-collections', [
            'delivery_order_id' => $order->id,
            'rider_id' => $rider->id,
            'delivery_fee_collected' => 3000,
            'payment_note' => 'Collected from receiver.',
        ])
            ->assertCreated()
            ->assertJsonPath('total_cash_collected', '3000.00')
            ->assertJsonPath('product_cash_collected', '0.00');

        $collectionId = $response->json('id');

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 3000,
        ]);

        $this->getJson('/api/cash-collections?confirmed=false')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $collectionId);

        $this->getJson('/api/cash-collections?confirmed=true')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->patchJson("/api/cash-collections/{$collectionId}", [
            'delivery_fee_collected' => 3000,
            'confirmed_at' => now()->toISOString(),
        ])
            ->assertOk()
            ->assertJsonPath('total_cash_collected', '3000.00');

        $this->getJson('/api/cash-collections?confirmed=true')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $collectionId);

        $this->getJson('/api/cash-collections?confirmed=false')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 3000,
        ]);

        $this->patchJson("/api/cash-collections/{$collectionId}", [
            'delivery_fee_collected' => 3500,
        ])
            ->assertOk()
            ->assertJsonPath('total_cash_collected', '3500.00');

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 3500,
        ]);

        $this->patchJson("/api/cash-collections/{$collectionId}", [
            'rider_id' => $nextRider->id,
        ])->assertOk();

        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 0,
        ]);
        $this->assertDatabaseHas('riders', [
            'id' => $nextRider->id,
            'cash_held' => 3500,
        ]);

        $this->deleteJson("/api/cash-collections/{$collectionId}")
            ->assertOk()
            ->assertJsonPath('message', 'Cash collection deleted.');

        $this->assertDatabaseMissing('cash_collections', ['id' => $collectionId]);
        $this->assertDatabaseHas('riders', [
            'id' => $nextRider->id,
            'cash_held' => 0,
        ]);
    }

    public function test_office_can_manage_users_customers_and_shops()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $userResponse = $this->postJson('/api/users', [
            'name' => 'Managed Client',
            'email' => 'managed-client@example.test',
            'phone' => '09 600 100 100',
            'role' => User::ROLE_CLIENT,
            'password' => 'secret-pass',
        ])
            ->assertCreated()
            ->assertJsonPath('role', User::ROLE_CLIENT);

        $customerResponse = $this->postJson('/api/customers', [
            'user_id' => $userResponse->json('id'),
            'name' => 'Managed Client',
            'phone' => '09 600 100 100',
            'email' => 'managed-client@example.test',
            'type' => 'business',
            'address' => 'Hledan, Yangon',
        ])
            ->assertCreated()
            ->assertJsonPath('type', 'business');

        $shopResponse = $this->postJson('/api/shops', [
            'customer_id' => $customerResponse->json('id'),
            'name' => 'Managed Shop',
            'contact_name' => 'Shop Counter',
            'phone' => '09 600 100 101',
            'address' => 'Yankin, Yangon',
            'status' => 'active',
        ])
            ->assertCreated()
            ->assertJsonPath('customer.name', 'Managed Client');

        $this->patchJson('/api/shops/' . $shopResponse->json('id'), [
            'status' => 'inactive',
        ])->assertOk()->assertJsonPath('status', 'inactive');

        $this->getJson('/api/customers?search=Managed')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->assertDatabaseHas('admin_logs', [
            'action' => 'user_created',
            'subject_type' => User::class,
            'subject_id' => $userResponse->json('id'),
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'customer_created',
            'subject_type' => Customer::class,
            'subject_id' => $customerResponse->json('id'),
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'shop_updated',
            'subject_type' => Shop::class,
            'subject_id' => $shopResponse->json('id'),
        ]);
    }

    public function test_office_can_search_shipping_addresses_for_a_client()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $clientUser = User::create([
            'name' => 'Searchable Client User',
            'email' => 'searchable-client@example.test',
            'phone' => '09 600 300 100',
            'role' => User::ROLE_CLIENT,
            'password' => Hash::make('password'),
        ]);

        $customer = Customer::create([
            'user_id' => $clientUser->id,
            'name' => 'Searchable Client',
            'phone' => '09 600 300 100',
            'type' => 'individual',
        ]);

        ClientAddress::create([
            'user_id' => $clientUser->id,
            'label' => 'Office Search Home',
            'recipient_name' => 'Managed Receiver',
            'phone' => '09 600 300 300',
            'address' => 'Tamwe, Yangon',
            'is_default' => true,
        ]);

        $this->getJson("/api/shipping-addresses?search=Office&customer_id={$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Office Search Home')
            ->assertJsonPath('data.0.recipient_name', 'Managed Receiver');
    }

    public function test_office_can_manage_settings()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $settingResponse = $this->postJson('/api/settings', [
            'key' => 'brand_color',
            'value' => '#0f766e',
            'group' => 'branding',
            'description' => 'Primary brand color.',
        ])
            ->assertCreated()
            ->assertJsonPath('key', 'brand_color')
            ->assertJsonPath('value', '#0f766e');

        $this->patchJson('/api/settings/' . $settingResponse->json('id'), [
            'value' => '#2563eb',
        ])->assertOk()->assertJsonPath('value', '#2563eb');

        $this->assertDatabaseHas('system_settings', [
            'id' => $settingResponse->json('id'),
            'key' => 'brand_color',
        ]);

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('data.0.key', 'brand_color');

        $this->getJson('/api/settings/public')
            ->assertOk()
            ->assertJsonFragment(['key' => 'brand_color']);

        $this->deleteJson('/api/settings/' . $settingResponse->json('id'))
            ->assertOk();

        $this->assertDatabaseMissing('system_settings', [
            'id' => $settingResponse->json('id'),
        ]);
    }

    public function test_order_can_link_saved_customer_and_shop_with_explicit_delivery_fee()
    {
        $customer = Customer::create([
            'name' => 'Saved Customer',
            'phone' => '09 600 200 100',
            'type' => 'individual',
        ]);
        $shop = Shop::create([
            'customer_id' => $customer->id,
            'name' => 'Saved Shop',
            'phone' => '09 600 200 101',
            'address' => 'Tamwe, Yangon',
        ]);

        $this->postJson('/api/delivery-orders', array_merge($this->validOrderPayload(), [
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'delivery_fee' => 3500,
            'is_fragile' => true,
        ]))
            ->assertCreated()
            ->assertJsonPath('customer_id', $customer->id)
            ->assertJsonPath('shop_id', $shop->id)
            ->assertJsonPath('delivery_fee', '3500.00');
    }

    public function test_order_without_delivery_fee_defaults_to_zero()
    {
        $payload = $this->validOrderPayload();
        unset($payload['delivery_fee']);

        $this->postJson('/api/delivery-orders', $payload)
            ->assertCreated()
            ->assertJsonPath('delivery_fee', '0.00');
    }

    public function test_client_cannot_access_management_crud()
    {
        $this->actingAsRole(User::ROLE_CLIENT);

        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/customers')->assertForbidden();
        $this->getJson('/api/shops')->assertForbidden();
        $this->getJson('/api/shipping-addresses')->assertForbidden();
        $this->getJson('/api/settings')->assertForbidden();
        $this->getJson('/api/settings/public')->assertOk();
    }

    public function test_guest_cannot_access_office_order_queue()
    {
        $this->getJson('/api/delivery-orders')
            ->assertUnauthorized();
    }

    public function test_client_role_cannot_review_payments()
    {
        $this->actingAsRole(User::ROLE_CLIENT);

        $order = DeliveryOrder::create($this->validOrderPayload());
        $payment = $order->payments()->create([
            'type' => 'delivery_fee',
            'method' => 'mobile_banking',
            'amount' => 3000,
            'status' => 'pending_approval',
        ]);

        $this->patchJson("/api/payments/{$payment->id}/review", [
            'status' => 'paid',
        ])->assertForbidden();
    }

    public function test_user_can_create_api_token_with_valid_credentials()
    {
        $user = $this->createUser([
            'email' => 'office@example.test',
            'password' => Hash::make('secret-pass'),
            'role' => User::ROLE_OFFICE_ADMIN,
        ]);

        $this->postJson('/api/auth/token', [
            'email' => $user->email,
            'password' => 'secret-pass',
            'device_name' => 'test-device',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_OFFICE_ADMIN)
            ->assertJsonStructure(['token']);
    }

    public function test_seeded_office_rider_and_client_accounts_can_log_in()
    {
        $this->seed([
            SystemSeeder::class,
            DeliveryDemoSeeder::class,
        ]);

        $accounts = [
            ['email' => 'office@example.test', 'role' => User::ROLE_SUPER_ADMIN],
            ['email' => 'rider@example.test', 'role' => User::ROLE_RIDER],
            ['email' => 'client@example.test', 'role' => User::ROLE_CLIENT],
        ];

        foreach ($accounts as $account) {
            $this->postJson('/api/auth/token', [
                'email' => $account['email'],
                'password' => 'password',
                'device_name' => 'phase-2-test',
            ])
                ->assertOk()
                ->assertJsonPath('user.email', $account['email'])
                ->assertJsonPath('user.role', $account['role'])
                ->assertJsonStructure(['token']);
        }
    }

    public function test_roles_are_blocked_from_wrong_protected_areas()
    {
        $client = $this->actingAsRole(User::ROLE_CLIENT);

        $this->getJson('/api/users')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action is not available for your role.');
        $this->getJson('/api/riders')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action is not available for your role.');

        $rider = $this->actingAsRole(User::ROLE_RIDER);

        $this->getJson('/api/client/profile')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action is not available for your role.');
        $this->getJson('/api/users')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action is not available for your role.');

        $office = $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $this->getJson('/api/client/profile')
            ->assertForbidden()
            ->assertJsonPath('message', 'This action is not available for your role.');
        $this->getJson('/api/users')->assertOk();

        $this->assertTrue($client->hasAnyRole([User::ROLE_CLIENT]));
        $this->assertTrue($rider->hasAnyRole([User::ROLE_RIDER]));
        $this->assertTrue($office->hasAnyRole([User::ROLE_OFFICE_ADMIN, User::ROLE_SUPER_ADMIN]));
    }

    public function test_client_can_register_and_sign_out()
    {
        $registerResponse = $this->postJson('/api/auth/register', [
            'name' => 'New Client',
            'email' => 'new-client@example.test',
            'phone' => '09 777 888 999',
            'password' => 'secret-pass',
            'password_confirmation' => 'secret-pass',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_CLIENT)
            ->assertJsonPath('user.phone', '09 777 888 999')
            ->assertJsonStructure(['token']);

        $this->assertDatabaseHas('users', [
            'email' => 'new-client@example.test',
            'phone' => '09 777 888 999',
            'role' => User::ROLE_CLIENT,
        ]);

        $this->withToken($registerResponse->json('token'))
            ->postJson('/api/auth/logout')
            ->assertOk();
    }

    public function test_client_registration_requires_a_unique_phone_number()
    {
        $this->createUser([
            'email' => 'existing-client@example.test',
            'phone' => '09 111 222 333',
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Duplicate Phone',
            'email' => 'new-phone-client@example.test',
            'phone' => '09 111 222 333',
            'password' => 'secret-pass',
            'password_confirmation' => 'secret-pass',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }

    public function test_client_can_update_profile_and_manage_shipping_addresses()
    {
        $client = $this->createUser([
            'email' => 'profile-client@example.test',
            'phone' => '09 555 000 100',
            'role' => User::ROLE_CLIENT,
        ]);

        Sanctum::actingAs($client);

        $this->patchJson('/api/client/profile', [
            'name' => 'Updated Profile Client',
            'email' => 'updated-profile-client@example.test',
            'phone' => '09 555 000 101',
        ])
            ->assertOk()
            ->assertJsonPath('name', 'Updated Profile Client')
            ->assertJsonPath('phone', '09 555 000 101');

        $this->assertDatabaseHas('customers', [
            'user_id' => $client->id,
            'name' => 'Updated Profile Client',
            'phone' => '09 555 000 101',
        ]);

        $homeResponse = $this->postJson('/api/client/addresses', [
            'label' => 'Home',
            'recipient_name' => 'Updated Profile Client',
            'phone' => '09 555 000 101',
            'address' => 'Home Street',
        ])
            ->assertCreated()
            ->assertJsonPath('is_default', true);

        $officeResponse = $this->postJson('/api/client/addresses', [
            'label' => 'Office',
            'recipient_name' => 'Updated Profile Client',
            'phone' => '09 555 000 102',
            'address' => 'Office Street',
            'is_default' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('is_default', true);

        $this->assertDatabaseHas('client_addresses', [
            'id' => $homeResponse->json('id'),
            'is_default' => false,
        ]);

        $this->patchJson('/api/client/addresses/' . $homeResponse->json('id') . '/default')
            ->assertOk()
            ->assertJsonPath('is_default', true);

        $this->deleteJson('/api/client/addresses/' . $homeResponse->json('id'))
            ->assertOk()
            ->assertJsonPath('message', 'Address deleted.');

        $this->assertDatabaseHas('client_addresses', [
            'id' => $officeResponse->json('id'),
            'is_default' => true,
        ]);
    }

    public function test_client_can_save_one_default_business_pickup_shop()
    {
        $client = $this->createUser([
            'email' => 'shop-client@example.test',
            'phone' => '09 555 000 150',
            'role' => User::ROLE_CLIENT,
        ]);
        $customer = Customer::create([
            'user_id' => $client->id,
            'name' => 'Shop Client',
            'phone' => '09 555 000 150',
            'type' => 'business',
        ]);

        Sanctum::actingAs($client);

        $firstShop = $this->postJson('/api/client/shops', [
            'customer_id' => $customer->id,
            'name' => 'First Pickup Shop',
            'contact_name' => 'Front Desk',
            'phone' => '09 555 000 151',
            'address' => 'First Pickup Street',
        ])
            ->assertCreated()
            ->assertJsonPath('is_default', true);

        $this->getJson('/api/client/shops')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $firstShop->json('id'));

        $this->patchJson('/api/client/shops/' . $firstShop->json('id'), [
            'name' => 'Updated Pickup Shop',
            'contact_name' => 'Updated Counter',
            'phone' => '09 555 000 151',
            'address' => 'Updated Pickup Street',
            'is_default' => true,
        ])
            ->assertOk()
            ->assertJsonPath('name', 'Updated Pickup Shop')
            ->assertJsonPath('is_default', true);

        $this->assertDatabaseHas('shops', [
            'id' => $firstShop->json('id'),
            'address' => 'Updated Pickup Street',
            'is_default' => true,
        ]);
    }

    public function test_client_cannot_manage_another_clients_shipping_address()
    {
        $owner = $this->createUser([
            'email' => 'address-owner@example.test',
            'role' => User::ROLE_CLIENT,
        ]);
        $otherClient = $this->createUser([
            'email' => 'address-other@example.test',
            'role' => User::ROLE_CLIENT,
        ]);
        $address = ClientAddress::create([
            'user_id' => $owner->id,
            'label' => 'Private',
            'recipient_name' => 'Private Owner',
            'phone' => '09 555 100 200',
            'address' => 'Private Street',
            'is_default' => true,
        ]);

        Sanctum::actingAs($otherClient);

        $this->patchJson("/api/client/addresses/{$address->id}", [
            'label' => 'Changed',
        ])->assertForbidden();
        $this->deleteJson("/api/client/addresses/{$address->id}")
            ->assertForbidden();
    }

    public function test_client_only_sees_their_own_orders()
    {
        $client = $this->createUser(['role' => User::ROLE_CLIENT]);
        $otherClient = $this->createUser([
            'email' => 'other-client@example.test',
            'role' => User::ROLE_CLIENT,
        ]);

        DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $client->id,
            'receiver_name' => 'Visible Receiver',
        ]));
        DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $otherClient->id,
            'receiver_name' => 'Hidden Receiver',
        ]));

        Sanctum::actingAs($client);

        $this->getJson('/api/delivery-orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.receiver_name', 'Visible Receiver');
    }

    public function test_client_can_update_their_own_pending_delivery_request()
    {
        $client = $this->createUser(['role' => User::ROLE_CLIENT]);
        $order = DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $client->id,
            'status' => 'pending',
            'receiver_name' => 'Original Receiver',
        ]));

        Sanctum::actingAs($client);

        $this->patchJson("/api/delivery-orders/{$order->id}", [
            'receiver_name' => 'Updated Receiver',
            'receiver_phone' => '09 777 111 222',
            'receiver_address' => 'Updated Street, Yangon',
            'product_name' => 'Updated package',
            'product_payment_method' => 'rider_collects',
            'cod_amount' => 0,
            'client_note' => 'Please call first.',
            'status' => 'approved',
            'payment_status' => 'paid',
        ])
            ->assertOk()
            ->assertJsonPath('receiver_name', 'Updated Receiver')
            ->assertJsonPath('receiver_phone', '09 777 111 222')
            ->assertJsonPath('product_payment_method', 'rider_collects')
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('payment_status', 'unpaid');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $order->id,
            'receiver_name' => 'Updated Receiver',
            'product_payment_method' => 'rider_collects',
            'cod_amount' => 0,
            'status' => 'pending',
            'payment_status' => 'unpaid',
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'delivery_order_updated',
            'subject_type' => DeliveryOrder::class,
            'subject_id' => $order->id,
            'actor_type' => User::ROLE_CLIENT,
            'actor_id' => $client->id,
        ]);
    }

    public function test_client_can_delete_their_own_pending_delivery_request()
    {
        $client = $this->createUser(['role' => User::ROLE_CLIENT]);
        $order = DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $client->id,
            'status' => 'pending',
        ]));

        Sanctum::actingAs($client);

        $this->deleteJson("/api/delivery-orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Delivery order deleted.');

        $this->assertDatabaseMissing('delivery_orders', ['id' => $order->id]);
        $this->assertDatabaseHas('admin_logs', [
            'action' => 'delivery_order_deleted',
            'subject_type' => DeliveryOrder::class,
            'subject_id' => $order->id,
            'actor_type' => User::ROLE_CLIENT,
            'actor_id' => $client->id,
        ]);
    }

    public function test_client_cannot_update_or_delete_other_or_reviewed_delivery_requests()
    {
        $client = $this->createUser(['role' => User::ROLE_CLIENT]);
        $otherClient = $this->createUser([
            'email' => 'other-owner@example.test',
            'role' => User::ROLE_CLIENT,
        ]);
        $otherOrder = DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $otherClient->id,
            'status' => 'pending',
        ]));
        $approvedOrder = DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $client->id,
            'status' => 'approved',
        ]));

        Sanctum::actingAs($client);

        $this->patchJson("/api/delivery-orders/{$otherOrder->id}", [
            'receiver_name' => 'Attempted Update',
        ])->assertForbidden();

        $this->patchJson("/api/delivery-orders/{$approvedOrder->id}", [
            'receiver_name' => 'Late Update',
        ])->assertUnprocessable();

        $this->deleteJson("/api/delivery-orders/{$approvedOrder->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $approvedOrder->id,
            'receiver_name' => 'May Thu',
            'status' => 'approved',
        ]);
    }

    public function test_authenticated_client_submission_is_attached_to_their_account()
    {
        $client = $this->createUser([
            'name' => 'Phone Client',
            'phone' => '09 444 555 666',
            'role' => User::ROLE_CLIENT,
        ]);

        Sanctum::actingAs($client);

        $this->postJson('/api/delivery-orders', array_merge($this->validOrderPayload(), [
            'client_name' => $client->name,
            'client_phone' => $client->phone,
        ]))
            ->assertCreated()
            ->assertJsonPath('client_user_id', $client->id)
            ->assertJsonPath('client_phone', '09 444 555 666');

        $this->assertDatabaseHas('delivery_orders', [
            'client_user_id' => $client->id,
            'client_name' => 'Phone Client',
            'client_phone' => '09 444 555 666',
        ]);
    }

    public function test_bearer_token_client_submission_links_customer_and_shop_records()
    {
        $client = $this->createUser([
            'name' => 'Bearer Client',
            'email' => 'bearer-client@example.test',
            'phone' => '09 444 555 777',
            'role' => User::ROLE_CLIENT,
        ]);

        $token = $client->createToken('browser-test')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson('/api/delivery-orders', array_merge($this->validOrderPayload(), [
                'client_name' => $client->name,
                'client_phone' => $client->phone,
                'pickup_contact_name' => 'Bearer Pickup Shop',
                'pickup_phone' => '09 444 555 778',
                'pickup_address' => 'Yankin Test Street',
            ]))
            ->assertCreated()
            ->assertJsonPath('client_user_id', $client->id);

        $this->assertNotNull($response->json('customer_id'));
        $this->assertNotNull($response->json('shop_id'));
        $this->assertDatabaseHas('customers', [
            'id' => $response->json('customer_id'),
            'user_id' => $client->id,
            'phone' => '09 444 555 777',
        ]);
        $this->assertDatabaseHas('shops', [
            'id' => $response->json('shop_id'),
            'phone' => '09 444 555 778',
            'name' => 'Bearer Pickup Shop',
        ]);
    }

    public function test_assignment_creates_notifications_for_client_and_rider()
    {
        $client = $this->createUser([
            'email' => 'notify-client@example.test',
            'role' => User::ROLE_CLIENT,
        ]);
        $riderUser = $this->createUser([
            'email' => 'notify-rider@example.test',
            'role' => User::ROLE_RIDER,
        ]);
        $rider = $this->createRider([
            'code' => 'R-NOTIFY',
            'phone' => '09 222 333 444',
            'user_id' => $riderUser->id,
        ]);
        $order = DeliveryOrder::create(array_merge($this->validOrderPayload(), [
            'client_user_id' => $client->id,
        ]));

        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $this->postJson("/api/delivery-orders/{$order->id}/assign", [
            'rider_id' => $rider->id,
        ])->assertOk();

        $this->assertSame(1, $client->notifications()->count());
        $this->assertSame(1, $riderUser->notifications()->count());

        Sanctum::actingAs($client);

        $response = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.data.title', 'Rider assigned')
            ->assertJsonPath('data.0.data.order_code', $order->code)
            ->assertJsonPath('data.0.read_at', null);

        $this->patchJson("/api/notifications/{$response->json('data.0.id')}/read")
            ->assertOk();

        $this->assertNotNull($client->notifications()->first()->read_at);
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

    private function actingAsRole(string $role): User
    {
        $user = $this->createUser(['role' => $role]);

        Sanctum::actingAs($user);

        return $user;
    }

    private function createUser(array $attributes = []): User
    {
        return User::create($attributes + [
            'name' => 'Test User',
            'email' => 'user-' . uniqid() . '@example.test',
            'phone' => '09 ' . random_int(100, 999) . ' ' . random_int(100, 999) . ' ' . random_int(100, 999),
            'password' => Hash::make('password'),
            'role' => User::ROLE_CLIENT,
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
            'delivery_fee_payment_method' => 'cash',
            'product_payment_method' => 'already_paid',
            'delivery_fee' => 0,
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
