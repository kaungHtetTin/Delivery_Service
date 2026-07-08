<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_collections', function (Blueprint $table) {
            if (Schema::hasColumn('cash_collections', 'confirmed_at')) {
                $table->dropColumn('confirmed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cash_collections', function (Blueprint $table) {
            if (! Schema::hasColumn('cash_collections', 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('payment_note');
            }
        });
    }
};
