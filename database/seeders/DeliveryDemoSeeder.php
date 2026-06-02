<?php

namespace Database\Seeders;

use App\Models\DeliveryOrder;
use App\Models\Payment;
use App\Models\Rider;
use Illuminate\Database\Seeder;

class DeliveryDemoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $aungKyaw = Rider::updateOrCreate(
            ['code' => 'R-001'],
            [
                'name' => 'Aung Kyaw',
                'phone' => '09 772 883 120',
                'status' => 'busy',
                'vehicle_type' => 'motorbike',
                'current_area' => 'Kamayut',
                'last_active_at' => now()->subMinute(),
                'cash_held' => 18500,
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
                'cash_held' => 15000,
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
                'delivery_fee_payment_method' => 'mobile_banking',
                'product_payment_method' => 'already_paid',
                'delivery_fee' => 3000,
                'payment_status' => 'pending_approval',
                'status' => 'pending',
                'client_note' => 'Call receiver before arrival.',
            ]
        );
        $pendingOrder->statusHistories()->firstOrCreate(['status' => 'pending']);
        Payment::updateOrCreate(
            ['delivery_order_id' => $pendingOrder->id, 'type' => 'delivery_fee'],
            [
                'method' => 'mobile_banking',
                'amount' => 3000,
                'status' => 'pending_approval',
            ]
        );

        $activeOrder = DeliveryOrder::updateOrCreate(
            ['code' => 'FD-240620'],
            [
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
                'product_payment_method' => 'rider_collects',
                'cod_amount' => 18500,
                'delivery_fee' => 2500,
                'payment_status' => 'unpaid',
                'status' => 'going_to_pickup',
                'rider_id' => $aungKyaw->id,
                'assigned_at' => now()->subMinutes(12),
            ]
        );
        foreach (['pending', 'approved', 'rider_assigned', 'rider_accepted', 'going_to_pickup'] as $status) {
            $activeOrder->statusHistories()->firstOrCreate(['status' => $status]);
        }
    }
}
