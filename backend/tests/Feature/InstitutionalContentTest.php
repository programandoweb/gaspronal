<?php

namespace Tests\Feature;

use App\Models\PageBlock;
use Database\Seeders\InstitutionalContentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstitutionalContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_keeps_original_texts_and_does_not_overwrite_edits(): void
    {
        $this->seed(InstitutionalContentSeeder::class);

        $block = PageBlock::query()->where('page_key', 'somos-gaspronal')->firstOrFail();
        $this->assertSame('Misión', $block->content['mission_title']);
        $this->assertStringContainsString('Para el año 2025', $block->content['vision_description']);
        $this->assertCount(25, $block->content);

        $edited = $block->content;
        $edited['mission_description'] = 'Misión editada desde el dashboard.';
        $block->update(['content' => $edited]);

        $this->seed(InstitutionalContentSeeder::class);
        $this->assertSame('Misión editada desde el dashboard.', $block->fresh()->content['mission_description']);
        $this->assertSame(1, PageBlock::query()->where('page_key', 'somos-gaspronal')->count());
    }

    public function test_public_page_blocks_endpoint_returns_latest_published_content(): void
    {
        $this->seed(InstitutionalContentSeeder::class);
        $block = PageBlock::query()->where('page_key', 'somos-gaspronal')->firstOrFail();
        $updated = $block->content;
        $updated['vision_description'] = 'Visión actualizada.';
        $block->update(['content' => $updated]);

        $this->getJson('/api/v1/page-blocks/public?page=somos-gaspronal')
            ->assertOk()
            ->assertJsonPath('data.0.block_key', 'institutional')
            ->assertJsonPath('data.0.content.vision_description', 'Visión actualizada.');
    }

    public function test_institutional_editor_requires_authentication(): void
    {
        $this->getJson('/api/v1/institutional')->assertUnauthorized();
        $this->putJson('/api/v1/institutional', ['content' => []])->assertUnauthorized();
    }
}
