<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InstagramSetting extends Model
{
    protected $fillable = ['client_id', 'instagram_user_id', 'graph_host', 'access_token'];

    protected $hidden = ['access_token'];

    protected function casts(): array
    {
        return ['access_token' => 'encrypted'];
    }
}
