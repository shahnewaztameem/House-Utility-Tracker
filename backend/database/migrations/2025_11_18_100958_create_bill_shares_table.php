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
        Schema::create('bill_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('bills')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'partial', 'paid'])->default('pending');
            $table->decimal('amount_due', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->timestamp('last_paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bill_shares');
    }
};
