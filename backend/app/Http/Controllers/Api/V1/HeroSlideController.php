<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HeroSlide;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class HeroSlideController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        $section = trim((string) $request->query('section', 'home.hero'));

        return response()->json([
            'active_option' => (int) (DB::table('hero_preferences')->where('section_key', $section)->value('active_option') ?? 1),
            'data' => HeroSlide::query()
                ->where('section_key', $section)
                ->where('is_active', true)
                ->orderBy('option')
                ->orderBy('sort_order')
                ->get()
                ->groupBy('option')
                ->map(fn ($slides) => $slides->values()),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $section = trim((string) $request->query('section', ''));

        return response()->json([
            'data' => HeroSlide::query()
                ->when($section !== '', fn ($query) => $query->where('section_key', $section))
                ->orderBy('section_key')
                ->orderBy('option')
                ->orderBy('sort_order')
                ->get(),
            'meta' => [
                'can_manage' => (bool) $request->user()?->can('heroes.manage'),
                'active_options' => DB::table('hero_preferences')->pluck('active_option', 'section_key'),
            ],
        ]);
    }

    public function setActiveOption(Request $request): JsonResponse
    {
        $data = $request->validate([
            'section_key' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9._-]+$/'],
            'active_option' => ['required', 'integer', 'between:1,5'],
        ]);

        DB::table('hero_preferences')->updateOrInsert(
            ['section_key' => $data['section_key']],
            ['active_option' => $data['active_option'], 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        return response()->json(['data' => HeroSlide::create($data)], 201);
    }

    public function update(Request $request, HeroSlide $heroSlide): JsonResponse
    {
        $heroSlide->update($this->validated($request));
        return response()->json(['data' => $heroSlide->fresh()]);
    }

    public function destroy(HeroSlide $heroSlide): JsonResponse
    {
        $this->deleteOwnedImage($heroSlide->image_url);
        $heroSlide->delete();

        return response()->json(['ok' => true]);
    }

    public function uploadImage(Request $request, HeroSlide $heroSlide): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $this->deleteOwnedImage($heroSlide->image_url);

        $file = $validated['image'];
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'jpg');
        $filename = Str::uuid().'.'.$extension;
        app(\App\Services\ImageWatermarkService::class)->store("heroes/{$heroSlide->id}".'/'.$filename, file_get_contents($file->getRealPath()));

        $heroSlide->update([
            'image_url' => "/api/v1/heroes/media/{$heroSlide->id}/{$filename}",
        ]);

        return response()->json(['data' => $heroSlide->fresh()]);
    }

    public function media(HeroSlide $heroSlide, string $filename): StreamedResponse
    {
        $filename = basename($filename);
        $path = "heroes/{$heroSlide->id}/{$filename}";

        abort_unless(Storage::disk('public')->exists($path), 404);

        return Storage::disk('public')->response($path, $filename, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'section_key' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9._-]+$/'],
            'option' => ['required', 'integer', 'between:1,5'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999'],
            'is_active' => ['nullable', 'boolean'],
            'interval_ms' => ['nullable', 'integer', 'between:1000,15000'],
            'image_url' => ['required', 'string', 'max:2048'],
            'background_position' => ['nullable', 'string', 'max:80'],
            'eyebrow' => ['nullable', 'string', 'max:180'],
            'title' => ['required', 'string', 'max:220'],
            'accent' => ['nullable', 'string', 'max:220'],
            'description' => ['nullable', 'string', 'max:2000'],
            'primary_label' => ['nullable', 'string', 'max:120'],
            'primary_href' => ['nullable', 'string', 'max:2048'],
            'secondary_label' => ['nullable', 'string', 'max:120'],
            'secondary_href' => ['nullable', 'string', 'max:2048'],
            'cards' => ['nullable', 'array', 'max:3'],
            'cards.*.title' => ['required_with:cards', 'string', 'max:120'],
            'cards.*.text' => ['required_with:cards', 'string', 'max:300'],
        ]);
    }

    private function deleteOwnedImage(?string $url): void
    {
        if (! $url || ! str_starts_with($url, '/api/v1/heroes/media/')) {
            return;
        }

        $parts = explode('/', trim($url, '/'));
        $id = $parts[4] ?? null;
        $filename = $parts[5] ?? null;

        if ($id && $filename) {
            Storage::disk('public')->delete("heroes/{$id}/".basename($filename));
        }
    }
}
