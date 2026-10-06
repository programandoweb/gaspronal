<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunicationConversation;
use App\Models\CommunicationMessage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class CommunicationConversationController extends Controller
{
    private const STATUSES = ['active', 'waiting_human', 'human_active', 'closed'];

    public function index(Request $request): JsonResponse
    {
        $paginator = CommunicationConversation::query()
            ->where('agent_id', 'claudio')
            ->where('channel', 'whatsapp')
            ->with(['user:id,name,email,whatsapp', 'latestMessage'])
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', (string) $request->input('status')),
            )
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->paginate(min(max($request->integer('per_page', 50), 1), 100));

        $paginator->setCollection(
            $paginator->getCollection()->map(
                fn (CommunicationConversation $conversation) => $this->summary($conversation)
            )
        );

        return response()->json($paginator);
    }

    public function show(CommunicationConversation $communicationConversation): JsonResponse
    {
        $conversation = $this->claudioConversation($communicationConversation);
        $conversation->load([
            'user:id,name,email,whatsapp,data_processing_consent_at',
            'messages' => fn ($query) => $query->orderBy('id'),
        ]);

        return response()->json(['data' => $this->detail($conversation)]);
    }

    public function takeover(CommunicationConversation $communicationConversation): JsonResponse
    {
        $conversation = $this->claudioConversation($communicationConversation);
        abort_if($conversation->status === 'closed', 409, 'La conversación está cerrada.');

        $conversation->update([
            'status' => 'human_active',
            'human_takeover_at' => now(),
        ]);

        return $this->show($conversation->fresh());
    }

    public function resume(CommunicationConversation $communicationConversation): JsonResponse
    {
        $conversation = $this->claudioConversation($communicationConversation);

        $conversation->update([
            'status' => 'active',
            'human_takeover_at' => null,
        ]);

        return $this->show($conversation->fresh());
    }

    public function close(CommunicationConversation $communicationConversation): JsonResponse
    {
        $conversation = $this->claudioConversation($communicationConversation);
        $conversation->update(['status' => 'closed']);

        return $this->show($conversation->fresh());
    }

    public function reply(Request $request, CommunicationConversation $communicationConversation): JsonResponse
    {
        $conversation = $this->claudioConversation($communicationConversation);
        $data = $request->validate([
            'message' => ['required', 'string', 'max:10000'],
        ]);

        abort_unless(
            in_array($conversation->status, ['waiting_human', 'human_active'], true),
            409,
            'Debes tomar control de la conversación antes de responder.',
        );
        abort_if(! $conversation->provider_id, 409, 'La conversación no tiene un proveedor de WhatsApp asociado.');
        abort_if(! $conversation->contact_phone, 409, 'La conversación no tiene un número de WhatsApp válido.');

        if ($conversation->status === 'waiting_human') {
            $conversation->update([
                'status' => 'human_active',
                'human_takeover_at' => now(),
            ]);
        }

        $secret = trim((string) config('agents.shared_secret'));
        abort_if($secret === '', 503, 'AGENT_SHARED_SECRET no está configurado.');

        $url = rtrim((string) config('agents.realtime_internal_url'), '/')
            .'/api/channels/'.$conversation->provider_id.'/send';

        $response = Http::withToken($secret)
            ->acceptJson()
            ->timeout(30)
            ->post($url, [
                'recipient' => $conversation->contact_phone,
                'text' => trim((string) $data['message']),
            ]);

        if (! $response->successful()) {
            abort(502, (string) ($response->json('message') ?? 'No fue posible enviar el mensaje por WhatsApp.'));
        }

        $result = (array) $response->json('data', []);
        $message = CommunicationMessage::query()->create([
            'conversation_id' => $conversation->id,
            'provider_id' => $conversation->provider_id,
            'direction' => 'outbound',
            'sender_type' => 'human',
            'external_message_id' => $result['message_id'] ?? null,
            'content' => trim((string) $data['message']),
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        $conversation->update(['last_message_at' => now()]);

        return response()->json(['data' => $this->messagePayload($message)], 201);
    }

    public function internalReceive(Request $request): JsonResponse
    {
        $this->authorizeInternal($request);

        $data = $request->validate([
            'provider_id' => ['required', 'integer', 'exists:communication_providers,id'],
            'external_thread_id' => ['required', 'string', 'max:191'],
            'external_message_id' => ['required', 'string', 'max:191'],
            'contact_phone' => ['required', 'string', 'max:40'],
            'contact_name' => ['nullable', 'string', 'max:190'],
            'text' => ['required', 'string', 'max:20000'],
            'metadata' => ['nullable', 'array'],
        ]);

        [$conversation, $message] = DB::transaction(function () use ($data): array {
            $conversation = CommunicationConversation::query()->firstOrCreate(
                [
                    'provider_id' => $data['provider_id'],
                    'external_thread_id' => $data['external_thread_id'],
                ],
                [
                    'channel' => 'whatsapp',
                    'agent_id' => 'claudio',
                    'contact_phone' => $data['contact_phone'],
                    'contact_name' => $data['contact_name'] ?? null,
                    'status' => 'active',
                ],
            );

            $user = User::query()->where('whatsapp', $data['contact_phone'])->first();
            $updates = [
                'contact_phone' => $data['contact_phone'],
                'last_message_at' => now(),
            ];

            if (! empty($data['contact_name'])) {
                $updates['contact_name'] = $data['contact_name'];
            }
            if ($user && ! $conversation->user_id) {
                $updates['user_id'] = $user->id;
            }
            if ($conversation->status === 'closed') {
                $updates['status'] = 'active';
                $updates['human_takeover_at'] = null;
            }

            $conversation->update($updates);

            $message = CommunicationMessage::query()->firstOrCreate(
                [
                    'conversation_id' => $conversation->id,
                    'external_message_id' => $data['external_message_id'],
                ],
                [
                    'provider_id' => $data['provider_id'],
                    'direction' => 'inbound',
                    'sender_type' => 'customer',
                    'content' => trim((string) $data['text']),
                    'status' => 'received',
                    'metadata' => $data['metadata'] ?? null,
                    'sent_at' => now(),
                ],
            );

            return [$conversation->fresh(), $message];
        });

        $conversation->load('user:id,name,email,whatsapp,data_processing_consent_at');

        $history = $conversation->messages()
            ->where('id', '<>', $message->id)
            ->whereIn('sender_type', ['customer', 'agent', 'human', 'system'])
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (CommunicationMessage $item) => [
                'role' => $item->direction === 'inbound' ? 'user' : 'assistant',
                'content' => $item->content,
            ]);

        return response()->json([
            'data' => [
                'conversation' => $this->summary($conversation),
                'history' => $history,
                'customer' => $conversation->user ? [
                    'id' => $conversation->user->id,
                    'name' => $conversation->user->name,
                    'email' => $conversation->user->email,
                    'whatsapp' => $conversation->user->whatsapp,
                    'has_data_processing_consent' => $conversation->user->data_processing_consent_at !== null,
                ] : null,
                'duplicate' => ! $message->wasRecentlyCreated,
                'should_automate' => $message->wasRecentlyCreated && $conversation->status === 'active',
            ],
        ]);
    }

    public function internalRecordOutbound(
        Request $request,
        CommunicationConversation $communicationConversation,
    ): JsonResponse {
        $this->authorizeInternal($request);
        $conversation = $this->claudioConversation($communicationConversation);

        $data = $request->validate([
            'external_message_id' => ['nullable', 'string', 'max:191'],
            'text' => ['required', 'string', 'max:20000'],
            'sender_type' => ['required', Rule::in(['agent', 'system'])],
            'status' => ['nullable', Rule::in(['sent', 'failed'])],
            'metadata' => ['nullable', 'array'],
        ]);

        $attributes = [
            'provider_id' => $conversation->provider_id,
            'direction' => 'outbound',
            'sender_type' => $data['sender_type'],
            'content' => trim((string) $data['text']),
            'status' => $data['status'] ?? 'sent',
            'metadata' => $data['metadata'] ?? null,
            'sent_at' => ($data['status'] ?? 'sent') === 'sent' ? now() : null,
        ];

        if (! empty($data['external_message_id'])) {
            $message = CommunicationMessage::query()->firstOrCreate(
                [
                    'conversation_id' => $conversation->id,
                    'external_message_id' => $data['external_message_id'],
                ],
                $attributes,
            );
        } else {
            $message = $conversation->messages()->create($attributes);
        }

        $conversation->update(['last_message_at' => now()]);

        return response()->json(
            ['data' => $this->messagePayload($message)],
            $message->wasRecentlyCreated ? 201 : 200,
        );
    }

    public function internalState(
        Request $request,
        CommunicationConversation $communicationConversation,
    ): JsonResponse {
        $this->authorizeInternal($request);
        $conversation = $this->claudioConversation($communicationConversation);

        return response()->json([
            'data' => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'should_automate' => $conversation->status === 'active',
            ],
        ]);
    }

    public function internalStatus(
        Request $request,
        CommunicationConversation $communicationConversation,
    ): JsonResponse {
        $this->authorizeInternal($request);
        $conversation = $this->claudioConversation($communicationConversation);

        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
        ]);

        $conversation->update([
            'status' => $data['status'],
            'human_takeover_at' => $data['status'] === 'human_active'
                ? ($conversation->human_takeover_at ?? now())
                : ($data['status'] === 'active' ? null : $conversation->human_takeover_at),
        ]);

        return response()->json(['data' => $this->summary($conversation->fresh())]);
    }

    private function claudioConversation(CommunicationConversation $conversation): CommunicationConversation
    {
        abort_unless(
            $conversation->agent_id === 'claudio' && $conversation->channel === 'whatsapp',
            404,
            'Conversación no encontrada.',
        );

        return $conversation;
    }

    private function summary(CommunicationConversation $conversation): array
    {
        $latest = $conversation->relationLoaded('latestMessage') ? $conversation->latestMessage : null;

        return [
            'id' => $conversation->id,
            'provider_id' => $conversation->provider_id,
            'channel' => $conversation->channel,
            'agent_id' => $conversation->agent_id,
            'contact_phone' => $conversation->contact_phone,
            'contact_name' => $conversation->contact_name ?: $conversation->user?->name,
            'status' => $conversation->status,
            'human_takeover_at' => $conversation->human_takeover_at?->toIso8601String(),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'customer' => $conversation->user ? [
                'id' => $conversation->user->id,
                'name' => $conversation->user->name,
                'email' => $conversation->user->email,
                'whatsapp' => $conversation->user->whatsapp,
            ] : null,
            'latest_message' => $latest ? $this->messagePayload($latest) : null,
        ];
    }

    private function detail(CommunicationConversation $conversation): array
    {
        return [
            ...$this->summary($conversation),
            'messages' => $conversation->messages
                ->map(fn (CommunicationMessage $message) => $this->messagePayload($message))
                ->values(),
        ];
    }

    private function messagePayload(CommunicationMessage $message): array
    {
        return [
            'id' => $message->id,
            'direction' => $message->direction,
            'sender_type' => $message->sender_type,
            'content' => $message->content,
            'status' => $message->status,
            'external_message_id' => $message->external_message_id,
            'sent_at' => $message->sent_at?->toIso8601String(),
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    private function authorizeInternal(Request $request): void
    {
        $secret = trim((string) config('agents.shared_secret'));
        abort_if(
            $secret === '' || ! hash_equals($secret, (string) $request->header('X-Agent-Shared-Secret', '')),
            401,
            'No autorizado.',
        );
    }
}
