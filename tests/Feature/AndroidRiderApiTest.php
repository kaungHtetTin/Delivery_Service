<?php

namespace Tests\Feature;

use App\Models\CashCollection;
use App\Models\DeliveryOrder;
use App\Models\PushSubscription;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AndroidRiderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_android_rider_login_returns_mobile_bootstrap_payload(): void
    {
        $user = $this->createUser([
            'email' => 'rider-login@example.test',
            'role' => User::ROLE_RIDER,
        ]);
        $rider = $this->createRider(['user_id' => $user->id]);

        $this->postJson('/api/android/rider/auth/token', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Pixel rider app',
            'fcm_token' => 'android-fcm-token',
        ])
            ->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('user.role', User::ROLE_RIDER)
            ->assertJsonPath('rider.id', $rider->id)
            ->assertJsonPath('app_config.portal_name', 'Rider');

        $this->assertDatabaseHas('push_subscriptions', [
            'user_id' => $user->id,
            'token' => 'android-fcm-token',
            'platform' => 'android',
        ]);
    }

    public function test_android_rider_login_rejects_non_rider_accounts(): void
    {
        $client = $this->createUser([
            'email' => 'client-login@example.test',
            'role' => User::ROLE_CLIENT,
        ]);

        $this->postJson('/api/android/rider/auth/token', [
            'email' => $client->email,
            'password' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_android_rider_bootstrap_and_jobs_are_scoped_to_current_rider(): void
    {
        [$user, $rider] = $this->actingAsAndroidRider();
        $activeOrder = $this->createOrder([
            'status' => 'rider_assigned',
            'rider_id' => $rider->id,
        ]);
        $this->createOrder([
            'status' => 'completed',
            'rider_id' => $rider->id,
            'delivery_fee' => 3500,
        ]);
        $otherRider = $this->createRider([
            'code' => 'R-OTHER',
            'phone' => '09 111 222 334',
        ]);
        $this->createOrder([
            'status' => 'rider_assigned',
            'rider_id' => $otherRider->id,
            'receiver_name' => 'Hidden Receiver',
        ]);
        $user->notifications()->create([
            'id' => 'android-test-notification',
            'type' => 'test',
            'data' => ['title' => 'New delivery assignment'],
        ]);

        $this->getJson('/api/android/rider/bootstrap')
            ->assertOk()
            ->assertJsonPath('summary.active_jobs', 1)
            ->assertJsonPath('summary.history_jobs', 1)
            ->assertJsonPath('summary.unread_notifications', 1)
            ->assertJsonPath('rider.code', $rider->code);

        $this->getJson('/api/android/rider/jobs?scope=active')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $activeOrder->id)
            ->assertJsonPath('data.0.next_action.status', 'rider_accepted')
            ->assertJsonPath('data.0.pickup.phone_uri', 'tel:09790331482');
    }

    public function test_android_rider_can_progress_assigned_job_and_complete_cash_collection(): void
    {
        [$user, $rider] = $this->actingAsAndroidRider();
        $order = $this->createOrder([
            'status' => 'delivered',
            'rider_id' => $rider->id,
            'delivery_fee' => 0,
        ]);

        $this->postJson("/api/android/rider/jobs/{$order->id}/action", [
            'status' => 'completed',
            'delivery_fee' => 4200,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('money.delivery_fee', 4200)
            ->assertJsonPath('status_history.0.actor_id', $user->id);

        $this->assertDatabaseHas('cash_collections', [
            'delivery_order_id' => $order->id,
            'rider_id' => $rider->id,
            'delivery_fee_collected' => 4200,
        ]);
        $this->assertSame('4200.00', CashCollection::first()->total_cash_collected);
        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'cash_held' => 4200,
        ]);
    }

    public function test_android_rider_can_send_native_location_without_passing_rider_id(): void
    {
        [, $rider] = $this->actingAsAndroidRider();
        $order = $this->createOrder([
            'status' => 'picked_up',
            'rider_id' => $rider->id,
        ]);

        $this->postJson('/api/android/rider/locations', [
            'delivery_order_id' => $order->id,
            'latitude' => 16.840939,
            'longitude' => 96.173526,
            'accuracy' => 18,
            'battery_percent' => 83,
            'recorded_at' => now()->toIso8601String(),
        ])
            ->assertCreated()
            ->assertJsonPath('location.source', 'native')
            ->assertJsonPath('location.delivery_order_id', $order->id)
            ->assertJsonPath('rider.current_location.latitude', 16.840939);

        $this->assertDatabaseHas('rider_locations', [
            'rider_id' => $rider->id,
            'delivery_order_id' => $order->id,
            'source' => 'native',
        ]);
    }

    public function test_android_rider_can_manage_device_token(): void
    {
        [$user] = $this->actingAsAndroidRider();

        $this->postJson('/api/android/rider/device-token', [
            'fcm_token' => 'native-device-token',
        ])
            ->assertOk()
            ->assertJsonPath('device.platform', 'android');

        $this->assertDatabaseHas('push_subscriptions', [
            'user_id' => $user->id,
            'token' => 'native-device-token',
            'platform' => 'android',
        ]);

        $this->deleteJson('/api/android/rider/device-token', [
            'fcm_token' => 'native-device-token',
        ])->assertOk();

        $this->assertSame(0, PushSubscription::query()->count());
    }

    private function actingAsAndroidRider(): array
    {
        $user = $this->createUser(['role' => User::ROLE_RIDER]);
        $rider = $this->createRider(['user_id' => $user->id]);

        Sanctum::actingAs($user);

        return [$user, $rider];
    }

    private function createUser(array $attributes = []): User
    {
        return User::create($attributes + [
            'name' => 'Android Test User',
            'email' => 'android-' . uniqid() . '@example.test',
            'phone' => '09 ' . random_int(100, 999) . ' ' . random_int(100, 999) . ' ' . random_int(100, 999),
            'password' => Hash::make('password'),
            'role' => User::ROLE_CLIENT,
        ]);
    }

    private function createRider(array $attributes = []): Rider
    {
        return Rider::create($attributes + [
            'code' => 'R-ANDROID',
            'name' => 'Android Rider',
            'phone' => '09 111 222 333',
            'status' => 'available',
            'vehicle_type' => 'motorbike',
            'current_area' => 'Yankin',
        ]);
    }

    private function createOrder(array $attributes = []): DeliveryOrder
    {
        $order = DeliveryOrder::create($attributes + [
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
            'payment_status' => 'unpaid',
        ]);

        $order->statusHistories()->create(['status' => $order->status]);

        return $order;
    }
}
