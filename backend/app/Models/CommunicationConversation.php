<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CommunicationConversation extends Model
{
    protected $fillable = [
        'provider_id', 'user_id', 'channel', 'agent_id', 'external_thread_id', 'web_token_hash',
        'contact_phone', 'contact_name', 'initial_path', 'status', 'human_takeover_at',
        'data_processing_consent_at', 'data_processing_policy_version', 'last_message_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'human_takeover_at' => 'datetime',
            'last_message_at' => 'datetime',
            'data_processing_consent_at' => 'datetime',
            'expires_at' => 'datetime',
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
