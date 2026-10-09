<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LeonardoServiceImageJob;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeonardoServiceImageController extends Controller
{
    private function service(Post $post): void
    {
        abort_unless($post->category?->slug === 'servicios', 422, 'Esta publicación no pertenece a Servicios.');
    }

    public function generate(Post $post): JsonResponse
    {
        $this->service($post);
        $batch = (string) Str::uuid();
        DB::transaction(function () use ($post, $batch): void {
            foreach ([1,2] as $variant) {
                LeonardoServiceImageJob::create([
                    'post_id'=>$post->id, 'batch_uuid'=>$batch, 'variant'=>$variant,
                    'status'=>'pending'
                ]);
            }
        });
        return response()->json(['data'=>['batch_uuid'=>$batch,'created'=>2]], 202);
    }

    public function status(Post $post): JsonResponse
    {
        $this->service($post);
        $jobs = LeonardoServiceImageJob::query()->where('post_id',$post->id)
            ->orderByDesc('id')->limit(30)->get();
        return response()->json(['data'=>[
            'jobs'=>$jobs,
            'pending'=>LeonardoServiceImageJob::where('post_id',$post->id)->whereIn('status',['pending','processing'])->count(),
            'gallery'=>$post->fresh()->gallery ?? [],
            'featured_image'=>$post->fresh()->featured_image,
            'og_image'=>$post->fresh()->og_image,
        ]]);
    }
}
