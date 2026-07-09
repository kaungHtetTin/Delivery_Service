<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rider_locations', function (Blueprint $table) {
            $table->decimal('heading', 6, 2)->nullable()->after('speed');
            $table->string('source', 30)->default('browser')->after('battery_percent');
            $table->index(['delivery_order_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::table('rider_locations', function (Blueprint $table) {
            $table->dropIndex(['delivery_order_id', 'recorded_at']);
            $table->dropColumn(['heading', 'source']);
        });
    }
};
