<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id',
        'key',
        'label',
        'icon',
        'path',
        'active',
        'required_ability',
        'required_role',
        'order',
    ];

    protected $casts = [
        'active' => 'boolean',
        'order' => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(MenuItem::class, 'parent_id')->orderBy('order');
    }

    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    public function scopeRootItems($query)
    {
        return $query->whereNull('parent_id');
    }
}

