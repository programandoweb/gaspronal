<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PageBlock extends Model {
    protected $fillable = ['page_key', 'block_key', 'label', 'content', 'is_active', 'sort_order'];
    protected $casts = ['content' => 'array', 'is_active' => 'boolean'];
}
