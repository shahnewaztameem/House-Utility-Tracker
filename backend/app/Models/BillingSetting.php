<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillingSetting extends Model
{
    protected $fillable = [
        'key',
        'label',
        'amount',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'metadata' => 'array',
    ];
}
