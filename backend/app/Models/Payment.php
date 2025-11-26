<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'bill_share_id',
        'recorded_by',
        'amount',
        'paid_on',
        'method',
        'reference',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_on' => 'date',
    ];

    public function billShare()
    {
        return $this->belongsTo(BillShare::class);
    }

    public function recordedBy()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
