<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    protected $fillable = [
        'first_name', 'last_name', 'email', 'phone', 'subject', 'message',
        'consent_at', 'read_at', 'notification_status', 'notification_recipients',
        'notification_sent_at', 'notification_error',
    ];

    protected function casts(): array
    {
        return [
            'consent_at' => 'datetime',
            'read_at' => 'datetime',
            'notification_recipients' => 'array',
            'notification_sent_at' => 'datetime',
        ];
    }
}
