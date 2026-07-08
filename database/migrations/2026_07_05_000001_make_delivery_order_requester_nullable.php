<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE delivery_orders MODIFY client_name VARCHAR(255) NULL');
            DB::statement('ALTER TABLE delivery_orders MODIFY client_phone VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE delivery_orders ALTER COLUMN client_name DROP NOT NULL');
            DB::statement('ALTER TABLE delivery_orders ALTER COLUMN client_phone DROP NOT NULL');
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        DB::table('delivery_orders')->whereNull('client_name')->update(['client_name' => '']);
        DB::table('delivery_orders')->whereNull('client_phone')->update(['client_phone' => '']);

        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE delivery_orders MODIFY client_name VARCHAR(255) NOT NULL');
            DB::statement('ALTER TABLE delivery_orders MODIFY client_phone VARCHAR(255) NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE delivery_orders ALTER COLUMN client_name SET NOT NULL');
            DB::statement('ALTER TABLE delivery_orders ALTER COLUMN client_phone SET NOT NULL');
        }
    }
};
