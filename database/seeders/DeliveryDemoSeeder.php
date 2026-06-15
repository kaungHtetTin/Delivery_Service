<?php

namespace Database\Seeders;

use App\Models\CashCollection;
use App\Models\DeliveryOrder;
use App\Models\ClientAddress;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Rider;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DeliveryDemoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $clientUser = User::updateOrCreate(
            ['email' => 'client@example.test'],
            [
                'name' => 'Moe Thandar',
                'phone' => '09 774 221 890',
                'password' => Hash::make('password'),
                'role' => User::ROLE_CLIENT,
            ]
        );
        $riderUser = User::updateOrCreate(
            ['email' => 'rider@example.test'],
            [
                'name' => 'Aung Kyaw',
                'phone' => '09 772 883 120',
                'password' => Hash::make('password'),
                'role' => User::ROLE_RIDER,
            ]
        );

        $individualCustomer = Customer::updateOrCreate(
            ['phone' => '09 774 221 890'],
            [
                'user_id' => $clientUser->id,
                'name' => 'Moe Thandar',
                'email' => 'client@example.test',
                'type' => 'individual',
                'address' => 'Sanchaung Street, Sanchaung',
                'note' => 'Prefers evening delivery updates.',
            ]
        );
        $businessCustomer = Customer::updateOrCreate(
            ['phone' => '09 963 210 448'],
            [
                'user_id' => $clientUser->id,
                'name' => 'City Mart Express',
                'type' => 'business',
                'address' => 'City Mart, Hledan',
                'note' => 'Frequent grocery pickup partner.',
            ]
        );
        $linnFashion = Shop::updateOrCreate(
            ['phone' => '09 790 331 482'],
            [
                'customer_id' => $individualCustomer->id,
                'name' => 'Linn Fashion',
                'contact_name' => 'Linn Fashion Counter',
                'address' => 'Kabar Aye Market, Yankin',
                'status' => 'active',
                'is_default' => false,
            ]
        );
        $cityMartShop = Shop::updateOrCreate(
            ['phone' => '09 963 210 448'],
            [
                'customer_id' => $businessCustomer->id,
                'name' => 'City Mart Hledan',
                'contact_name' => 'City Mart Counter 4',
                'address' => 'City Mart, Hledan',
                'status' => 'active',
                'is_default' => true,
            ]
        );

        ClientAddress::updateOrCreate(
            ['user_id' => $clientUser->id, 'label' => 'Home'],
            [
                'recipient_name' => 'Moe Thandar',
                'phone' => '09 774 221 890',
                'address' => 'Sanchaung Street, Sanchaung',
                'is_default' => true,
                'note' => 'Call before arrival.',
            ]
        );

        $aungKyaw = Rider::updateOrCreate(
            ['code' => 'R-001'],
            [
                'user_id' => $riderUser->id,
                'name' => 'Aung Kyaw',
                'phone' => '09 772 883 120',
                'status' => 'busy',
                'vehicle_type' => 'motorbike',
                'current_area' => 'Kamayut',
                'last_active_at' => now()->subMinute(),
                'cash_held' => 3000,
            ]
        );
        Rider::updateOrCreate(
            ['code' => 'R-002'],
            [
                'name' => 'Min Thu',
                'phone' => '09 452 319 805',
                'status' => 'available',
                'vehicle_type' => 'motorbike',
                'current_area' => 'Lanmadaw',
                'last_active_at' => now()->subMinutes(2),
                'cash_held' => 2500,
            ]
        );
        Rider::updateOrCreate(
            ['code' => 'R-003'],
            [
                'name' => 'Thiri Ko',
                'phone' => '09 798 420 188',
                'status' => 'available',
                'vehicle_type' => 'motorbike',
                'current_area' => 'Dagon',
                'last_active_at' => now(),
                'cash_held' => 0,
            ]
        );

        $pendingOrder = DeliveryOrder::updateOrCreate(
            ['code' => 'FD-240621'],
            [
                'client_user_id' => $clientUser->id,
                'customer_id' => $individualCustomer->id,
                'shop_id' => $linnFashion->id,
                'client_name' => 'Moe Thandar',
                'client_phone' => '09 774 221 890',
                'pickup_contact_name' => 'Linn Fashion',
                'pickup_phone' => '09 790 331 482',
                'pickup_address' => 'Kabar Aye Market, Yankin',
                'receiver_name' => 'May Thu',
                'receiver_phone' => '09 420 882 144',
                'receiver_address' => 'Sanchaung Street, Sanchaung',
                'product_name' => 'Clothing package',
                'product_category' => 'Fashion',
                'quantity' => 1,
                'delivery_fee_payment_method' => 'cash_on_delivery',
                'product_payment_method' => 'already_paid',
                'delivery_fee' => 0,
                'payment_status' => 'unpaid',
                'status' => 'pending',
                'client_note' => 'Call receiver before arrival.',
            ]
        );
        $pendingOrder->statusHistories()->firstOrCreate(['status' => 'pending']);

        $activeOrder = DeliveryOrder::updateOrCreate(
            ['code' => 'FD-240620'],
            [
                'client_user_id' => $clientUser->id,
                'customer_id' => $businessCustomer->id,
                'shop_id' => $cityMartShop->id,
                'client_name' => 'City Mart Express',
                'client_phone' => '09 963 210 448',
                'pickup_contact_name' => 'City Mart Counter 4',
                'pickup_phone' => '09 963 210 448',
                'pickup_address' => 'City Mart, Hledan',
                'receiver_name' => 'Ko Aung',
                'receiver_phone' => '09 778 458 020',
                'receiver_address' => 'Insein Road, Kamayut',
                'product_name' => 'Groceries',
                'product_category' => 'Food',
                'quantity' => 3,
                'delivery_fee_payment_method' => 'cash_on_delivery',
                'product_payment_method' => 'already_paid',
                'delivery_fee' => 0,
                'payment_status' => 'unpaid',
                'status' => 'going_to_pickup',
                'rider_id' => $aungKyaw->id,
                'assigned_at' => now()->subMinutes(12),
            ]
        );
        foreach (['pending', 'approved', 'rider_assigned', 'rider_accepted', 'going_to_pickup'] as $status) {
            $activeOrder->statusHistories()->firstOrCreate(['status' => $status]);
        }

        $completedOrder = DeliveryOrder::updateOrCreate(
            ['code' => 'FD-240619'],
            [
                'client_user_id' => $clientUser->id,
                'customer_id' => $businessCustomer->id,
                'shop_id' => $cityMartShop->id,
                'client_name' => 'City Mart Express',
                'client_phone' => '09 963 210 448',
                'pickup_contact_name' => 'City Mart Counter 4',
                'pickup_phone' => '09 963 210 448',
                'pickup_address' => 'City Mart, Hledan',
                'receiver_name' => 'Daw Hnin',
                'receiver_phone' => '09 455 220 330',
                'receiver_address' => 'Baho Road, Sanchaung',
                'product_name' => 'Household items',
                'product_category' => 'Groceries',
                'quantity' => 2,
                'delivery_fee_payment_method' => 'cash',
                'product_payment_method' => 'already_paid',
                'delivery_fee' => 3000,
                'payment_status' => 'paid',
                'status' => 'completed',
                'rider_id' => $aungKyaw->id,
                'assigned_at' => now()->subDay()->subHours(2),
                'picked_up_at' => now()->subDay()->subHour(),
                'delivered_at' => now()->subDay()->subMinutes(20),
                'completed_at' => now()->subDay()->subMinutes(15),
            ]
        );
        foreach ([
            'pending',
            'approved',
            'rider_assigned',
            'rider_accepted',
            'going_to_pickup',
            'arrived_at_pickup',
            'picked_up',
            'going_to_delivery',
            'arrived_at_delivery',
            'delivered',
            'completed',
        ] as $status) {
            $completedOrder->statusHistories()->firstOrCreate(['status' => $status]);
        }

        CashCollection::updateOrCreate(
            ['delivery_order_id' => $completedOrder->id],
            [
                'rider_id' => $aungKyaw->id,
                'product_cash_collected' => 0,
                'delivery_fee_collected' => 3000,
                'total_cash_collected' => 3000,
            ]
        );
        $aungKyaw->update(['cash_held' => 3000]);
    }
}
