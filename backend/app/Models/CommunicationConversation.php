<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CommunicationConversation extends Model
{
    protected $fillable = [
        'provider_id', 'user_id', 'channel', 'agent_id', 'external_thread_id',
        'contact_phone', 'contact_name', 'status', 'human_takeover_at', 'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'human_takeover_at' => 'datetime',
            'last_message_at' => 'datetime',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(CommunicationProvider::class, 'provider_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(CommunicationMessage::class, 'conversation_id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(CommunicationMessage::class, 'conversation_id')->latestOfMany();
    }
}
