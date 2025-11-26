<?php

namespace App\Models;

use App\Enums\BillShareStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillShare extends Model
{
    use HasFactory;

    protected $fillable = [
        'bill_id',
        'user_id',
        'status',
        'amount_due',
        'amount_paid',
        'last_paid_at',
        'notes',
    ];

    protected $casts = [
        'status' => BillShareStatus::class,
        'amount_due' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'last_paid_at' => 'datetime',
    ];

    public function bill()
    {
        return $this->belongsTo(Bill::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
