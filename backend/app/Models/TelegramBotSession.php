<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TelegramBotSession extends Model
{
    protected $fillable = [
        'chat_id',
        'user_id',
        'state',
        'pending_email',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function setState(string $state): void
    {
        $this->update(['state' => $state]);
    }

    public function setData(string $key, $value): void
    {
        $data = $this->data ?? [];
        $data[$key] = $value;
        $this->update(['data' => $data]);
    }

    public function getData(string $key, $default = null)
    {
        return $this->data[$key] ?? $default;
    }
}
