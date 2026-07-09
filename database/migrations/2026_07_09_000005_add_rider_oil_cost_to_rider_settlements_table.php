<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rider_settlements', function (Blueprint $table) {
            $table->decimal('rider_oil_cost', 12, 2)->default(0)->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('rider_settlements', function (Blueprint $table) {
            $table->dropColumn('rider_oil_cost');
        });
    }
};
