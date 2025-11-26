<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'telegram_chat_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
        ];
    }

    public function billsCreated()
    {
        return $this->hasMany(Bill::class, 'created_by');
    }

    public function billShares()
    {
        return $this->hasMany(BillShare::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'recorded_by');
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === Role::SUPER_ADMIN;
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, [Role::SUPER_ADMIN, Role::ADMIN], true);
    }

    public function scopeForRole($query, Role|string $role)
    {
        $value = $role instanceof Role ? $role->value : $role;

        return $query->where('role', $value);
    }
}
