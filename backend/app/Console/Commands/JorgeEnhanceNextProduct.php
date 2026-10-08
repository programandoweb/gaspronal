<?php

namespace App\Console\Commands;

use App\Models\AgentImageEnhancementJob;
use App\Models\AgentImageEnhancementRun;
use App\Services\JorgeImageEnhancementService;
use Illuminate\Console\Command;
use Throwable;

class JorgeEnhanceNextProduct extends Command
{
    protected $signature = 'agent:leonardo:enhance-next';
    protected $description = 'Mejora la imagen del siguiente producto pendiente de Leonardo mediante Gemini API.';

    public function handle(JorgeImageEnhancementService $service): int
    {
        $run = AgentImageEnhancementRun::query()->where('agent_id', 'leonardo')->first();
        if (! $run || $run->status !== 'running') {
            return self::SUCCESS;
        }

        $job = AgentImageEnhancementJob::query()
            ->where('run_id', $run->id)
            ->where('status', 'pending')
            ->with('catalogItem:id,name,reference,type')
            ->orderBy('catalog_item_id')
            ->orderBy('id')
            ->first();

        if (! $job) {
            $this->refreshRun($run, true);
            return self::SUCCESS;
        }

        $run->update([
            'current_catalog_item_id' => $job->catalog_item_id,
            'last_heartbeat_at' => now(),
        ]);

        $job->update([
            'status' => 'processing',
            'attempts' => $job->attempts + 1,
            'started_at' => now(),
            'finished_at' => null,
            'error' => null,
        ]);

        try {
            $result = $service->enhance($job);
            $job->update([
                ...$result,
                'status' => 'completed',
                'finished_at' => now(),
                'error' => null,
            ]);
            $this->info("Producto {$job->catalog_item_id} mejorado correctamente.");
        } catch (Throwable $exception) {
            report($exception);
            $message = mb_substr($exception->getMessage(), 0, 5000);
            $job->update([
                'status' => 'failed',
                'finished_at' => now(),
                'error' => $message,
            ]);
            $run->update(['last_error' => $message]);
            $this->error("Producto {$job->catalog_item_id}: {$message}");
        }

        $this->refreshRun($run);

        return self::SUCCESS;
    }

    private function refreshRun(AgentImageEnhancementRun $run, bool $finishWhenEmpty = false): void
    {
        $auto = AgentImageEnhancementJob::query()->where('run_id', $run->id)->where('mode', 'auto');

        $payload = [
            'current_catalog_item_id' => null,
            'last_heartbeat_at' => now(),
            'total_items' => (clone $auto)->count(),
            'processed_items' => (clone $auto)->whereIn('status', ['completed', 'failed'])->count(),
            'successful_items' => (clone $auto)->where('status', 'completed')->count(),
            'failed_items' => (clone $auto)->where('status', 'failed')->count(),
        ];

        if ($finishWhenEmpty && ! AgentImageEnhancementJob::query()->where('run_id', $run->id)->whereIn('status', ['pending', 'processing'])->exists()) {
            $payload['status'] = 'completed';
            $payload['finished_at'] = now();
        }

        $run->update($payload);
    }
}
