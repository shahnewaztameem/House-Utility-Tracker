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
        Schema::create('electricity_readings', function (Blueprint $table) {
            $table->id();
            $table->string('month');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('start_unit')->default(0);
            $table->unsignedInteger('end_unit')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['month', 'year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('electricity_readings');
    }
};
