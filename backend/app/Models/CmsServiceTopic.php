<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
class CmsServiceTopic extends Model {
 protected $fillable=['name','slug','image_url','is_active'];
 protected $casts=['is_active'=>'boolean'];
 public function posts():HasMany{return $this->hasMany(Post::class,'service_topic_id');}
}
