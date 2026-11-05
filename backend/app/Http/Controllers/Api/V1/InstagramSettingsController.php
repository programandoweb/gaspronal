<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InstagramSetting;
use App\Services\InstagramFeedService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InstagramSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $setting = InstagramSetting::query()->find(1);
        $usingDatabase = $setting !== null;

        return response()->json([
            'data' => [
                'client_id' => $usingDatabase ? ($setting->client_id ?? '') : (string) config('instagram.client_id', ''),
                'instagram_user_id' => $usingDatabase ? $setting->instagram_user_id : (string) config('instagram.instagram_user_id', ''),
                'graph_host' => $usingDatabase ? $setting->graph_host : (string) config('instagram.graph_host', 'graph.facebook.com'),
                'has_token' => $usingDatabase ? filled($setting->access_token) : filled(config('instagram.access_token')),
                'source' => $usingDatabase ? 'database' : 'environment',
            ],
            'meta' => ['can_manage' => (bool) $request->user()?->can('instagram.manage')],
        ]);
    }

    public function update(Request $request, InstagramFeedService $feedService): JsonResponse
    {
        $input = $request->validate([
            'client_id' => ['nullable', 'string', 'max:100', 'regex:/^\d+$/'],
            'instagram_user_id' => ['required', 'string', 'max:100', 'regex:/^\d+$/'],
            'graph_host' => ['required', Rule::in(['graph.facebook.com', 'graph.instagram.com'])],
            'access_token' => ['nullable', 'string', 'min:15', 'max:4096'],
        ]);

        $setting = InstagramSetting::query()->find(1);

        // Nunca se devuelve ni se sobrescribe el token guardado cuando el campo viene vacío.
        $newToken = trim((string) ($input['access_token'] ?? ''));
        if ($setting === null && $newToken === '') {
            throw ValidationException::withMessages([
                'access_token' => 'Introduce el token de acceso para activar esta configuración.',
            ]);
        }

        $values = [
            'client_id' => trim((string) ($input['client_id'] ?? '')) ?: null,
            'instagram_user_id' => $input['instagram_user_id'],
            'graph_host' => $input['graph_host'],
        ];
        if ($newToken !== '') {
            $values['access_token'] = $newToken;
        }

        $setting = InstagramSetting::query()->updateOrCreate(['id' => 1], $values);
        $feedService->clearCache();

        return response()->json([
            'data' => [
                'client_id' => $setting->client_id ?? '',
                'instagram_user_id' => $setting->instagram_user_id,
                'graph_host' => $setting->graph_host,
                'has_token' => filled($setting->access_token),
                'source' => 'database',
            ],
            'message' => 'Configuración de Instagram guardada.',
        ]);
    }
}
