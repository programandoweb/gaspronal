<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ClaudioTrainingTest extends TestCase
{
    use RefreshDatabase;

    private function trainer(bool $approver = false): User
    {
        Permission::findOrCreate('agents.train', 'api');
        Permission::findOrCreate('agents.training.approve', 'api');

        $user = User::factory()->create();
        $user->givePermissionTo('agents.train');
        if ($approver) {
            $user->givePermissionTo('agents.training.approve');
        }
        return $user;
    }

    private function proposal(int $session, string $content, string $operation = 'append'): int
    {
        return DB::table('agent_training_proposals')->insertGetId([
            'session_id' => $session,
            'category' => 'greetings',
            'title' => 'Saludos naturales',
            'content' => $content,
            'operation' => $operation,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_training_session_is_private(): void
    {
        $alice = $this->trainer();
        $bob = $this->trainer();
        $this->actingAs($alice, 'api');
        $session = $this->postJson('/api/v1/agents/claudio/training/sessions')->assertOk()->json('data.id');

        $this->actingAs($bob, 'api');
        $this->getJson("/api/v1/agents/claudio/training/sessions/{$session}")->assertNotFound();
    }

    public function test_approval_is_required_and_new_learning_is_appended(): void
    {
        $user = $this->trainer(true);
        $this->actingAs($user, 'api');
        $session = $this->postJson('/api/v1/agents/claudio/training/sessions')->assertOk()->json('data.id');
        $first = $this->proposal($session, 'Saluda de manera cercana.');
        $this->assertDatabaseCount('agent_training_rules', 0);

        $this->postJson("/api/v1/agents/claudio/training/proposals/{$first}/approve")->assertOk();
        $this->postJson("/api/v1/agents/claudio/training/proposals/{$first}/approve")->assertStatus(409);

        $second = $this->proposal($session, 'Haz una sola pregunta por turno.');
        $this->postJson("/api/v1/agents/claudio/training/proposals/{$second}/approve")->assertOk();

        $rule = DB::table('agent_training_rules')->where('category', 'greetings')->first();
        $this->assertSame(2, $rule->version);
        $this->assertStringContainsString('Saluda de manera cercana.', $rule->content);
        $this->assertStringContainsString('Haz una sola pregunta por turno.', $rule->content);
        $this->assertSame(2, DB::table('agent_training_versions')->where('rule_id', $rule->id)->count());
    }

    public function test_rollback_creates_an_auditable_new_version(): void
    {
        $user = $this->trainer(true);
        $this->actingAs($user, 'api');
        $session = $this->postJson('/api/v1/agents/claudio/training/sessions')->assertOk()->json('data.id');
        $first = $this->proposal($session, 'Saluda de manera cercana.');
        $this->postJson("/api/v1/agents/claudio/training/proposals/{$first}/approve")->assertOk();

        $second = $this->proposal($session, 'Usa listas extensas.', 'replace');
        $this->postJson("/api/v1/agents/claudio/training/proposals/{$second}/approve")->assertOk();
        $rule = DB::table('agent_training_rules')->where('category', 'greetings')->first();
        $old = DB::table('agent_training_versions')->where('rule_id', $rule->id)->where('version', 1)->first();

        $this->postJson("/api/v1/agents/claudio/training/rules/{$rule->id}/rollback", [
            'version_id' => $old->id,
        ])->assertOk();

        $restored = DB::table('agent_training_rules')->where('id', $rule->id)->first();
        $this->assertSame(3, $restored->version);
        $this->assertSame('Saluda de manera cercana.', $restored->content);
        $this->assertSame(3, DB::table('agent_training_versions')->where('rule_id', $rule->id)->count());
    }

    public function test_trainer_without_approval_permission_cannot_activate_proposals(): void
    {
        $user = $this->trainer();
        $this->actingAs($user, 'api');
        $session = $this->postJson('/api/v1/agents/claudio/training/sessions')->assertOk()->json('data.id');
        $proposal = $this->proposal($session, 'Sé cordial.');
        $this->postJson("/api/v1/agents/claudio/training/proposals/{$proposal}/approve")->assertForbidden();
        $this->assertDatabaseCount('agent_training_rules', 0);
    }
}
