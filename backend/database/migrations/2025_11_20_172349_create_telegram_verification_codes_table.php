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
        Schema::create('telegram_verification_codes', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->string('code', 4);
            $table->string('chat_id');
            $table->timestamp('expires_at');
            $table->boolean('used')->default(false);
            $table->timestamps();

            $table->index(['email', 'code', 'used']);
            $table->index(['chat_id', 'used']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telegram_verification_codes');
    }
};
