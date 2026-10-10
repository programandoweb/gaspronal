<?php

namespace App\Services;

use App\Models\CatalogItem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class JorgeProductResearchService
{
    private const BASE = 'https://www.gaspronal.com';
    private const PRODUCTS = self::BASE.'/2019/productos';

    public function research(CatalogItem $item): array
    {
        $sourceUrl = $this->findSourceUrl($item);
        $response = Http::timeout(30)->retry(2, 500)->withHeaders([
            'User-Agent' => 'GaspronalMigrationBot/1.0 (+https://gaspronal.com)',
            'Accept' => 'text/html,application/xhtml+xml',
        ])->get($sourceUrl);

        if (! $response->successful()) {
            throw new RuntimeException("La ficha oficial respondió HTTP {$response->status()}.");
        }

        $html = $response->body();
        $document = $this->document($html);
        $xpath = new \DOMXPath($document);

        $title = $this->firstText($xpath, '//h1|//h2') ?: $item->name;
        $description = $this->extractDescription($xpath);
        $specifications = $this->extractSpecifications($description);
        $meta = $this->extractMeta($xpath, $sourceUrl);
        $images = $this->extractImages($xpath, $sourceUrl, $item);
        $gallery = $this->downloadImages($images, $item->id);
        $meta['source_images'] = $images;

        $seoTitle = $meta['title'] ?? $title;
        $seoDescription = $meta['description'] ?? null;
        $ogImage = $gallery[0] ?? null;

        $item->update([
            'description' => $description ?: $item->description,
            'short_description' => ($meta['description'] ?? null) ?: $item->short_description,
            'specifications' => $specifications ?: $item->specifications,
            'seo_title' => $seoTitle ?: $item->seo_title,
            'seo_description' => $seoDescription ?: $item->seo_description,
            'og_image' => $ogImage ?: $item->og_image,
            'gallery' => $gallery ?: $item->gallery,
            'legacy_source_url' => $sourceUrl,
            'legacy_meta' => $meta,
            'legacy_raw_html' => $html,
            'legacy_research_status' => 'completed',
            'legacy_research_error' => null,
            'legacy_researched_at' => now(),
        ]);

        return [
            'source_url' => $sourceUrl,
            'title' => $title,
            'images' => $gallery,
            'meta' => $meta,
        ];
    }

    public function findSourceUrl(CatalogItem $item): string
    {
        $direct = self::PRODUCTS.'/'.trim($item->slug, '/');
        foreach ([$direct, $direct.'-'] as $candidate) {
            $response = Http::timeout(12)->withHeaders(['User-Agent' => 'GaspronalMigrationBot/1.0'])->get($candidate);
            if ($response->successful() && str_contains(Str::lower($response->body()), Str::lower((string) ($item->reference ?: $item->name)))) {
                return $candidate;
            }
        }

        $links = Cache::remember('jorge:gaspronal-product-links', now()->addHours(6), fn () => $this->discoverProductLinks());
        $needle = $this->normalize(($item->reference ? $item->reference.' ' : '').$item->name);

        $best = null;
        $bestScore = 0.0;

        foreach ($links as $url => $label) {
            $score = $this->similarity($needle, $this->normalize($label.' '.$url));
            if ($score > $bestScore) {
                $best = $url;
                $bestScore = $score;
            }
        }

        if (! $best || $bestScore < 0.38) {
            throw new RuntimeException('No fue posible identificar con seguridad la ficha oficial del producto.');
        }

        return $best;
    }

    private function discoverProductLinks(): array
    {
        $root = Http::timeout(30)->retry(2, 500)->get(self::PRODUCTS);
        if (! $root->successful()) {
            throw new RuntimeException('No fue posible consultar el índice de productos de Gaspronal.');
        }

        $categoryLinks = $this->linksMatching($root->body(), '/2019/productos/categoria/');
        $products = [];

        foreach (array_keys($categoryLinks) as $categoryUrl) {
            $response = Http::timeout(30)->retry(2, 500)->get($categoryUrl);
            if (! $response->successful()) {
                continue;
            }

            foreach ($this->linksMatching($response->body(), '/2019/productos/') as $url => $label) {
                if (! str_contains($url, '/categoria/')) {
                    $products[$url] = $label;
                }
            }
        }

        return $products;
    }

    private function linksMatching(string $html, string $path): array
    {
        $xpath = new \DOMXPath($this->document($html));
        $links = [];

        foreach ($xpath->query('//a[@href]') ?: [] as $node) {
            $href = trim((string) $node->getAttribute('href'));
            if ($href === '') continue;

            $absolute = $this->absoluteUrl($href, self::BASE);
            if (! $this->isOfficialHost($absolute) || ! str_contains($absolute, $path)) continue;

            $links[$absolute] = trim(preg_replace('/\s+/', ' ', $node->textContent) ?? '');
        }

        return $links;
    }

    private function extractMeta(\DOMXPath $xpath, string $sourceUrl): array
    {
        $meta = ['source_url' => $sourceUrl];

        $titleNode = $xpath->query('//title')?->item(0);
        if ($titleNode) $meta['title'] = trim($titleNode->textContent);

        foreach ($xpath->query('//meta[@content]') ?: [] as $node) {
            $key = strtolower(trim((string) ($node->getAttribute('name') ?: $node->getAttribute('property'))));
            $value = trim((string) $node->getAttribute('content'));
            if ($key !== '' && $value !== '') $meta[$key] = $value;
        }

        $canonical = $xpath->query('//link[translate(@rel,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="canonical"]')?->item(0);
        if ($canonical) $meta['canonical'] = $this->absoluteUrl((string) $canonical->getAttribute('href'), $sourceUrl);

        return $meta;
    }

    private function extractDescription(\DOMXPath $xpath): ?string
    {
        foreach ($xpath->query('//h2|//h3|//h4') ?: [] as $heading) {
            if (! str_contains(Str::upper($heading->textContent), 'DESCRIP')) continue;

            $parts = [];
            $node = $heading->nextSibling;
            while ($node) {
                if ($node instanceof \DOMElement && in_array(strtolower($node->tagName), ['h1','h2','h3','h4'], true)) break;
                $text = trim(preg_replace('/\s+/', ' ', $node->textContent ?? '') ?? '');
                if ($text !== '' && ! str_contains(Str::lower($text), 'pide aquí')) $parts[] = $text;
                $node = $node->nextSibling;
            }

            if ($parts) return implode("\n\n", array_values(array_unique($parts)));
        }

        $parts = [];
        foreach ($xpath->query('//main//p|//article//p') ?: [] as $node) {
            $text = trim(preg_replace('/\s+/', ' ', $node->textContent) ?? '');
            if (mb_strlen($text) > 30) $parts[] = $text;
        }

        return $parts ? implode("\n\n", array_slice(array_values(array_unique($parts)), 0, 12)) : null;
    }

    private function extractSpecifications(?string $description): array
    {
        if (! $description) return [];

        $specifications = [];
        foreach (preg_split('/\R+/', $description) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || ! str_contains($line, ':')) continue;

            [$key, $value] = array_pad(explode(':', $line, 2), 2, null);
            $key = trim((string) $key);
            $value = trim((string) $value);

            if ($key !== '' && $value !== '' && mb_strlen($key) <= 100) {
                $specifications[$key] = $value;
            }
        }

        return $specifications;
    }

    private function extractImages(\DOMXPath $xpath, string $sourceUrl, CatalogItem $item): array
    {
        $images = [];
        $needle = $this->normalize($item->name.' '.$item->reference);

        foreach ($xpath->query('//img[@src]') ?: [] as $node) {
            $src = trim((string) $node->getAttribute('src'));
            if ($src === '') continue;

            $url = $this->absoluteUrl($src, $sourceUrl);
            if (! $this->isOfficialHost($url)) continue;

            $alt = $this->normalize((string) $node->getAttribute('alt'));
            $haystack = $this->normalize($url.' '.$alt);

            if (preg_match('/logo|favicon|facebook|instagram|whatsapp|icon|banner|maps?/i', $haystack)) {
                continue;
            }

            if (
                str_contains($url, '/productos/')
                || $this->similarity($needle, $haystack) >= 0.20
                || ($alt !== '' && $this->similarity($this->normalize($item->name), $alt) >= 0.35)
            ) {
                $images[$url] = $url;
            }
        }

        return array_values($images);
    }

    private function downloadImages(array $urls, int $productId): array
    {
        if (! $urls) return [];

        $directory = public_path("images/uploads/agente/{$productId}");
        if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException("No fue posible crear {$directory}.");
        }

        $saved = [];
        foreach (array_slice($urls, 0, 20) as $index => $url) {
            $response = Http::timeout(30)->retry(2, 500)->get($url);
            if (! $response->successful()) continue;

            $contentType = strtolower((string) $response->header('Content-Type'));
            if (! str_starts_with($contentType, 'image/')) continue;

            $image = @imagecreatefromstring($response->body());
            if ($image === false) continue;

            $filename = $index === 0 ? 'image.jpg' : 'image-'.($index + 1).'.jpg';
            $target = $directory.'/'.$filename;

            imageinterlace($image, true);
            ob_start();
            imagejpeg($image, null, 88);
            $bytes = ob_get_clean();
            if (file_put_contents($target, app(ImageWatermarkService::class)->apply($bytes)) === false) {
                throw new RuntimeException('No fue posible guardar la imagen investigada.');
            }
            imagedestroy($image);

            $saved[] = "/images/uploads/agente/{$productId}/{$filename}";
        }

        return $saved;
    }

    private function document(string $html): \DOMDocument
    {
        $document = new \DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();

        return $document;
    }

    private function firstText(\DOMXPath $xpath, string $query): ?string
    {
        $node = $xpath->query($query)?->item(0);
        return $node ? trim(preg_replace('/\s+/', ' ', $node->textContent) ?? '') : null;
    }

    private function absoluteUrl(string $url, string $base): string
    {
        if (preg_match('#^https?://#i', $url)) return $url;
        if (str_starts_with($url, '//')) return 'https:'.$url;
        if (str_starts_with($url, '/')) return self::BASE.$url;

        $parts = parse_url($base);
        $path = isset($parts['path']) ? rtrim(dirname($parts['path']), '/') : '';

        return ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? 'www.gaspronal.com').$path.'/'.$url;
    }

    private function isOfficialHost(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        return in_array($host, ['gaspronal.com', 'www.gaspronal.com'], true);
    }

    private function normalize(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', Str::lower(Str::ascii($value))) ?? '');
    }

    private function similarity(string $left, string $right): float
    {
        similar_text($left, $right, $percent);
        return $percent / 100;
    }
}
