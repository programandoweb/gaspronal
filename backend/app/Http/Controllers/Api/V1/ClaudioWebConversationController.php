<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunicationConversation;
use App\Models\CommunicationMessage;
use App\Models\AgentSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ClaudioWebConversationController extends Controller
{
    private const WELCOME = '¡Hola! Soy Claudio, asesor virtual de Gaspronal. Puedo ayudarte con productos, servicios y cotizaciones. ¿En qué puedo ayudarte hoy?';

    public function create(Request $request): JsonResponse
    {
        abort_unless($this->enabled(), 503, 'La atención web está temporalmente no disponible.');
        $data = $request->validate(['initial_path' => ['nullable', 'string', 'max:500']]);
        $token = Str::random(80);
        $conversation = CommunicationConversation::query()->create([
            'channel' => 'web', 'agent_id' => 'claudio', 'external_thread_id' => (string) Str::uuid(),
            'web_token_hash' => hash('sha256', $token), 'initial_path' => $this->safePath($data['initial_path'] ?? null),
            'status' => 'active', 'expires_at' => now()->addDays(30), 'last_message_at' => now(),
        ]);
        $conversation->messages()->create(['direction' => 'outbound', 'sender_type' => 'system', 'content' => $this->welcome(), 'status' => 'sent', 'sent_at' => now()]);
        return response()->json(['data' => ['token' => $token, 'conversation' => $this->detail($conversation->fresh('messages'))]], 201);
    }

    public function current(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->detail($this->session($request)->load('messages'))]);
    }

    public function message(Request $request): JsonResponse
    {
        abort_unless($this->enabled(), 503, 'La atención web está temporalmente no disponible.');
        $data = $request->validate(['message' => ['required', 'string', 'max:4000'], 'request_id' => ['required', 'uuid']]);
        $conversation = $this->session($request);
        abort_if($conversation->status === 'closed', 409, 'Esta conversación está cerrada.');
        abort_if($conversation->status !== 'active', 409, 'Un asesor está atendiendo esta conversación.');
        $lock = Cache::lock('claudio-web:'.$conversation->id, 45);
        abort_unless($lock->get(), 429, 'Hay un mensaje en proceso. Intenta nuevamente.');

        try {
            if ($conversation->messages()->where('external_message_id', $data['request_id'])->exists()) {
                return response()->json(['data' => $this->detail($conversation->fresh('messages'))]);
            }
            $incoming = $conversation->messages()->create(['direction' => 'inbound', 'sender_type' => 'customer', 'external_message_id' => $data['request_id'], 'content' => trim($data['message']), 'status' => 'received', 'sent_at' => now()]);
            $history = $conversation->messages()->where('id', '<>', $incoming->id)->latest('id')->limit(20)->get()->reverse()->map(fn ($item) => ['role' => $item->direction === 'inbound' ? 'user' : 'assistant', 'content' => $item->content])->values();
            try {
                $response = Http::withToken((string) config('agents.shared_secret'))->acceptJson()->timeout(40)->post(rtrim((string) config('agents.realtime_internal_url'), '/').'/api/agents/claudio/messages', [
                    'message' => $incoming->content, 'requestId' => $data['request_id'], 'history' => $history,
                    'context' => ['channel' => 'web', 'webConversationId' => $conversation->id, 'communicationConversationId' => $conversation->id, 'hasDataProcessingConsent' => $conversation->data_processing_consent_at !== null],
                ]);
                abort_unless($response->successful(), 503, 'Claudio no está disponible en este momento.');
                $answer = trim((string) data_get($response->json(), 'data.message'));
                abort_if($answer === '', 503, 'Claudio no está disponible en este momento.');
                $conversation->messages()->create(['direction' => 'outbound', 'sender_type' => 'agent', 'content' => $answer, 'status' => 'sent', 'sent_at' => now()]);
                $conversation->update(['last_message_at' => now()]);
            } catch (\Throwable $exception) {
                report($exception);
                abort(503, 'No fue posible obtener una respuesta. Intenta nuevamente en unos momentos.');
            }
            return response()->json(['data' => $this->detail($conversation->fresh('messages'))]);
        } finally {
            $lock->release();
        }
    }

    public function consent(Request $request): JsonResponse
    {
        $data = $request->validate(['accepted' => ['required', 'accepted'], 'policy_version' => ['nullable', 'string', 'max:80']]);
        $conversation = $this->session($request);
        $conversation->update(['data_processing_consent_at' => now(), 'data_processing_policy_version' => $data['policy_version'] ?? 'web-v1']);
        return response()->json(['data' => $this->detail($conversation->fresh('messages'))]);
    }

    public function index(Request $request): JsonResponse
    {
        $items = CommunicationConversation::query()->where(['agent_id' => 'claudio', 'channel' => 'web'])->with('latestMessage')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('last_message_at')->paginate(min(max($request->integer('per_page', 25), 1), 100));
        $items->setCollection($items->getCollection()->map(fn ($item) => $this->summary($item)));
        return response()->json($items);
    }

    public function show(CommunicationConversation $conversation): JsonResponse { return response()->json(['data' => $this->detail($this->web($conversation)->load('messages'))]); }
    public function takeover(CommunicationConversation $conversation): JsonResponse { return $this->setStatus($conversation, 'human_active'); }
    public function resume(CommunicationConversation $conversation): JsonResponse { return $this->setStatus($conversation, 'active'); }
    public function close(CommunicationConversation $conversation): JsonResponse { return $this->setStatus($conversation, 'closed'); }
    public function reply(Request $request, CommunicationConversation $conversation): JsonResponse {
        $data = $request->validate(['message' => ['required', 'string', 'max:4000']]); $conversation = $this->web($conversation);
        abort_unless(in_array($conversation->status, ['waiting_human','human_active'], true), 409, 'Debes tomar control primero.');
        $message = $conversation->messages()->create(['direction' => 'outbound','sender_type' => 'human','content' => trim($data['message']),'status' => 'sent','sent_at' => now()]);
        $conversation->update(['last_message_at' => now(), 'status' => 'human_active', 'human_takeover_at' => $conversation->human_takeover_at ?? now()]);
        return response()->json(['data' => $this->formatMessage($message)], 201);
    }

    private function session(Request $request): CommunicationConversation { $token = (string) $request->header('X-Claudio-Web-Session', ''); abort_if(strlen($token) < 40, 401, 'Sesión inválida.'); return $this->web(CommunicationConversation::query()->where('web_token_hash', hash('sha256', $token))->where('expires_at', '>', now())->firstOrFail()); }
    private function web(CommunicationConversation $conversation): CommunicationConversation { abort_unless($conversation->agent_id === 'claudio' && $conversation->channel === 'web', 404, 'Conversación no encontrada.'); return $conversation; }
    private function setStatus(CommunicationConversation $conversation, string $status): JsonResponse { $conversation=$this->web($conversation); $conversation->update(['status'=>$status,'human_takeover_at'=>$status==='human_active'?now():null]); return response()->json(['data'=>$this->detail($conversation->fresh('messages'))]); }
    private function summary(CommunicationConversation $c): array { return ['id'=>$c->id,'channel'=>$c->channel,'status'=>$c->status,'contact_name'=>$c->contact_name,'initial_path'=>$c->initial_path,'last_message_at'=>$c->last_message_at?->toIso8601String(),'messages_count'=>$c->messages()->count(),'latest_message'=>$c->latestMessage ? $this->formatMessage($c->latestMessage) : null]; }
    private function detail(CommunicationConversation $c): array { return [...$this->summary($c), 'has_data_processing_consent'=>$c->data_processing_consent_at !== null, 'messages'=>$c->messages->sortBy('id')->values()->map(fn($m)=>$this->formatMessage($m))]; }
    private function formatMessage(CommunicationMessage $m): array { return ['id'=>$m->id,'direction'=>$m->direction,'sender_type'=>$m->sender_type,'content'=>$m->content,'sent_at'=>$m->sent_at?->toIso8601String()]; }
    private function safePath(?string $path): ?string { return $path && str_starts_with($path, '/') ? $path : null; }
    private function enabled(): bool { return (bool) AgentSetting::query()->where('agent_id', 'claudio')->value('web_channel_enabled'); }
    private function welcome(): string { return (string) (AgentSetting::query()->where('agent_id', 'claudio')->value('web_welcome_message') ?: self::WELCOME); }
}
