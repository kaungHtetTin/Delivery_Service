<?php

namespace Tests\Feature;

use App\Models\DeliveryOrder;
use App\Models\Rider;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
