<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('delivery_orders', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('client_user_id')->constrained()->nullOnDelete();
            $table->foreignId('shop_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('delivery_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shop_id');
            $table->dropConstrainedForeignId('customer_id');
        });
    }
};
