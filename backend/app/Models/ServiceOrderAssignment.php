<?php
namespace App\Models; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ServiceOrderAssignment extends Model { protected $fillable=['user_id','assigned_by']; public function user():BelongsTo{return $this->belongsTo(User::class);} public function order():BelongsTo{return $this->belongsTo(ServiceOrder::class,'service_order_id');} }
