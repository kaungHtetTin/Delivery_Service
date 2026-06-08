<?php

namespace Tests\Feature;

use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\Rider;
use App\Models\CashCollection;
use App\Models\AdminLog;
use App\Models\User;
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
        $this->actingAsRole(User::ROLE_RIDER);

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
