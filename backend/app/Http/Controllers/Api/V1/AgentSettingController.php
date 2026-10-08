<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AgentSetting;
use App\Models\AiModel;
use App\Models\AiProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AgentSettingController extends Controller
{
    private const AGENTS = ['cristina', 'jorge', 'claudio', 'sofia', 'lucia', 'leonardo'];

    public function show(string $agent): JsonResponse
    {
        $agent = $this->agent($agent);
        $setting = AgentSetting::query()
            ->with([
                'primaryAiModel.provider:id,name,code,driver',
                'fallbackAiModel.provider:id,name,code,driver',
            ])
            ->where('agent_id', $agent)
            ->first();

        return response()->json([
            'data' => [
                'agent_id' => $agent,
                'provider' => $setting?->provider ?? 'gemini',
                'model' => $setting?->model ?? 'gemini-2.5-flash',
                'has_api_key' => filled($setting?->api_key),
                'primary_ai_model_id' => $setting?->primary_ai_model_id,
                'fallback_ai_model_id' => $setting?->fallback_ai_model_id,
                'primary_ai_model' => $this->serializeAiModel($setting?->primaryAiModel),
                'fallback_ai_model' => $this->serializeAiModel($setting?->fallbackAiModel),
            ],
        ]);
    }

    public function update(Request $request, string $agent): JsonResponse
    {
        $agent = $this->agent($agent);

        $data = $request->validate([
            'provider' => ['sometimes', Rule::in(['gemini'])],
            'model' => ['sometimes', 'string', 'max:120'],
            'api_key' => ['sometimes', 'nullable', 'string', 'max:500'],
            'primary_ai_model_id' => ['sometimes', 'nullable', 'integer', 'exists:ai_models,id'],
            'fallback_ai_model_id' => ['sometimes', 'nullable', 'integer', 'different:primary_ai_model_id', 'exists:ai_models,id'],
        ]);

        $setting = AgentSetting::query()->firstOrNew(['agent_id' => $agent]);
        $setting->provider = $data['provider'] ?? $setting->provider ?? 'gemini';
        $setting->model = $data['model'] ?? $setting->model ?? 'gemini-2.5-flash';

        if (array_key_exists('api_key', $data)) {
            $setting->api_key = filled($data['api_key']) ? trim((string) $data['api_key']) : null;
        }

        if (array_key_exists('primary_ai_model_id', $data)) {
            $setting->primary_ai_model_id = $data['primary_ai_model_id'];
        }

        if (array_key_exists('fallback_ai_model_id', $data)) {
            $setting->fallback_ai_model_id = $data['fallback_ai_model_id'];
        }

        $setting->save();

        return $this->show($agent);
    }

    public function internalCredentials(Request $request, string $agent): JsonResponse
    {
        $secret = trim((string) config('agents.shared_secret'));

        abort_if(
            $secret === '' || ! hash_equals($secret, (string) $request->header('X-Agent-Shared-Secret', '')),
            401,
            'No autorizado.'
        );

        $agent = $this->agent($agent);
        $setting = AgentSetting::query()
            ->with([
                'primaryAiModel.provider',
                'fallbackAiModel.provider',
            ])
            ->where('agent_id', $agent)
            ->first();

        return response()->json([
            'data' => [
                'agent_id' => $agent,
                'provider' => $setting?->provider ?? 'gemini',
                'model' => $setting?->model ?? 'gemini-2.5-flash',
                'api_key' => $setting?->api_key,
                'primary' => $this->serializeRuntimeModel($setting?->primaryAiModel),
                'fallback' => $this->serializeRuntimeModel($setting?->fallbackAiModel),
            ],
        ]);
    }

    private function serializeAiModel(?AiModel $model): ?array
    {
        if (! $model) {
            return null;
        }

        $provider = $model->provider ?? AiProvider::query()->find($model->ai_provider_id);

        return [
            'id' => (int) $model->id,
            'name' => $model->name,
            'code' => $model->code,
            'model_identifier' => $model->model_identifier,
            'provider' => $provider ? [
                'id' => (int) $provider->id,
                'name' => $provider->name,
                'code' => $provider->code,
                'driver' => $provider->driver,
            ] : null,
        ];
    }

    private function serializeRuntimeModel(?AiModel $model): ?array
    {
        if (! $model || ! $model->is_active) {
            return null;
        }

        $provider = $model->provider ?? AiProvider::query()->find($model->ai_provider_id);

        if (! $provider || ! $provider->is_active) {
            return null;
        }

        $credentials = $provider->credentials ?? [];

        return [
            'id' => (int) $model->id,
            'name' => $model->name,
            'model_identifier' => $model->model_identifier,
            'provider' => [
                'id' => (int) $provider->id,
                'name' => $provider->name,
                'code' => $provider->code,
                'driver' => $provider->driver,
                'base_url' => $provider->base_url,
                'api_key' => $credentials['api_key'] ?? null,
                'timeout_seconds' => (int) $provider->timeout_seconds,
                'verify_tls' => (bool) $provider->verify_tls,
            ],
        ];
    }

    private function agent(string $agent): string
    {
        $agent = strtolower(trim($agent));
        abort_unless(in_array($agent, self::AGENTS, true), 404, 'Agente no encontrado.');

        return $agent;
    }
}
