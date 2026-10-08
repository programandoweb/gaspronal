<?php

namespace Tests\Feature;

use App\Models\AgentImageEnhancementJob;
use App\Models\AgentImageEnhancementRun;
use App\Models\AiModel;
use App\Models\AiProvider;
use App\Models\CatalogItem;
use App\Services\JorgeImageEnhancementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class JorgeImageEnhancementServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('k', 32))]);
        Storage::fake('public');
    }

    public function test_it_keeps_original_and_promotes_generated_image(): void
    {
        [$item, $job] = $this->fixture();

        Http::fake([
            '*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [[
                            'inlineData' => [
                                'mimeType' => 'image/png',
                                'data' => base64_encode($this->png()),
                            ],
                        ]],
                    ],
                ]],
            ], 200),
        ]);

        $result = app(JorgeImageEnhancementService::class)->enhance($job);
        $item->refresh();

        $this->assertSame('/api/catalog-media/'.$item->id.'/original.png', $result['source_image']);
        $this->assertSame($result['generated_image'], $item->og_image);
        $this->assertContains('/api/catalog-media/'.$item->id.'/original.png', $item->gallery);
        $this->assertContains($result['generated_image'], $item->gallery);
        Storage::disk('public')->assertExists('catalog/'.$item->id.'/'.basename($result['generated_image']));
    }

    public function test_it_does_not_change_primary_when_gemini_fails(): void
    {
        [$item, $job] = $this->fixture();
        $original = $item->og_image;

        Http::fake(['*' => Http::response(['error' => ['message' => 'quota']], 500)]);

        try {
            app(JorgeImageEnhancementService::class)->enhance($job);
            $this->fail('Se esperaba una excepción.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('quota', $exception->getMessage());
        }

        $item->refresh();
        $this->assertSame($original, $item->og_image);
        $this->assertSame([$original], $item->gallery);
    }

    private function fixture(): array
    {
        $provider = AiProvider::query()->create([
            'code' => 'gemini-test',
            'name' => 'Gemini Test',
            'driver' => 'gemini',
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
            'credentials' => ['api_key' => 'test-key'],
            'timeout_seconds' => 10,
            'max_retries' => 0,
            'verify_tls' => true,
            'allow_private_network' => false,
            'is_active' => true,
        ]);

        AiModel::query()->create([
            'ai_provider_id' => $provider->id,
            'code' => 'gemini-image-test',
            'name' => 'Gemini Image Test',
            'model_identifier' => 'gemini-image-test',
            'priority' => 1,
            'capabilities' => ['image_generation'],
            'is_active' => true,
        ]);

        $item = CatalogItem::query()->create([
            'type' => 'product',
            'name' => 'Equipo industrial',
            'reference' => 'TEST-01',
            'slug' => 'equipo-industrial',
            'status' => 'published',
        ]);

        $original = '/api/catalog-media/'.$item->id.'/original.png';
        Storage::disk('public')->put('catalog/'.$item->id.'/original.png', $this->png());
        $item->update(['og_image' => $original, 'gallery' => [$original]]);

        $run = AgentImageEnhancementRun::query()->create([
            'agent_id' => 'jorge',
            'status' => 'running',
            'total_items' => 1,
        ]);

        $job = AgentImageEnhancementJob::query()->create([
            'run_id' => $run->id,
            'catalog_item_id' => $item->id,
            'idempotency_key' => 'auto:'.$item->id,
            'mode' => 'auto',
            'status' => 'processing',
        ]);

        return [$item->fresh(), $job];
    }

    private function png(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
    }
}
