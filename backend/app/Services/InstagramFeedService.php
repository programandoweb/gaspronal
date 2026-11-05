<?php

namespace App\Services;

use App\Models\InstagramSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class InstagramFeedService
{
    private const CACHE_KEY = 'public:instagram:latest-posts:v1';
    private const GRAPH_VERSION = 'v25.0';

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    public function latestPosts(): array
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinutes(5), fn (): array => $this->fetchPosts());
    }

    private function fetchPosts(): array
    {
        $setting = InstagramSetting::query()->find(1);
        $userId = trim((string) ($setting?->instagram_user_id ?? config('instagram.instagram_user_id', '')));
        $token = trim((string) ($setting?->access_token ?? config('instagram.access_token', '')));
        $host = (string) ($setting?->graph_host ?? config('instagram.graph_host', 'graph.facebook.com'));

        if (! preg_match('/^\d+$/', $userId) || $token === '') {
            return [];
        }

        // No se permiten URLs externas personalizadas ni interpolación de entradas no validadas.
        $host = in_array($host, ['graph.facebook.com', 'graph.instagram.com'], true)
            ? $host
            : 'graph.facebook.com';

        try {
            $response = Http::acceptJson()->withToken($token)->timeout(8)->get(
                'https://'.$host.'/'.self::GRAPH_VERSION.'/'.$userId.'/media',
                [
                    'fields' => 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}',
                    'limit' => 24,
                ]
            );

            if (! $response->successful()) {
                return [];
            }

            $media = $response->json('data', []);
            if (! is_array($media)) {
                return [];
            }

            $posts = [];
            foreach ($media as $item) {
                if (! is_array($item)) continue;
                $type = $item['media_type'] ?? null;
                if (! in_array($type, ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'], true)
                    || ($item['media_product_type'] ?? null) === 'STORY'
                    || ! is_scalar($item['id'] ?? null)
                    || ! is_string($item['timestamp'] ?? null)
                    || strtotime($item['timestamp']) === false) {
                    continue;
                }

                $imageUrl = null;
                if ($type === 'IMAGE') $imageUrl = $this->httpsUrl($item['media_url'] ?? null);
                if ($type === 'VIDEO') $imageUrl = $this->httpsUrl($item['thumbnail_url'] ?? null);
                if ($type === 'CAROUSEL_ALBUM') {
                    foreach ($item['children']['data'] ?? [] as $child) {
                        if (! is_array($child)) continue;
                        $imageUrl = $this->httpsUrl($child['media_url'] ?? $child['thumbnail_url'] ?? null);
                        if ($imageUrl) break;
                    }
                    $imageUrl ??= $this->httpsUrl($item['media_url'] ?? null);
                }

                $permalink = $this->httpsUrl($item['permalink'] ?? null);
                $hostName = $permalink ? parse_url($permalink, PHP_URL_HOST) : null;
                if (! in_array($hostName, ['instagram.com', 'www.instagram.com'], true)) {
                    $permalink = 'https://www.instagram.com/gaspronal/';
                }

                $posts[] = [
                    'id' => (string) $item['id'],
                    'caption' => is_string($item['caption'] ?? null) ? trim($item['caption']) : '',
                    'mediaType' => $type,
                    'imageUrl' => $imageUrl,
                    'permalink' => $permalink,
                    'timestamp' => $item['timestamp'],
                ];
            }

            usort($posts, fn (array $a, array $b): int =>
                strtotime($b['timestamp']) <=> strtotime($a['timestamp'])
            );

            return array_slice($posts, 0, 6);
        } catch (Throwable $exception) {
            // No revelar tokens, URLs ni respuestas de Meta en errores públicos.
            return [];
        }
    }

    private function httpsUrl(mixed $value): ?string
    {
        if (! is_string($value) || ! filter_var($value, FILTER_VALIDATE_URL)) {
            return null;
        }
        return parse_url($value, PHP_URL_SCHEME) === 'https'
            && parse_url($value, PHP_URL_USER) === null
            && parse_url($value, PHP_URL_PASS) === null
            ? $value
            : null;
    }
}
