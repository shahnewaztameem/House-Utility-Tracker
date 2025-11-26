<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ElectricityReading extends Model
{
    use HasFactory;

    protected $fillable = [
        'month',
        'year',
        'start_unit',
        'end_unit',
        'recorded_by',
    ];

    protected $casts = [
        'year' => 'integer',
        'start_unit' => 'integer',
        'end_unit' => 'integer',
    ];

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
