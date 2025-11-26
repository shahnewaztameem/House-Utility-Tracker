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
        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('key')->unique();
            $table->string('label');
            $table->string('icon');
            $table->string('path')->nullable();
            $table->boolean('active')->default(true);
            $table->enum('required_ability', ['manage_bills', 'manage_settings', 'view_all_records'])->nullable();
            $table->enum('required_role', ['super_admin', 'admin', 'resident'])->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });

        // Add foreign key constraint after table is created
        Schema::table('menu_items', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('menu_items')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('menu_items');
    }
};

