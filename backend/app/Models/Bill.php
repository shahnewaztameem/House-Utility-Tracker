<?php

namespace App\Models;

use App\Enums\BillStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Bill extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'reference',
        'for_month',
        'due_date',
        'period_start',
        'period_end',
        'status',
        'electricity_units',
        'electricity_start_unit',
        'electricity_end_unit',
        'electricity_rate',
        'electricity_bill',
        'line_items',
        'total_due',
        'returned_amount',
        'final_total',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'due_date' => 'date',
        'period_start' => 'date',
        'period_end' => 'date',
        'line_items' => 'array',
        'status' => BillStatus::class,
        'electricity_bill' => 'decimal:2',
        'total_due' => 'decimal:2',
        'returned_amount' => 'decimal:2',
        'final_total' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::creating(function (Bill $bill) {
            if (! $bill->reference) {
                $bill->reference = 'BILL-' . Str::upper(Str::random(8));
            }
        });
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function shares()
    {
        return $this->hasMany(BillShare::class);
    }

    public function payments()
    {
        return $this->hasManyThrough(
            Payment::class,
            BillShare::class,
            'bill_id',
            'bill_share_id'
        );
    }
}
