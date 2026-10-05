<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
class ContentCreatorRun extends Model{protected $fillable=['uuid','agent','topic','status','source_urls','source_snapshots','plan','final_payload','post_id','error'];protected $casts=['source_urls'=>'array','source_snapshots'=>'array','plan'=>'array','final_payload'=>'array'];public function artifacts():HasMany{return $this->hasMany(ContentCreatorArtifact::class,'run_id');}public function getRouteKeyName():string{return 'uuid';}}