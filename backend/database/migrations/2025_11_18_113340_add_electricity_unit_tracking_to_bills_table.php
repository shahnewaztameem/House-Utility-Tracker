<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->unsignedInteger('electricity_start_unit')->nullable()->after('electricity_units');
            $table->unsignedInteger('electricity_end_unit')->nullable()->after('electricity_start_unit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->dropColumn(['electricity_start_unit', 'electricity_end_unit']);
        });
    }
};
