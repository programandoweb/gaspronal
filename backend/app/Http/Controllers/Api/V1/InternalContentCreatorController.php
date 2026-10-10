<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;use App\Models\ContentCreatorArtifact;use App\Models\ContentCreatorRun;use App\Models\Post;
use App\Models\PostCategory;use Illuminate\Http\JsonResponse;use Illuminate\Http\Request;use Illuminate\Support\Facades\DB;use Illuminate\Support\Facades\File;use Illuminate\Support\Facades\Storage;use Illuminate\Support\Str;
class InternalContentCreatorController extends Controller{
public function latestRun():JsonResponse{
$run=ContentCreatorRun::query()->where('agent','lucia')->withCount('artifacts')->latest('id')->first();
if(!$run)return response()->json(['data'=>null]);
$snapshots=$run->source_snapshots?:[];
return response()->json(['data'=>[
'uuid'=>$run->uuid,
'topic'=>$run->topic,
'status'=>$run->status,
'source_urls'=>$run->source_urls?:[],
'sources_collected'=>count($snapshots),
'sources_total'=>count($run->source_urls?:[]),
'sources'=>collect($snapshots)->map(fn($item)=>['url'=>$item['url']??null,'title'=>$item['title']??null])->values(),
'images_generated'=>(int)$run->artifacts_count,
'post_id'=>$run->post_id,
'error'=>$run->error,
'updated_at'=>$run->updated_at,
]]);
}
public function storeRun(Request $r):JsonResponse{$d=$r->validate(['agent'=>['required','string','max:80'],'topic'=>['required','string','max:10000'],'source_urls'=>['required','array','min:1','max:20'],'source_urls.*'=>['required','url','max:2000']]);$run=ContentCreatorRun::create([...$d,'uuid'=>(string)Str::uuid(),'status'=>'collecting','source_snapshots'=>[]]);return response()->json(['data'=>['id'=>$run->id,'uuid'=>$run->uuid,'agent'=>$run->agent,'topic'=>$run->topic,'status'=>$run->status,'source_urls'=>$run->source_urls]],201);}
public function addSource(Request $r,ContentCreatorRun $run):JsonResponse{$d=$r->validate(['url'=>['required','url','max:2000'],'title'=>['nullable','string','max:1000'],'description'=>['nullable','string','max:5000'],'text'=>['required','string','max:120000'],'headings'=>['nullable','array'],'links'=>['nullable','array'],'images'=>['nullable','array']]);$s=$run->source_snapshots?:[];$s[]=$d;$total=count($run->source_urls?:[]);$run->update(['source_snapshots'=>$s,'status'=>count($s)>=$total?'planning':'collecting']);return response()->json(['data'=>$run->fresh()]);}
public function addArtifact(Request $r,ContentCreatorRun $run):JsonResponse{$d=$r->validate(['type'=>['required','in:image'],'sequence'=>['required','integer','min:1','max:10'],'prompt'=>['required','string','max:12000'],'mime_type'=>['required','in:image/png,image/jpeg,image/webp'],'data_base64'=>['required','string']]);$b=base64_decode($d['data_base64'],true);abort_if($b===false,422,'Imagen base64 inválida.');abort_if(strlen($b)>15*1024*1024,422,'La imagen supera 15 MB.');$e=match($d['mime_type']){'image/jpeg'=>'jpg','image/webp'=>'webp',default=>'png'};$dir="images/uploads/agente-contenido/{$run->uuid}";File::ensureDirectoryExists(public_path($dir));$f='image-'.((int)$d['sequence']).'.'.$e;File::put(public_path($dir.'/'.$f),$b);$path='/'.$dir.'/'.$f;$a=ContentCreatorArtifact::updateOrCreate(['run_id'=>$run->id,'type'=>'image','sequence'=>(int)$d['sequence']],['prompt'=>$d['prompt'],'path'=>$path,'mime_type'=>$d['mime_type']]);$run->update(['status'=>'generating_images']);return response()->json(['data'=>$a],201);}
public function complete(Request $r,ContentCreatorRun $run):JsonResponse{$d=$r->validate(['title'=>['required','string','max:255'],'excerpt'=>['required','string','max:2000'],'content'=>['required','string'],'seo_title'=>['nullable','string','max:255'],'seo_description'=>['nullable','string','max:500'],'plan'=>['required','array'],'image_paths'=>['required','array','size:5'],'image_paths.*'=>['required','string','max:1000'],'source_urls'=>['required','array']]);$post=DB::transaction(function()use($run,$d):Post{$category=PostCategory::query()->firstOrCreate(['slug'=>'gaspro-notas'],['name'=>'Gaspro-notas','description'=>'Notas, novedades y contenido editorial de Gaspronal.','is_active'=>true]);$base=Str::slug($d['title'])?:'gaspro-nota';$slug=$base;for($i=2;Post::where('slug',$slug)->exists();$i++)$slug=$base.'-'.$i;$p=Post::create(['category_id'=>$category->id,'title'=>$d['title'],'slug'=>$slug,'excerpt'=>$d['excerpt'],'content'=>$d['content'],'status'=>'draft','seo_title'=>$d['seo_title']??$d['title'],'seo_description'=>$d['seo_description']??$d['excerpt'],'published_at'=>null]);$gallery=[];foreach($d['image_paths'] as $index=>$sourcePath){$absolute=public_path(ltrim($sourcePath,'/'));if(!File::exists($absolute))continue;$ext=strtolower(pathinfo($absolute,PATHINFO_EXTENSION)?:'png');$filename='lucia-'.($index+1).'-'.Str::uuid().'.'.$ext;app(\App\Services\ImageWatermarkService::class)->store("posts/{$p->id}/{$filename}",File::get($absolute));$gallery[]="/api/post-media/{$p->id}/{$filename}";}$p->update(['gallery'=>$gallery,'featured_image'=>$gallery[0]??null,'og_image'=>$gallery[0]??null]);$run->update(['status'=>'completed','plan'=>$d['plan'],'final_payload'=>[...$d,'post_gallery'=>$gallery],'post_id'=>$p->id,'error'=>null]);return $p->fresh();});return response()->json(['data'=>['run'=>$run->fresh(),'post_id'=>$post->id,'gallery'=>$post->gallery]]);}
public function fail(Request $r,ContentCreatorRun $run):JsonResponse{$d=$r->validate(['error'=>['required','string','max:10000']]);$run->update(['status'=>'failed','error'=>$d['error']]);return response()->json(['data'=>$run->fresh()]);}}
