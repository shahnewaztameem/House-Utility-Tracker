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
        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('for_month');
            $table->date('due_date')->nullable();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->enum('status', ['draft', 'issued', 'partial', 'paid', 'overdue'])->default('draft');
            $table->unsignedInteger('electricity_units')->default(0);
            $table->decimal('electricity_rate', 10, 2)->default(0);
            $table->decimal('electricity_bill', 12, 2)->default(0);
            $table->json('line_items')->nullable();
            $table->decimal('total_due', 12, 2)->default(0);
            $table->decimal('returned_amount', 12, 2)->default(0);
            $table->decimal('final_total', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bills');
    }
};
