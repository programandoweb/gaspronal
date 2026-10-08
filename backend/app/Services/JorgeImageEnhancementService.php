<?php

namespace App\Services;

use App\Models\AgentImageEnhancementJob;
use App\Models\AiModel;
use App\Models\AiProvider;
use App\Models\CatalogItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class JorgeImageEnhancementService
{
    private const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
    private const MAX_GENERATED_BYTES = 12 * 1024 * 1024;

    public function enhance(AgentImageEnhancementJob $job): array
    {
        $item = CatalogItem::query()->findOrFail($job->catalog_item_id);
        if ($item->type !== 'product') {
            throw new RuntimeException('El registro no corresponde a un producto.');
        }

        $source = $this->readSourceImage($item);
        $runtime = $this->resolveImageModel();
        $prompt = $this->promptFor($item);

        $generated = $this->generate(
            provider: $runtime['provider'],
            model: $runtime['model'],
            apiKey: $runtime['api_key'],
            prompt: $prompt,
            mimeType: $source['mime_type'],
            bytes: $source['bytes'],
        );

        $extension = $this->extensionForMime($generated['mime_type']);
        $filename = 'enhanced-'.Str::uuid().'.'.$extension;
        $storagePath = "catalog/{$item->id}/{$filename}";
        $publicPath = "/api/catalog-media/{$item->id}/{$filename}";

        Storage::disk('public')->put($storagePath, $generated['bytes']);
        if (! Storage::disk('public')->exists($storagePath)) {
            throw new RuntimeException('La imagen generada no pudo persistirse en el almacenamiento público.');
        }

        try {
            DB::transaction(function () use ($item, $source, $publicPath): void {
                $locked = CatalogItem::query()->lockForUpdate()->findOrFail($item->id);
                $gallery = collect([
                    $locked->og_image,
                    ...($locked->gallery ?? []),
                    $source['path'],
                    $publicPath,
                ])
                    ->filter(fn ($image) => is_string($image) && trim($image) !== '')
                    ->unique()
                    ->values()
                    ->all();

                $locked->gallery = $gallery;
                $locked->og_image = $publicPath;
                $locked->save();
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($storagePath);
            throw $exception;
        }

        return [
            'source_image' => $source['path'],
            'generated_image' => $publicPath,
            'provider' => $runtime['provider']->code,
            'model' => $runtime['model'],
            'prompt' => $prompt,
        ];
    }

    private function readSourceImage(CatalogItem $item): array
    {
        $sourcePath = collect([ ...($item->gallery ?? []), $item->og_image ])
            ->filter(fn ($image) => is_string($image) && trim($image) !== '')
            ->map(fn ($image) => trim((string) $image))
            ->first(fn ($image) => ! str_contains($image, '/enhanced-'));

        if (! $sourcePath) {
            throw new RuntimeException('El producto no tiene una imagen principal válida.');
        }

        $path = parse_url($sourcePath, PHP_URL_PATH) ?: $sourcePath;
        $bytes = null;

        if (preg_match('#^/api/catalog-media/'.preg_quote((string) $item->id, '#').'/([A-Za-z0-9._-]+)$#', $path, $matches)) {
            $storagePath = "catalog/{$item->id}/".basename($matches[1]);
            if (! Storage::disk('public')->exists($storagePath)) {
                throw new RuntimeException('La imagen principal no existe en el almacenamiento del catálogo.');
            }
            $bytes = Storage::disk('public')->get($storagePath);
        } elseif (str_starts_with($path, "/images/uploads/agente/{$item->id}/")) {
            $base = realpath(public_path("images/uploads/agente/{$item->id}"));
            $candidate = realpath(public_path(ltrim($path, '/')));

            if (! $base || ! $candidate || ! str_starts_with($candidate, $base.DIRECTORY_SEPARATOR) || ! is_file($candidate)) {
                throw new RuntimeException('La imagen principal local no es segura o no existe.');
            }

            $bytes = file_get_contents($candidate);
        } else {
            throw new RuntimeException('La imagen principal debe ser un archivo local administrado por Gaspronal.');
        }

        if (! is_string($bytes) || $bytes === '' || strlen($bytes) > self::MAX_SOURCE_BYTES) {
            throw new RuntimeException('La imagen principal está vacía o excede 8 MB.');
        }

        $mimeType = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';
        if (! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new RuntimeException('El MIME de la imagen principal no está permitido.');
        }

        return ['path' => $sourcePath, 'mime_type' => $mimeType, 'bytes' => $bytes];
    }

    private function resolveImageModel(): array
    {
        $models = AiModel::query()
            ->with('provider')
            ->where('is_active', true)
            ->orderBy('priority')
            ->orderBy('id')
            ->get();

        $model = $models->first(function (AiModel $candidate): bool {
            $provider = $candidate->provider;
            if (! $provider || ! $provider->is_active || $provider->driver !== 'gemini') {
                return false;
            }

            $capabilities = array_map('strtolower', $candidate->capabilities ?? []);
            $identifier = strtolower((string) $candidate->model_identifier);

            return in_array('image', $capabilities, true)
                || in_array('image_generation', $capabilities, true)
                || str_contains($identifier, 'image');
        });

        $provider = $model?->provider;
        $modelIdentifier = $model?->model_identifier;

        if (! $provider) {
            $provider = AiProvider::query()
                ->where('driver', 'gemini')
                ->where('is_active', true)
                ->orderBy('id')
                ->first();

            $modelIdentifier = trim((string) config('agents.gemini_image_model', 'gemini-3.1-flash-image'));
        }

        $apiKey = is_array($provider?->credentials) ? ($provider->credentials['api_key'] ?? null) : null;

        if (! $provider || ! is_string($apiKey) || trim($apiKey) === '' || ! $modelIdentifier) {
            throw new RuntimeException('No hay un proveedor Gemini activo con credenciales y modelo de generación de imágenes.');
        }

        return [
            'provider' => $provider,
            'api_key' => trim($apiKey),
            'model' => trim((string) $modelIdentifier),
        ];
    }

    private function generate(
        AiProvider $provider,
        string $model,
        string $apiKey,
        string $prompt,
        string $mimeType,
        string $bytes,
    ): array {
        $baseUrl = rtrim((string) $provider->base_url, '/');
        $url = $baseUrl.'/models/'.rawurlencode($model).':generateContent';
        $attempts = max(1, min(6, ((int) $provider->max_retries) + 1));
        $lastMessage = null;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $response = Http::acceptJson()
                ->asJson()
                ->timeout(max(10, (int) $provider->timeout_seconds))
                ->connectTimeout(min(10, max(5, (int) $provider->timeout_seconds)))
                ->withOptions(['verify' => (bool) $provider->verify_tls])
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->post($url, [
                    'contents' => [[
                        'role' => 'user',
                        'parts' => [
                            ['text' => $prompt],
                            ['inlineData' => ['mimeType' => $mimeType, 'data' => base64_encode($bytes)]],
                        ],
                    ]],
                    'generationConfig' => ['responseModalities' => ['IMAGE']],
                ]);

            if ($response->successful()) {
                $parts = data_get($response->json(), 'candidates.0.content.parts', []);
                foreach (is_array($parts) ? $parts : [] as $part) {
                    $data = data_get($part, 'inlineData.data');
                    if (! is_string($data) || $data === '') {
                        continue;
                    }

                    $generatedBytes = base64_decode($data, true);
                    if (! is_string($generatedBytes) || $generatedBytes === '' || strlen($generatedBytes) > self::MAX_GENERATED_BYTES) {
                        throw new RuntimeException('Gemini devolvió una imagen inválida o demasiado grande.');
                    }

                    $generatedMime = (string) data_get($part, 'inlineData.mimeType', 'image/png');
                    if (! in_array($generatedMime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
                        throw new RuntimeException('Gemini devolvió un MIME de imagen no permitido.');
                    }

                    $image = @imagecreatefromstring($generatedBytes);
                    if ($image === false) {
                        throw new RuntimeException('Gemini devolvió datos que no forman una imagen válida.');
                    }
                    imagedestroy($image);

                    return ['bytes' => $generatedBytes, 'mime_type' => $generatedMime];
                }

                throw new RuntimeException('Gemini respondió sin una imagen generada.');
            }

            $lastMessage = (string) data_get($response->json(), 'error.message', "Gemini Image respondió HTTP {$response->status()}.");
            if (! in_array($response->status(), [429, 500, 502, 503, 504], true) || $attempt === $attempts) {
                break;
            }

            usleep((int) (700000 * $attempt));
        }

        throw new RuntimeException(mb_substr($lastMessage ?: 'Gemini Image no estuvo disponible.', 0, 1000));
    }

    private function promptFor(CatalogItem $item): string
    {
        return trim(<<<PROMPT
Crea una fotografía comercial profesional y fotorrealista del MISMO equipo industrial mostrado en la imagen de referencia.
Producto: {$item->name}
Referencia: {$item->reference}

Mejora únicamente calidad fotográfica: resolución aparente, enfoque, exposición, balance de blancos, reflejos, iluminación y presentación comercial.
Conserva rigurosamente forma, orientación, proporciones, estructura, materiales, puertas, azafates, quemadores, controles, vitrinas, accesorios y cualquier pieza visible.
No agregues ni elimines componentes del equipo. No inventes logos, etiquetas, texto, marcas de agua ni características no visibles.
Si el producto corresponde a equipamiento gastronómico, puede mostrarse integrado de manera natural en una cocina industrial realista, sin ocultar ni modificar el producto.
El equipo debe seguir siendo inequívocamente el mismo de la fotografía original.
PROMPT);
    }

    private function extensionForMime(string $mimeType): string
    {
        return match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            default => 'png',
        };
    }
}
