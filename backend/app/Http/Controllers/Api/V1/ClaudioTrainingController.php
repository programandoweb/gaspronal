<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class ClaudioTrainingController extends Controller
{
    private const CATEGORIES = ['tone', 'greetings', 'sales', 'objections', 'service', 'procedures', 'products', 'appointments'];

    public function state(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        return response()->json(['data' => [
            'can_approve' => $request->user()->can('agents.training.approve'),
            'sessions' => DB::table('agent_training_sessions')->where('agent_id', 'claudio')->where('user_id', $userId)->orderByDesc('id')->limit(40)->get(),
            'rules' => DB::table('agent_training_rules')->where('agent_id', 'claudio')->orderBy('category')->get(),
        ]]);
    }

    public function createSession(Request $request): JsonResponse
    {
        $id = DB::table('agent_training_sessions')->insertGetId([
            'user_id' => $request->user()->id,
            'agent_id' => 'claudio',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $this->showSession($request, $id);
    }

    public function showSession(Request $request, int $session): JsonResponse
    {
        $this->owned($request, $session);
        return response()->json(['data' => [
            'id' => $session,
            'messages' => DB::table('agent_training_messages')->where('session_id', $session)->orderBy('id')->get(),
            'proposals' => DB::table('agent_training_proposals')->where('session_id', $session)->orderByDesc('id')->get(),
        ]]);
    }

    public function message(Request $request, int $session): JsonResponse
    {
        $this->owned($request, $session);
        $data = $request->validate([
            'content' => ['required', 'string', 'min:2', 'max:5000'],
            'request_id' => ['required', 'uuid'],
        ]);
        $lock = Cache::lock('claudio-trainer:'.$session, 65);
        abort_unless($lock->get(), 429, 'Todavía hay un mensaje en proceso.');
        try {
            if (DB::table('agent_training_messages')->where('session_id', $session)->where('request_id', $data['request_id'])->exists()) {
                return $this->showSession($request, $session);
            }
            $history = DB::table('agent_training_messages')->where('session_id', $session)
                ->orderByDesc('id')->limit(16)->get()->reverse()->map(fn ($m) => [
                    'role' => $m->role, 'content' => $m->content,
                ])->values()->all();

            DB::table('agent_training_messages')->insert([
                'session_id' => $session, 'role' => 'user', 'content' => trim($data['content']),
                'request_id' => $data['request_id'], 'created_at' => now(), 'updated_at' => now(),
            ]);

            $secret = (string) config('agents.shared_secret');
            abort_if(trim($secret) === '', 503, 'Canal interno de entrenamiento no configurado.');
            $response = Http::withToken($secret)->acceptJson()->timeout(50)->post(
                rtrim((string) config('agents.realtime_internal_url'), '/').'/api/agents/claudio/messages',
                ['requestId' => $data['request_id'], 'message' => trim($data['content']),
                 'history' => $history, 'context' => ['channel' => 'dashboard', 'trainingMode' => true]],
            );
            abort_unless($response->successful(), 503, 'No fue posible consultar a Claudio.');
            $raw = trim((string) data_get($response->json(), 'data.message', ''));
            $parsed = json_decode(preg_replace('/^\x60{3}(?:json)?\s*|\s*\x60{3}$/i', '', $raw), true);
            $assistant = 'Puedo ayudarte a definir una regla. Dime qué comportamiento quieres cambiar.';
            if (is_array($parsed)) {
                $assistant = mb_substr(trim((string) ($parsed['message'] ?? $assistant)), 0, 3000);
                if (($parsed['type'] ?? '') === 'proposal'
                    && in_array($parsed['category'] ?? '', self::CATEGORIES, true)
                    && is_string($parsed['content'] ?? null) && mb_strlen(trim($parsed['content'])) >= 8
                    && mb_strlen($parsed['content']) <= 4000) {
                    DB::table('agent_training_proposals')->insert([
                        'session_id' => $session, 'category' => $parsed['category'],
                        'title' => mb_substr(trim((string) ($parsed['title'] ?? ucfirst($parsed['category']))), 0, 180),
                        'content' => trim($parsed['content']), 'operation' => ($parsed['operation'] ?? 'append') === 'replace' ? 'replace' : 'append', 'status' => 'pending',
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
            } elseif ($raw !== '') {
                $assistant = mb_substr($raw, 0, 3000);
            }
            DB::table('agent_training_messages')->insert([
                'session_id' => $session, 'role' => 'assistant', 'content' => $assistant,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('agent_training_sessions')->where('id', $session)->update(['updated_at' => now()]);
            return $this->showSession($request, $session);
        } finally {
            $lock->release();
        }
    }

    public function approve(Request $request, int $proposal): JsonResponse
    {
        DB::transaction(function () use ($request, $proposal): void {
            $pending = DB::table('agent_training_proposals')->where('id', $proposal)->lockForUpdate()->first();
            abort_unless($pending && $pending->status === 'pending', 409, 'Esta propuesta ya fue revisada.');
            $ownedSession = DB::table('agent_training_sessions')->where('id', $pending->session_id)->where('agent_id', 'claudio')->first();
            abort_unless($ownedSession, 404);
            $rule = DB::table('agent_training_rules')->where('agent_id', 'claudio')->where('category', $pending->category)->lockForUpdate()->first();
            $version = $rule ? $rule->version + 1 : 1;
            // Las nuevas enseñanzas se acumulan por defecto; reemplazar requiere propuesta explícita y aprobación.
            $content = $rule && $pending->operation !== 'replace'
                ? trim($rule->content."\n".$pending->content)
                : $pending->content;
            if ($rule) {
                DB::table('agent_training_rules')->where('id', $rule->id)->update([
                    'title' => $pending->title, 'content' => $content, 'version' => $version, 'is_active' => true, 'updated_at' => now(),
                ]);
                $ruleId = $rule->id;
            } else {
                $ruleId = DB::table('agent_training_rules')->insertGetId([
                    'agent_id' => 'claudio', 'category' => $pending->category, 'title' => $pending->title,
                    'content' => $content, 'version' => 1, 'is_active' => true,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('agent_training_versions')->insert([
                'rule_id' => $ruleId, 'version' => $version, 'title' => $pending->title,
                'content' => $content, 'proposal_id' => $proposal,
                'approved_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('agent_training_proposals')->where('id', $proposal)->update([
                'status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'updated_at' => now(),
            ]);
        });
        return response()->json(['message' => 'Instrucción aprobada y aplicada a las siguientes respuestas.']);
    }

    public function reject(Request $request, int $proposal): JsonResponse
    {
        $changed = DB::table('agent_training_proposals')->where('id', $proposal)->where('status', 'pending')->update([
            'status' => 'rejected', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
        abort_unless($changed, 409, 'Esta propuesta ya fue revisada.');
        return response()->json(['message' => 'Propuesta rechazada.']);
    }

    public function versions(int $rule): JsonResponse
    {
        abort_unless(DB::table('agent_training_rules')->where('id', $rule)->where('agent_id', 'claudio')->exists(), 404);
        return response()->json(['data' => DB::table('agent_training_versions')->where('rule_id', $rule)->orderByDesc('version')->get()]);
    }

    public function rollback(Request $request, int $rule): JsonResponse
    {
        $data = $request->validate(['version_id' => ['required', 'integer']]);
        DB::transaction(function () use ($request, $rule, $data): void {
            $active = DB::table('agent_training_rules')->where('id', $rule)->where('agent_id', 'claudio')->lockForUpdate()->first();
            abort_unless($active, 404);
            $old = DB::table('agent_training_versions')->where('id', $data['version_id'])->where('rule_id', $rule)->first();
            abort_unless($old, 404);
            $version = $active->version + 1;
            DB::table('agent_training_rules')->where('id', $rule)->update([
                'title' => $old->title, 'content' => $old->content, 'version' => $version, 'is_active' => true, 'updated_at' => now(),
            ]);
            DB::table('agent_training_versions')->insert([
                'rule_id' => $rule, 'version' => $version, 'title' => $old->title, 'content' => $old->content,
                'approved_by' => $request->user()->id, 'restored_from_version_id' => $old->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        });
        return response()->json(['message' => 'Versión restaurada y registrada.']);
    }

    private function owned(Request $request, int $session): void
    {
        abort_unless(DB::table('agent_training_sessions')->where('id', $session)
            ->where('user_id', $request->user()->id)->where('agent_id', 'claudio')->exists(), 404, 'Sesión de entrenamiento no encontrada.');
    }
}
