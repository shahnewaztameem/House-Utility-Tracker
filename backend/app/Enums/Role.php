<?php

namespace App\Enums;

enum Role: string
{
    case SUPER_ADMIN = 'super_admin';
    case ADMIN = 'admin';
    case RESIDENT = 'resident';

    public function label(): string
    {
        return match ($this) {
            self::SUPER_ADMIN => 'Super Admin',
            self::ADMIN => 'Admin',
            self::RESIDENT => 'Resident',
        };
    }

    public static function fromString(?string $role): self
    {
        return match ($role) {
            'super_admin' => self::SUPER_ADMIN,
            'admin' => self::ADMIN,
            default => self::RESIDENT,
        };
    }
}

