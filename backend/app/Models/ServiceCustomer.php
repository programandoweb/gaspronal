<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
class ServiceCustomer extends Model { use HasFactory, SoftDeletes; protected $fillable=['user_id','commercial_lead_id','name','document','email','phone','whatsapp','addresses','reference']; protected function casts():array{return ['addresses'=>'array'];} public function user():BelongsTo{return $this->belongsTo(User::class);} public function lead():BelongsTo{return $this->belongsTo(CommercialLead::class,'commercial_lead_id');} public function orders():HasMany{return $this->hasMany(ServiceOrder::class,'customer_id');} }
