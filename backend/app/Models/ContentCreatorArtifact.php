<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ContentCreatorArtifact extends Model{protected $fillable=['run_id','type','sequence','prompt','path','mime_type','meta'];protected $casts=['meta'=>'array'];public function run():BelongsTo{return $this->belongsTo(ContentCreatorRun::class,'run_id');}}