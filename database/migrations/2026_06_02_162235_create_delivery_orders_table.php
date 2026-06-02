<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('delivery_orders', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('client_name');
            $table->string('client_phone');
            $table->string('pickup_contact_name');
            $table->string('pickup_phone');
            $table->text('pickup_address');
            $table->decimal('pickup_latitude', 10, 7)->nullable();
            $table->decimal('pickup_longitude', 10, 7)->nullable();
            $table->string('receiver_name');
            $table->string('receiver_phone');
            $table->text('receiver_address');
            $table->decimal('receiver_latitude', 10, 7)->nullable();
            $table->decimal('receiver_longitude', 10, 7)->nullable();
            $table->string('product_name');
            $table->string('product_category')->nullable();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->decimal('product_value', 12, 2)->nullable();
            $table->boolean('is_fragile')->default(false);
            $table->text('special_handling_note')->nullable();
            $table->string('delivery_fee_payment_method')->default('cash_on_delivery');
            $table->string('product_payment_method')->default('rider_collects');
            $table->decimal('cod_amount', 12, 2)->default(0);
            $table->decimal('prepaid_amount', 12, 2)->default(0);
            $table->decimal('delivery_fee', 12, 2)->default(0);
            $table->string('payment_status')->default('unpaid')->index();
            $table->string('status')->default('pending')->index();
            $table->foreignId('rider_id')->nullable()->constrained()->nullOnDelete();
            $table->text('client_note')->nullable();
            $table->text('internal_note')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['rider_id', 'status']);
            $table->index(['client_phone', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('delivery_orders');
    }
};
