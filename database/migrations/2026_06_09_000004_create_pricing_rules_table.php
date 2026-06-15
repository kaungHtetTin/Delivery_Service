<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('pricing_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type')->default('fixed')->index();
            $table->decimal('base_fee', 12, 2)->default(0);
            $table->decimal('included_km', 8, 2)->default(0);
            $table->decimal('extra_km_fee', 12, 2)->default(0);
            $table->decimal('fragile_fee', 12, 2)->default(0);
            $table->string('zone')->nullable()->index();
            $table->boolean('is_default')->default(false)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('pricing_rules');
    }
};
