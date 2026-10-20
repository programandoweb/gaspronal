<?php
namespace App\Models; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ServiceOrderActivity extends Model { protected $fillable=['user_id','description','arrived_at','departed_at','observations','recommendations']; protected function casts():array{return ['arrived_at'=>'datetime','departed_at'=>'datetime'];} public function user():BelongsTo{return $this->belongsTo(User::class);} }
