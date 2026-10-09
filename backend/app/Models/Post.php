<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class Post extends Model {
 protected $fillable=['category_id','title','slug','excerpt','content','featured_image','gallery','status','seo_title','seo_description','og_image','published_at'];
 protected $casts=['published_at'=>'datetime','gallery'=>'array'];
 protected $appends=['public_url'];
 public function category():BelongsTo{return $this->belongsTo(PostCategory::class,'category_id');}
 public function getPublicUrlAttribute():string{return $this->category?->slug === "servicios" ? "/2019/servicios/{$this->slug}" : "/gaspro-notas/{$this->slug}";}
}