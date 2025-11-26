<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class TelegramVerificationCode extends Model
{
    protected $fillable = [
        'email',
        'code',
        'chat_id',
        'expires_at',
        'used',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used' => 'boolean',
    ];

    public static function generate(string $email, string $chatId): self
    {
        // Delete old unused codes for this email/chat
        static::where('email', $email)
            ->where('chat_id', $chatId)
            ->where('used', false)
            ->delete();

        return static::create([
            'email' => $email,
            'code' => str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
            'chat_id' => $chatId,
            'expires_at' => now()->addMinutes(10),
            'used' => false,
        ]);
    }

    public function isValid(): bool
    {
        return !$this->used && $this->expires_at->isFuture();
    }

    public function markAsUsed(): void
    {
        $this->update(['used' => true]);
    }
}
