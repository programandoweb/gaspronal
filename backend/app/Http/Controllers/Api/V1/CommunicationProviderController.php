<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunicationOutboundMessage;
use App\Models\CommunicationProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommunicationProviderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $paginator = CommunicationProvider::query()
            ->orderBy('channel')
            ->orderBy('is_fallback')
            ->orderBy('priority')
            ->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        $paginator->setCollection(
            $paginator->getCollection()->map(fn (CommunicationProvider $provider) => $this->safeProvider($provider))
        );

        return response()->json($paginator);
    }

    public function show(CommunicationProvider $communicationProvider): JsonResponse
    {
        return response()->json(['data' => $this->safeProvider($communicationProvider)]);
    }

    public function publicWhatsappLink(): JsonResponse
    {
        $provider = CommunicationProvider::query()
            ->where('channel', 'whatsapp')
            ->where('driver', 'whatsapp_link')
            ->where('enabled', true)
            ->orderBy('id')
            ->first();

        return response()->json([
            'data' => $provider ? [
                'id' => (string) $provider->id,
                'name' => $provider->name,
                'whatsapp' => $provider->settings['whatsapp'] ?? null,
            ] : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateProvider($request);
        $provider = CommunicationProvider::query()->create($data);

        return response()->json(['data' => $this->safeProvider($provider)], 201);
    }

    public function update(Request $request, CommunicationProvider $communicationProvider): JsonResponse
    {
        $data = $this->validateProvider($request, $communicationProvider);

        if (! array_key_exists('credentials', $data)) {
            unset($data['credentials']);
        }

        $communicationProvider->update($data);

        return response()->json(['data' => $this->safeProvider($communicationProvider->fresh())]);
    }

    public function destroy(CommunicationProvider $communicationProvider): JsonResponse
    {
        $communicationProvider->delete();
        return response()->json([], 204);
    }

    public function internalList(Request $request): JsonResponse
    {
        $this->authorizeInternal($request);

        $providers = CommunicationProvider::query()
            ->orderBy('channel')
            ->orderBy('is_fallback')
            ->orderBy('priority')
            ->orderBy('name')
            ->get()
            ->map(fn (CommunicationProvider $provider) => [
                'id' => (string) $provider->id,
                'name' => $provider->name,
                'channel' => $provider->channel,
                'driver' => $provider->driver,
                'is_fallback' => $provider->is_fallback,
                'priority' => $provider->priority,
                'auto_connect' => $provider->auto_connect,
                'enabled' => $provider->enabled,
                'settings' => $provider->settings ?? [],
                'credentials' => $provider->credentials ?? [],
            ]);

        return response()->json(['data' => $providers]);
    }

    public function internalLog(Request $request): JsonResponse
    {
        $this->authorizeInternal($request);

        $data = $request->validate([
            'provider_id' => ['nullable', 'integer', 'exists:communication_providers,id'],
            'channel' => ['required', Rule::in(['whatsapp', 'email'])],
            'recipient' => ['required', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'status' => ['required', Rule::in(['sent', 'failed'])],
            'attempts' => ['required', 'integer', 'min:1'],
            'fallback_used' => ['required', 'boolean'],
            'external_message_id' => ['nullable', 'string', 'max:255'],
            'last_error' => ['nullable', 'string'],
        ]);

        $message = CommunicationOutboundMessage::query()->create([
            ...$data,
            'sent_at' => $data['status'] === 'sent' ? now() : null,
        ]);

        return response()->json(['data' => $message], 201);
    }

    private function validateProvider(Request $request, ?CommunicationProvider $provider = null): array
    {
        $channel = (string) $request->input('channel', $provider?->channel ?? '');
        $driver = (string) $request->input('driver', $provider?->driver ?? '');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'channel' => ['required', Rule::in(['whatsapp', 'email'])],
            'driver' => ['required', Rule::in(['baileys', 'smtp', 'whatsapp_link'])],
            'is_fallback' => ['sometimes', 'boolean'],
            'priority' => ['sometimes', 'integer', 'min:1', 'max:9999'],
            'auto_connect' => ['sometimes', 'boolean'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
            'settings.agent_id' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9_-]+$/i'],
            'credentials' => ['nullable', 'array'],
        ]);

        if (
            ($channel === 'whatsapp' && ! in_array($driver, ['baileys', 'whatsapp_link'], true))
            || ($channel === 'email' && $driver !== 'smtp')
        ) {
            abort(422, 'La combinación canal/driver no es válida.');
        }

        if ($driver === 'baileys') {
            validator($data, ['settings.agent_id' => ['required', 'string', 'regex:/^[a-z0-9_-]+$/i']])->validate();
        }

        if ($driver === 'smtp') {
            validator($data, [
                'settings.host' => ['required', 'string', 'max:255'],
                'settings.port' => ['required', 'integer', 'min:1', 'max:65535'],
                'settings.from' => ['required', 'email'],
                'credentials.user' => [$provider && ! $request->has('credentials') ? 'nullable' : 'required', 'string'],
                'credentials.password' => [$provider && ! $request->has('credentials') ? 'nullable' : 'required', 'string'],
            ])->validate();
        }

        if ($driver === 'whatsapp_link') {
            validator($data, [
                'settings.whatsapp' => ['required', 'string', 'max:20', 'regex:/^\\+?[1-9]\\d{7,14}$/'],
            ])->validate();

            $data['settings'] = [
                'whatsapp' => '+'.ltrim((string) $data['settings']['whatsapp'], '+'),
            ];
            $data['credentials'] = [];
            $data['is_fallback'] = false;
            $data['priority'] = 9999;
            $data['auto_connect'] = false;
        }

        $data['is_fallback'] = (bool) ($data['is_fallback'] ?? false);
        $data['priority'] = (int) ($data['priority'] ?? 100);
        $data['auto_connect'] = (bool) ($data['auto_connect'] ?? true);
        $data['enabled'] = (bool) ($data['enabled'] ?? true);

        if ($driver === 'whatsapp_link') {
            $data['is_fallback'] = false;
            $data['priority'] = 9999;
            $data['auto_connect'] = false;
        }

        return $data;
    }

    private function safeProvider(CommunicationProvider $provider): array
    {
        return [
            'id' => (string) $provider->id,
            'name' => $provider->name,
            'channel' => $provider->channel,
            'driver' => $provider->driver,
            'is_fallback' => $provider->is_fallback,
            'priority' => $provider->priority,
            'auto_connect' => $provider->auto_connect,
            'enabled' => $provider->enabled,
            'settings' => $provider->settings ?? [],
            'has_credentials' => ! empty($provider->credentials),
            'created_at' => $provider->created_at,
            'updated_at' => $provider->updated_at,
        ];
    }

    private function authorizeInternal(Request $request): void
    {
        $secret = (string) config('agents.shared_secret');
        if ($secret === '' || ! hash_equals($secret, (string) $request->header('X-Agent-Shared-Secret'))) {
            abort(401, 'No autorizado.');
        }
    }
}
