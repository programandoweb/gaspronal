<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\Rule;

class MultimediaController extends Controller
{
    private const COLLECTIONS = [
        'iconos' => 'images/uploads/iconos-programandoweb',
        'galeria' => 'images/uploads',
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'collection' => ['nullable', 'string', Rule::in(array_keys(self::COLLECTIONS))],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $collection = $validated['collection'] ?? 'iconos';
        $folder = public_path(self::COLLECTIONS[$collection]);
        $search = mb_strtolower(trim($validated['search'] ?? ''));

        $files = is_dir($folder) ? ($collection === 'galeria' ? File::allFiles($folder) : File::files($folder)) : [];
        $items = collect($files)
            ->filter(fn ($file) => in_array(strtolower($file->getExtension()), ['jpg','jpeg','png','webp'], true))
            ->filter(fn ($file) => $search === '' || str_contains(mb_strtolower($file->getFilename()), $search))
            ->sortBy(fn ($file) => $file->getFilename())
            ->values()->map(fn ($file) => [
                'name' => $file->getFilename(),
                'url' => '/'.self::COLLECTIONS[$collection].'/'.str_replace(DIRECTORY_SEPARATOR, '/', $file->getRelativePathname()),
                'collection' => $collection,
            ])->all();

        return response()->json(['data' => $items]);
    }

    public static function validatedImage(string $url): bool
    {
        foreach (self::COLLECTIONS as $folder) {
            $prefix = '/'.$folder.'/';
            if (!str_starts_with($url, $prefix)) continue;
            $name = substr($url, strlen($prefix));
            if (!preg_match('#^(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+\\.(?:png|jpe?g|webp)$#i', $name)) return false;
            return is_file(public_path($folder.'/'.$name));
        }
        return false;
    }
}
