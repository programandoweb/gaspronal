<?php

namespace App\Services;

use App\Models\AiModel;
use App\Models\AiProvider;
use App\Models\Post;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class LeonardoServiceImageService
{
    private const MAX_GENERATED_BYTES = 12 * 1024 * 1024;

    public function generateFor(Post $post, int $variant): array
    {
        if ($post->category?->slug !== 'servicios') {
            throw new RuntimeException('Leonardo solo genera imágenes CMS para servicios.');
        }
        $runtime = $this->resolveImageModel();
        $prompt = $this->buildPrompt($post, $variant);
        $image = $this->generate(
            provider: $runtime['provider'],
            model: $runtime['model'],
            apiKey: $runtime['api_key'],
            prompt: $prompt,
        );
        $extension = match ($image['mime_type']) {
            'image/jpeg' => 'jpg', 'image/webp' => 'webp', default => 'png'
        };
        $filename = 'leonardo-'.Str::uuid().'.'.$extension;
        $diskPath = "posts/{$post->id}/{$filename}";
        $url = "/api/post-media/{$post->id}/{$filename}";
        app(ImageWatermarkService::class)->store($diskPath, $image['bytes']);
        if (!Storage::disk('public')->exists($diskPath)) {
            throw new RuntimeException('No fue posible persistir la imagen.');
        }

        try {
            DB::transaction(function () use ($post, $url): void {
                $locked = Post::query()->lockForUpdate()->findOrFail($post->id);
                $gallery = collect([$locked->featured_image, $locked->og_image, ...($locked->gallery ?? []), $url])
                    ->filter(fn ($path) => is_string($path) && trim($path) !== '')
                    ->unique()->values()->all();
                $locked->gallery = $gallery;
                if (!$locked->featured_image) $locked->featured_image = $url;
                if (!$locked->og_image) $locked->og_image = $url;
                $locked->save();
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($diskPath);
            throw $e;
        }

        return ['generated_image' => $url, 'provider' => $runtime['provider']->code,
            'model' => $runtime['model'], 'prompt' => $prompt];
    }

    private function buildPrompt(Post $post, int $variant): string
    {
        $context = implode("\n", array_filter([
            "Servicio: {$post->title}",
            "Resumen: {$post->excerpt}",
            "Contenido: ".mb_substr((string)$post->content, 0, 5500),
            "Título SEO: {$post->seo_title}",
            "Descripción SEO: {$post->seo_description}",
        ]));
        $view = $variant === 1 ? 'Escena técnica del equipo humano trabajando, herramientas y entorno profesional.'
            : 'Escena comercial amplia mostrando el resultado o aplicación real del servicio.';
        return "Genera UNA fotografía publicitaria fotorrealista de alta calidad para el servicio industrial descrito. "
            ."Representa únicamente actividades y equipamiento coherentes con los hechos aportados; "
            ."no inventes certificados, marcas, riesgosas instalaciones específicas ni atributos del servicio. "
            ."No incluyas texto, letras, logotipos, marca de agua ni diagramas. "
            ."Composición horizontal 4:3, iluminación editorial de alta gama, acero inoxidable y entorno industrial cuando sea pertinente. "
            ."No representar como evidencia fotográfica una obra real que no se conoce. "
            ."Enfoque creativo: {$view}\nContexto real:\n{$context}";
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


}
