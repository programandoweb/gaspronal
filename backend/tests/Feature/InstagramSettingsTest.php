<?php

namespace Tests\Feature;

use App\Models\InstagramSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class InstagramSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $user = User::query()->create([
            'name' => 'Administrador', 'email' => 'instagram-admin@example.com', 'password' => 'password',
        ]);
        Permission::findOrCreate('instagram.view', 'api');
        Permission::findOrCreate('instagram.manage', 'api');
        $user->givePermissionTo(['instagram.view', 'instagram.manage']);

        return $user;
    }

    public function test_configuration_is_protected(): void
    {
        $this->getJson('/api/v1/settings/instagram')->assertUnauthorized();
        $this->putJson('/api/v1/settings/instagram', [])->assertUnauthorized();
    }

    public function test_token_is_encrypted_and_never_returned_by_settings_endpoint(): void
    {
        $this->actingAs($this->admin(), 'api');
        $token = 'EAAG-test-VERY-PRIVATE-TOKEN';

        $this->putJson('/api/v1/settings/instagram', [
            'client_id' => '123456789',
            'instagram_user_id' => '987654321',
            'graph_host' => 'graph.facebook.com',
            'access_token' => $token,
        ])->assertOk()->assertJsonPath('data.has_token', true);

        $setting = InstagramSetting::query()->findOrFail(1);
        $this->assertSame($token, $setting->access_token);
        $this->assertNotEquals($token, $setting->getRawOriginal('access_token'));

        $response = $this->getJson('/api/v1/settings/instagram')->assertOk()
            ->assertJsonPath('data.client_id', '123456789')
            ->assertJsonMissingPath('data.access_token');
        $this->assertStringNotContainsString($token, $response->getContent());

        $this->putJson('/api/v1/settings/instagram', [
            'client_id' => '123456789',
            'instagram_user_id' => '987654321',
            'graph_host' => 'graph.facebook.com',
        ])->assertOk();
        $this->assertSame($token, InstagramSetting::query()->findOrFail(1)->access_token);
    }

    public function test_public_feed_uses_saved_credentials_and_never_exposes_token(): void
    {
        Cache::forget('public:instagram:latest-posts:v1');
        InstagramSetting::query()->create([
            'id' => 1,
            'client_id' => '123',
            'instagram_user_id' => '987654321',
            'graph_host' => 'graph.facebook.com',
            'access_token' => 'EAAG-test-VERY-PRIVATE-TOKEN',
        ]);

        Http::fake([
            'graph.facebook.com/*' => Http::response(['data' => [
                [
                    'id' => '500',
                    'media_type' => 'IMAGE',
                    'caption' => 'Fabricación industrial',
                    'media_url' => 'https://cdn.example.com/product.jpg',
                    'permalink' => 'https://www.instagram.com/p/ABC/',
                    'timestamp' => '2026-11-05T12:00:00+0000',
                ],
            ]], 200),
        ]);

        $response = $this->getJson('/api/v1/public/instagram/feed')->assertOk()
            ->assertJsonPath('data.0.id', '500')
            ->assertJsonPath('data.0.mediaType', 'IMAGE');

        $this->assertStringNotContainsString('EAAG-test-VERY-PRIVATE-TOKEN', $response->getContent());
        Http::assertSent(fn ($request) =>
            str_contains($request->url(), '/987654321/media')
            && $request->hasHeader('Authorization', 'Bearer EAAG-test-VERY-PRIVATE-TOKEN')
        );
    }

    public function test_client_id_does_not_replace_instagram_user_id(): void
    {
        $this->actingAs($this->admin(), 'api')->putJson('/api/v1/settings/instagram', [
            'client_id' => '123',
            'instagram_user_id' => '',
            'graph_host' => 'graph.instagram.com',
            'access_token' => 'EAAG-test-VERY-PRIVATE-TOKEN',
        ])->assertUnprocessable()->assertJsonValidationErrors(['instagram_user_id']);
    }
}
