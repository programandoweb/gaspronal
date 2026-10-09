<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\CatalogItemRequest;
use App\Models\CatalogCategory;
use App\Models\CatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CatalogController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        return response()->json(
            CatalogItem::query()
                ->with('category:id,name,slug')
                ->where('type', 'product')
                ->where('status', 'published')
                ->whereNotNull('published_at')
                ->where(function ($query): void {
                    $query->whereNull('category_id')
                        ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('is_active', true));
                })
                ->when($request->filled('category'), fn ($query) => $query->whereHas(
                    'category',
                    fn ($categoryQuery) => $categoryQuery->where('slug', $request->string('category'))
                ))
                ->when($request->filled('search'), function ($query) use ($request): void {
                    $search = trim((string) $request->string('search'));
                    $like = '%'.$search.'%';

                    $query->where(function ($searchQuery) use ($like): void {
                        $searchQuery
                            ->where('name', 'like', $like)
                            ->orWhere('reference', 'like', $like)
                            ->orWhere('short_description', 'like', $like)
                            ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery
                                ->where('name', 'like', $like));
                    });
                })
                ->orderByDesc('published_at')
                ->orderBy('name')
                ->paginate(min(max($request->integer('per_page', 24), 1), 48))
        );
    }

    public function publicUseCases(): JsonResponse
    {
        $items = CatalogItem::query()
            ->with('category:id,name,slug')
            ->where('type', 'product')
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where(function ($query): void {
                $query->whereNotNull('og_image')
                    ->orWhereNotNull('gallery');
            })
            ->where(function ($query): void {
                $query->whereNull('category_id')
                    ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('is_active', true));
            })
            ->inRandomOrder()
            ->limit(8)
            ->get();

        return response()->json(['data' => $items]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        $item = CatalogItem::query()
            ->with('category:id,name,slug')
            ->where('type', 'product')
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('slug', $slug)
            ->where(function ($query): void {
                $query->whereNull('category_id')
                    ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('is_active', true));
            })
            ->firstOrFail();

        return response()->json(['data' => $item]);
    }

    public function homeCategoryImages(): JsonResponse
    {
        $categories = CatalogCategory::query()
            ->where('is_active', true)
            ->whereHas('items', fn ($query) => $query
                ->where('type', 'product')
                ->where('status', 'published')
                ->whereNotNull('published_at'))
            ->withCount(['items as products_count' => fn ($query) => $query
                ->where('type', 'product')
                ->where('status', 'published')
                ->whereNotNull('published_at')])
            ->with(['items' => fn ($query) => $query
                ->where('type', 'product')
                ->where('status', 'published')
                ->whereNotNull('published_at')
                ->select(['id', 'category_id', 'og_image', 'gallery'])])
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'image_url']);

        return response()->json([
            'data' => $categories->map(function (CatalogCategory $category): array {
                $images = $category->items
                    ->flatMap(function (CatalogItem $product): array {
                        $gallery = is_array($product->gallery) ? $product->gallery : [];
                        return array_filter(array_merge([$product->og_image], $gallery),
                            fn ($url) => is_string($url) && trim($url) !== '' && ! preg_match('/(?:logo|placeholder|no[-_]?image|sin[-_]?imagen|default[-_]?image|gaspronal[-_]?logo)/i', urldecode($url)));
                    })
                    ->unique()
                    ->values();

                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'products_count' => $category->products_count,
                    'description' => $category->description,
                    'image_url' => $category->image_url ?: ($images->isNotEmpty() ? $images->random() : null),
                ];
            })->values(),
        ]);
    }

    public function publicCategories(): JsonResponse
    {
        return response()->json([
            'data' => CatalogCategory::query()
                ->where('is_active', true)
                ->whereHas('items', fn ($query) => $query
                    ->where('type', 'product')
                    ->where('status', 'published')
                    ->whereNotNull('published_at'))
                ->withCount(['items as products_count' => fn ($query) => $query
                    ->where('type', 'product')
                    ->where('status', 'published')
                    ->whereNotNull('published_at')])
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'description', 'image_url']),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            CatalogItem::query()
                ->with('category:id,name,slug')
                ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
                ->when($request->filled('search'), function ($query) use ($request): void {
                    $search = trim((string) $request->string('search'));
                    $like = '%'.$search.'%';
                    $normalized = Str::lower(Str::ascii($search));

                    $query->where(function ($searchQuery) use ($like, $normalized): void {
                        $searchQuery
                            ->where('name', 'like', $like)
                            ->orWhere('reference', 'like', $like)
                            ->orWhere('slug', 'like', $like)
                            ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery
                                ->where('name', 'like', $like)
                                ->orWhere('slug', 'like', $like));

                        if (str_contains('producto', $normalized) || str_contains($normalized, 'producto')) {
                            $searchQuery->orWhere('type', 'product');
                        }

                        if (str_contains('servicio', $normalized) || str_contains($normalized, 'servicio')) {
                            $searchQuery->orWhere('type', 'service');
                        }
                    });
                })
                ->latest()
                ->paginate(min(max($request->integer('per_page', 25), 1), 100))
        );
    }

    public function show(CatalogItem $catalogItem): JsonResponse
    {
        return response()->json(['data' => $catalogItem->load('category:id,name,slug')]);
    }

    public function store(CatalogItemRequest $request): JsonResponse
    {
        $data = $this->publication($request->validated());
        return response()->json(['data' => CatalogItem::create($data)->load('category:id,name,slug')], 201);
    }

    public function update(CatalogItemRequest $request, CatalogItem $catalogItem): JsonResponse
    {
        $catalogItem->update($this->publication($request->validated(), $catalogItem));
        return response()->json(['data' => $catalogItem->fresh()->load('category:id,name,slug')]);
    }

    public function destroy(CatalogItem $catalogItem): JsonResponse
    {
        $catalogItem->delete();
        return response()->json(['ok' => true]);
    }

    public function uploadGallery(Request $request, CatalogItem $catalogItem): JsonResponse
    {
        $validated = $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:12'],
            'images.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $gallery = $this->normalizedGallery($catalogItem);

        foreach ($validated['images'] as $image) {
            $extension = strtolower($image->getClientOriginalExtension() ?: $image->extension() ?: 'jpg');
            $filename = Str::uuid().'.'.$extension;
            $image->storeAs("catalog/{$catalogItem->id}", $filename, 'public');
            $gallery[] = "/api/catalog-media/{$catalogItem->id}/{$filename}";
        }

        $catalogItem->gallery = array_values(array_unique($gallery));

        if (!$catalogItem->og_image && count($catalogItem->gallery) > 0) {
            $catalogItem->og_image = $catalogItem->gallery[0];
        }

        $catalogItem->save();

        return response()->json([
            'data' => [
                'gallery' => $catalogItem->gallery,
                'og_image' => $catalogItem->og_image,
            ],
        ]);
    }

    public function setPrimaryGalleryImage(Request $request, CatalogItem $catalogItem): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['required', 'string', 'max:2048'],
        ]);

        $gallery = $this->normalizedGallery($catalogItem);

        abort_unless(in_array($validated['image'], $gallery, true), 422, 'La imagen no pertenece a la galería.');

        $catalogItem->update(['og_image' => $validated['image']]);

        return response()->json([
            'data' => [
                'gallery' => $gallery,
                'og_image' => $validated['image'],
            ],
        ]);
    }

    public function destroyGalleryImage(Request $request, CatalogItem $catalogItem): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['required', 'string', 'max:2048'],
        ]);

        $gallery = collect($this->normalizedGallery($catalogItem));

        abort_unless($gallery->contains($validated['image']), 422, 'La imagen no pertenece a la galería.');

        $prefix = "/api/catalog-media/{$catalogItem->id}/";
        if (str_starts_with($validated['image'], $prefix)) {
            $filename = basename(substr($validated['image'], strlen($prefix)));
            Storage::disk('public')->delete("catalog/{$catalogItem->id}/{$filename}");
        }

        $gallery = $gallery
            ->reject(fn ($image) => $image === $validated['image'])
            ->values()
            ->all();

        $catalogItem->gallery = $gallery;
        if ($catalogItem->og_image === $validated['image']) {
            $catalogItem->og_image = $gallery[0] ?? null;
        }
        $catalogItem->save();

        return response()->json([
            'data' => [
                'gallery' => $catalogItem->gallery,
                'og_image' => $catalogItem->og_image,
            ],
        ]);
    }

    public function media(CatalogItem $catalogItem, string $filename): StreamedResponse
    {
        $filename = basename($filename);
        $path = "catalog/{$catalogItem->id}/{$filename}";

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

    public function categories(Request $request): JsonResponse
    {
        return response()->json(
            CatalogCategory::query()
                ->withCount('items')
                ->when($request->filled('search'), function ($query) use ($request): void {
                    $search = '%'.trim((string) $request->string('search')).'%';
                    $query->where(function ($searchQuery) use ($search): void {
                        $searchQuery
                            ->where('name', 'like', $search)
                            ->orWhere('slug', 'like', $search)
                            ->orWhere('description', 'like', $search);
                    });
                })
                ->orderBy('name')
                ->paginate(min(max($request->integer('per_page', 10), 1), 50))
        );
    }

    public function showCategory(CatalogCategory $catalogCategory): JsonResponse
    {
        return response()->json([
            'data' => $catalogCategory->loadCount('items'),
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:170', 'unique:catalog_categories,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        return response()->json(['data' => CatalogCategory::create($data)], 201);
    }

    public function updateCategory(Request $request, CatalogCategory $catalogCategory): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['required', 'string', 'max:170', Rule::unique('catalog_categories', 'slug')->ignore($catalogCategory->id)],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $catalogCategory->update($data);
        return response()->json(['data' => $catalogCategory]);
    }

    public function uploadCategoryImage(Request $request, CatalogCategory $catalogCategory): JsonResponse
    {
        $request->validate(['image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192']]);
        $file = $request->file('image');
        $filename = Str::uuid().'.'.$file->extension();
        $file->storeAs('catalog/categories/'.$catalogCategory->id, $filename, 'public');
        $previous = $catalogCategory->image_url;
        $catalogCategory->update(['image_url' => '/api/category-media/'.$catalogCategory->id.'/'.$filename]);
        if ($previous && str_starts_with($previous, '/api/category-media/'.$catalogCategory->id.'/')) {
            Storage::disk('public')->delete('catalog/categories/'.$catalogCategory->id.'/'.basename($previous));
        }
        return response()->json(['data' => $catalogCategory->fresh()]);
    }

    public function selectCategoryImage(Request $request, CatalogCategory $catalogCategory): JsonResponse
    {
        $data = $request->validate(['image_url' => ['required', 'string', 'max:500']]);
        abort_unless(MultimediaController::validatedImage($data['image_url']), 422, 'Imagen fuera de la biblioteca o archivo inexistente.');
        $catalogCategory->update(['image_url' => $data['image_url']]);
        return response()->json(['data' => $catalogCategory->fresh()]);
    }

    public function deleteCategoryImage(CatalogCategory $catalogCategory): JsonResponse
    {
        $previous = $catalogCategory->image_url;
        $catalogCategory->update(['image_url' => null]);
        if ($previous && str_starts_with($previous, '/api/category-media/'.$catalogCategory->id.'/')) {
            Storage::disk('public')->delete('catalog/categories/'.$catalogCategory->id.'/'.basename($previous));
        }
        return response()->json(['data' => $catalogCategory->fresh()]);
    }

    public function categoryImage(CatalogCategory $catalogCategory, string $filename): StreamedResponse
    {
        abort_unless(preg_match('/^[a-zA-Z0-9._-]+$/', $filename), 404);
        abort_unless($catalogCategory->image_url === '/api/category-media/'.$catalogCategory->id.'/'.$filename, 404);
        $path = 'catalog/categories/'.$catalogCategory->id.'/'.$filename;
        abort_unless(Storage::disk('public')->exists($path), 404);
        return Storage::disk('public')->response($path, $filename, ['Cache-Control' => 'public, max-age=31536000, immutable', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function destroyCategory(CatalogCategory $catalogCategory): JsonResponse
    {
        abort_if($catalogCategory->items()->exists(), 422, 'La categoría tiene productos o servicios asociados.');
        $catalogCategory->delete();
        return response()->json(['ok' => true]);
    }


    private function normalizedGallery(CatalogItem $catalogItem): array
    {
        return collect([
            $catalogItem->og_image,
            ...($catalogItem->gallery ?? []),
        ])
            ->filter(fn ($image) => is_string($image) && trim($image) !== '')
            ->unique()
            ->values()
            ->all();
    }

    private function publication(array $data, ?CatalogItem $item = null): array
    {
        $data['published_at'] = $data['status'] === 'published'
            ? ($data['published_at'] ?? $item?->published_at ?? now())
            : null;

        return $data;
    }
}
