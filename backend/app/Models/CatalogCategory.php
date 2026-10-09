<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
class CatalogCategory extends Model {
 protected $fillable=['name','slug','description','image_url','is_active'];
 protected $casts=['is_active'=>'boolean'];
 public function items():HasMany{return $this->hasMany(CatalogItem::class,'category_id');}
}