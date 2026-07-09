<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_tile_cache_entries', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('default');
            $table->unsignedSmallInteger('z');
            $table->unsignedInteger('x');
            $table->unsignedInteger('y');
            $table->string('path')->unique();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->unsignedInteger('hit_count')->default(0);
            $table->timestamp('cached_at')->nullable();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'z', 'x', 'y']);
            $table->index(['hit_count', 'last_accessed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_tile_cache_entries');
    }
};
