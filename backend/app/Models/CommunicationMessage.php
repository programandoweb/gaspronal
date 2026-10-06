<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunicationMessage extends Model
{
    protected $fillable = [
        'conversation_id', 'provider_id', 'direction', 'sender_type',
        'external_message_id', 'content', 'status', 'metadata', 'sent_at', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'sent_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(CommunicationConversation::class, 'conversation_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(CommunicationProvider::class, 'provider_id');
    }
}
