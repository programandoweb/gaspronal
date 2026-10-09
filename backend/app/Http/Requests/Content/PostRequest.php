<?php
namespace App\Http\Requests\Content;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
class PostRequest extends FormRequest {
 public function authorize():bool{return true;}
 public function rules():array{
  $post=$this->route('post');
  return [
   'service_topic_id'=>['nullable','integer','exists:cms_service_topics,id'],
   'category_id'=>['required','integer','exists:post_categories,id'],
   'title'=>['required','string','max:220'],
   'slug'=>['required','string','max:240',Rule::unique('posts','slug')->ignore($post?->id)],
   'excerpt'=>['nullable','string'],
   'content'=>['nullable','string'],
   'featured_image'=>['nullable','string','max:2048'],
   'gallery'=>['nullable','array','max:20'],
   'gallery.*'=>['string','max:2048'],
   'status'=>['required',Rule::in(['draft','published','archived'])],
   'seo_title'=>['nullable','string','max:190'],
   'seo_description'=>['nullable','string'],
   'og_image'=>['nullable','string','max:2048'],
   'published_at'=>['nullable','date'],
  ];
 }
}