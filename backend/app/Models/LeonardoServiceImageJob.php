<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeonardoServiceImageJob extends Model
{
    protected $fillable = ['post_id','batch_uuid','variant','status','attempts','generated_image','provider','model','prompt','error','started_at','finished_at'];
    protected $casts = ['started_at'=>'datetime','finished_at'=>'datetime'];
    public function post(): BelongsTo { return $this->belongsTo(Post::class); }
}
