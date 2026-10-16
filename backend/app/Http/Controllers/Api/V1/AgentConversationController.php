<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AgentConversationMessage;
use App\Models\AgentConversationSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentConversationController extends Controller
{
    private const AGENTS = ['cristina', 'jorge', 'claudio', 'sofia'];

    public function index(Request $request, string $agent): JsonResponse
    {
        $agent = $this->agent($agent);

        $sessions = AgentConversationSession::query()
            ->where('user_id', $request->user()->id)
            ->where('agent_id', $agent)
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit(min(max($request->integer('per_page', 50), 1), 100))
            ->get()
            ->map(fn (AgentConversationSession $session) => $this->summary($session));

        return response()->json(['data' => $sessions]);
    }

    public function latest(Request $request, string $agent): JsonResponse
    {
        $agent = $this->agent($agent);

        $session = AgentConversationSession::query()
            ->where('user_id', $request->user()->id)
            ->where('agent_id', $agent)
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'data' => $session ? $this->payload($session) : null,
        ]);
    }

    public function store(Request $request, string $agent): JsonResponse
    {
        $agent = $this->agent($agent);

        $session = AgentConversationSession::query()->create([
            'user_id' => $request->user()->id,
            'agent_id' => $agent,
            'title' => 'Nueva conversación',
        ]);

        return response()->json(['data' => $this->payload($session)], 201);
    }

    public function show(Request $request, string $agent, AgentConversationSession $session): JsonResponse
    {
        $agent = $this->agent($agent);
        $this->assertOwned($request, $session, $agent);

        return response()->json(['data' => $this->payload($session)]);
    }

    public function storeMessage(
        Request $request,
        string $agent,
        AgentConversationSession $session,
    ): JsonResponse {
        $agent = $this->agent($agent);
        $this->assertOwned($request, $session, $agent);

        $data = $request->validate([
            'content' => ['required', 'string'],
            'request_id' => ['required', 'uuid'],
        ]);

        $message = AgentConversationMessage::query()->firstOrCreate(
            [
                'session_id' => $session->id,
                'request_id' => $data['request_id'],
                'role' => 'user',
            ],
            ['content' => trim($data['content'])],
        );

        if ($session->title === 'Nueva conversación') {
            $session->title = mb_substr(trim($data['content']), 0, 180);
        }
        $session->last_message_at = now();
        $session->save();

        return response()->json(['data' => $message], $message->wasRecentlyCreated ? 201 : 200);
    }

    private function payload(AgentConversationSession $session): array
    {
        $session->load(['messages' => fn ($query) => $query->orderBy('id')]);

        return [
            'id' => $session->id,
            'agent_id' => $session->agent_id,
            'title' => $session->title,
            'last_message_at' => $session->last_message_at?->toIso8601String(),
            'created_at' => $session->created_at?->toIso8601String(),
            'messages' => $session->messages->map(fn (AgentConversationMessage $message) => [
                'id' => $message->id,
                'role' => $message->role,
                'content' => $message->content,
                'request_id' => $message->request_id,
                'created_at' => $message->created_at?->toIso8601String(),
            ])->values(),
        ];
    }

    private function summary(AgentConversationSession $session): array
    {
        return [
            'id' => $session->id,
            'agent_id' => $session->agent_id,
            'title' => $session->title ?: 'Nueva conversación',
            'last_message_at' => $session->last_message_at?->toIso8601String(),
            'created_at' => $session->created_at?->toIso8601String(),
        ];
    }

    private function assertOwned(Request $request, AgentConversationSession $session, string $agent): void
    {
        abort_unless(
            $session->user_id === $request->user()->id && $session->agent_id === $agent,
            404,
            'Sesión no encontrada.',
        );
    }

    private function agent(string $agent): string
    {
        $agent = strtolower(trim($agent));
        abort_unless(in_array($agent, self::AGENTS, true), 404, 'Agente no encontrado.');

        return $agent;
    }
}
