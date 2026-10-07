<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BrowserExtension extends Model
{
    protected $fillable = [
        'installation_id',
        'name',
        'type',
        'version',
        'machine_name',
        'whatsapp_number',
        'enabled',
        'settings',
        'last_seen_at',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'settings' => 'array',
        'last_seen_at' => 'datetime',
    ];
}
