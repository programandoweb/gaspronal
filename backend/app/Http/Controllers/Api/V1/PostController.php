<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\PostRequest;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\CmsServiceTopic;
use App\Models\SeoRedirect;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PostController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        return response()->json(
            Post::query()
                ->with(['category:id,name,slug','serviceTopic:id,name,slug,image_url'])
                ->where('status', 'published')
                ->whereNotNull('published_at')
                ->whereHas('category', fn ($query) => $query->where('is_active', true))
                ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
                ->when($request->filled('service_topic_id'), fn ($query) => $query->where('service_topic_id', $request->integer('service_topic_id')))
                ->when($request->filled('search'), function ($query) use ($request): void {
                    $search = trim((string) $request->string('search'));
                    $like = '%'.$search.'%';
                    $query->where(function ($searchQuery) use ($like): void {
                        $searchQuery
                            ->where('title', 'like', $like)
                            ->orWhere('excerpt', 'like', $like)
                            ->orWhere('content', 'like', $like);
                    });
                })
                ->orderByDesc('published_at')
                ->paginate(min(max($request->integer('per_page', 12), 1), 48))
        );
    }

    public function publicLegacyService(string $slug): JsonResponse
    {
        $post = Post::query()->with(['category:id,name,slug','serviceTopic:id,name,slug,image_url'])->where('slug', $slug)
            ->where('status', 'published')->whereNotNull('published_at')
            ->whereHas('category', fn ($query) => $query->where('slug', 'servicios')->where('is_active', true))
            ->firstOrFail();
        return response()->json(['data' => $post]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        $post = Post::query()
            ->with(['category:id,name,slug','serviceTopic:id,name,slug,image_url'])
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('slug', $slug)
            ->whereHas('category', fn ($query) => $query->where('slug', 'gaspro-notas')->where('is_active', true))
            ->firstOrFail();

        return response()->json(['data' => $post]);
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            Post::query()
                ->with(['category:id,name,slug','serviceTopic:id,name,slug,image_url'])
                ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
                ->when($request->filled('service_topic_id'), fn ($query) => $query->where('service_topic_id', $request->integer('service_topic_id')))
                ->when($request->filled('search'), function ($query) use ($request): void {
                    $search = trim((string) $request->string('search'));
                    $like = '%'.$search.'%';

                    $query->where(function ($searchQuery) use ($like): void {
                        $searchQuery
                            ->where('title', 'like', $like)
                            ->orWhere('slug', 'like', $like)
                            ->orWhere('excerpt', 'like', $like)
                            ->orWhere('content', 'like', $like)
                            ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery
                                ->where('name', 'like', $like)
                                ->orWhere('slug', 'like', $like));
                    });
                })
                ->latest()
                ->paginate(min(max($request->integer('per_page', 25), 1), 100))
        );
    }

    public function show(Post $post): JsonResponse
    {
        return response()->json(['data' => $post->load('category:id,name,slug')]);
    }

    public function store(PostRequest $request): JsonResponse
    {
        $data = $this->publication($request->validated());
        return response()->json(['data' => Post::create($data)->load('category:id,name,slug')], 201);
    }

    public function update(PostRequest $request, Post $post): JsonResponse
    {
        $data = $this->publication($request->validated(), $post);
        $oldSlug = $post->slug;
        $newSlug = $data['slug'] ?? $oldSlug;
        $oldCategory = $post->category?->slug;
        $newCategory = PostCategory::find($data['category_id'])?->slug;

        DB::transaction(function () use ($post, $data, $oldSlug, $newSlug, $oldCategory, $newCategory): void {
            $post->update($data);

            if ($oldSlug === $newSlug && $oldCategory === $newCategory) {
                return;
            }

            $oldPath = ($oldCategory === "servicios" ? "/2019/servicios" : "/gaspro-notas")."/{$oldSlug}";
            $newPath = ($newCategory === "servicios" ? "/2019/servicios" : "/gaspro-notas")."/{$newSlug}";

            SeoRedirect::query()
                ->where('target_path', $oldPath)
                ->update(['target_path' => $newPath]);

            SeoRedirect::query()->updateOrCreate(
                ['source_path' => $oldPath],
                [
                    'target_path' => $newPath,
                    'status_code' => 301,
                    'is_active' => true,
                    'reason' => 'Cambio histórico de slug de Gaspro-nota',
                ],
            );
        });

        return response()->json(['data' => $post->fresh()->load('category:id,name,slug')]);
    }

    public function destroy(Post $post): JsonResponse
    {
        $post->delete();
        return response()->json(['ok' => true]);
    }

    public function uploadGallery(Request $request, Post $post): JsonResponse
    {
        $validated = $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:12'],
            'images.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $gallery = $this->normalizedGallery($post);

        foreach ($validated['images'] as $image) {
            $extension = strtolower($image->getClientOriginalExtension() ?: $image->extension() ?: 'jpg');
            $filename = Str::uuid().'.'.$extension;
            $image->storeAs("posts/{$post->id}", $filename, 'public');
            $gallery[] = "/api/post-media/{$post->id}/{$filename}";
        }

        $post->gallery = array_values(array_unique($gallery));

        if (!$post->featured_image && count($post->gallery) > 0) {
            $post->featured_image = $post->gallery[0];
        }
        if (!$post->og_image && count($post->gallery) > 0) {
            $post->og_image = $post->gallery[0];
        }

        $post->save();

        return response()->json([
            'data' => [
                'gallery' => $post->gallery,
                'featured_image' => $post->featured_image,
                'og_image' => $post->og_image,
            ],
        ]);
    }

    public function setPrimaryGalleryImage(Request $request, Post $post): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['required', 'string', 'max:2048'],
        ]);

        $gallery = $this->normalizedGallery($post);
        abort_unless(in_array($validated['image'], $gallery, true), 422, 'La imagen no pertenece a la galería.');

        $post->update([
            'featured_image' => $validated['image'],
            'og_image' => $validated['image'],
        ]);

        return response()->json([
            'data' => [
                'gallery' => $gallery,
                'featured_image' => $validated['image'],
                'og_image' => $validated['image'],
            ],
        ]);
    }

    public function destroyGalleryImage(Request $request, Post $post): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['required', 'string', 'max:2048'],
        ]);

        $gallery = collect($this->normalizedGallery($post));
        abort_unless($gallery->contains($validated['image']), 422, 'La imagen no pertenece a la galería.');

        $prefix = "/api/post-media/{$post->id}/";
        if (str_starts_with($validated['image'], $prefix)) {
            $filename = basename(substr($validated['image'], strlen($prefix)));
            Storage::disk('public')->delete("posts/{$post->id}/{$filename}");
        }

        $gallery = $gallery
            ->reject(fn ($image) => $image === $validated['image'])
            ->values()
            ->all();

        $post->gallery = $gallery;
        if ($post->featured_image === $validated['image']) {
            $post->featured_image = $gallery[0] ?? null;
        }
        if ($post->og_image === $validated['image']) {
            $post->og_image = $gallery[0] ?? null;
        }
        $post->save();

        return response()->json([
            'data' => [
                'gallery' => $post->gallery,
                'featured_image' => $post->featured_image,
                'og_image' => $post->og_image,
            ],
        ]);
    }

    public function media(Post $post, string $filename): StreamedResponse
    {
        $filename = basename($filename);
        $path = "posts/{$post->id}/{$filename}";
        abort_unless(Storage::disk('public')->exists($path), 404);

        return Storage::disk('public')->response(
            $path,
            $filename,
            [
                'Cache-Control' => 'public, max-age=31536000, immutable',
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }

    public function serviceTopics(): JsonResponse
    {
        return response()->json(['data'=>CmsServiceTopic::query()->where('is_active',true)->orderBy('id')->get()]);
    }

    public function categories(): JsonResponse
    {
        return response()->json(['data' => PostCategory::query()->withCount('posts')->orderBy('name')->get()]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:170', 'unique:post_categories,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        return response()->json(['data' => PostCategory::create($data)], 201);
    }

    public function updateCategory(Request $request, PostCategory $postCategory): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['required', 'string', 'max:170', Rule::unique('post_categories', 'slug')->ignore($postCategory->id)],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $postCategory->update($data);
        return response()->json(['data' => $postCategory]);
    }

    private function normalizedGallery(Post $post): array
    {
        return collect([
            $post->featured_image,
            $post->og_image,
            ...($post->gallery ?? []),
        ])
            ->filter(fn ($image) => is_string($image) && trim($image) !== '')
            ->unique()
            ->values()
            ->all();
    }

    private function publication(array $data, ?Post $post = null): array
    {
        $data['published_at'] = $data['status'] === 'published'
            ? ($data['published_at'] ?? $post?->published_at ?? now())
            : null;

        return $data;
    }
}
