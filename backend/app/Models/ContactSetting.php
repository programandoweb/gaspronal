<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactSetting extends Model
{
    protected $fillable = ['id', 'notification_emails'];

    protected function casts(): array
    {
        return ['notification_emails' => 'array'];
    }
}
