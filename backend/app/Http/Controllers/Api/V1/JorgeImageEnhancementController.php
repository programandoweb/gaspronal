<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AgentImageEnhancementJob;
use App\Models\AgentImageEnhancementRun;
use App\Models\CatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class JorgeImageEnhancementController extends Controller
{
    public function show(): JsonResponse
    {
        $run = $this->run();
        $run->refresh()->load('currentItem:id,name,reference');

        $auto = AgentImageEnhancementJob::query()->where('run_id', $run->id)->where('mode', 'auto');

        return response()->json([
            'data' => [
                'run' => $run,
                'pending_items' => (clone $auto)->where('status', 'pending')->count(),
                'completed_items' => (clone $auto)->where('status', 'completed')->count(),
                'failed_items' => (clone $auto)->where('status', 'failed')->count(),
                'recent_results' => AgentImageEnhancementJob::query()
                    ->where('run_id', $run->id)
                    ->with('catalogItem:id,name,reference')
                    ->whereIn('status', ['completed', 'failed'])
                    ->latest('id')
                    ->limit(10)
                    ->get(),
            ],
        ]);
    }

    public function play(): JsonResponse
    {
        $run = $this->run();
        $batch = $run->batch_uuid ?: (string) Str::uuid();

        CatalogItem::query()
            ->where('type', 'product')
            ->select(['id'])
            ->orderBy('id')
            ->chunkById(200, function ($items) use ($run, $batch): void {
                foreach ($items as $item) {
                    AgentImageEnhancementJob::query()->firstOrCreate(
                        ['idempotency_key' => "auto:{$item->id}"],
                        [
                            'run_id' => $run->id,
                            'catalog_item_id' => $item->id,
                            'batch_uuid' => $batch,
                            'mode' => 'auto',
                            'status' => 'pending',
                        ],
                    );
                }
            });

        AgentImageEnhancementJob::query()
            ->where('run_id', $run->id)
            ->where('mode', 'auto')
            ->where('status', 'processing')
            ->update(['status' => 'pending']);

        AgentImageEnhancementJob::query()
            ->where('run_id', $run->id)
            ->where('mode', 'auto')
            ->where('status', 'failed')
            ->update(['status' => 'pending', 'error' => null, 'finished_at' => null]);

        $pending = AgentImageEnhancementJob::query()
            ->where('run_id', $run->id)
            ->where('status', 'pending')
            ->exists();

        $run->update([
            'batch_uuid' => $batch,
            'status' => $pending ? 'running' : 'completed',
            'total_items' => AgentImageEnhancementJob::query()->where('run_id', $run->id)->where('mode', 'auto')->count(),
            'processed_items' => AgentImageEnhancementJob::query()->where('run_id', $run->id)->where('mode', 'auto')->whereIn('status', ['completed', 'failed'])->count(),
            'successful_items' => AgentImageEnhancementJob::query()->where('run_id', $run->id)->where('mode', 'auto')->where('status', 'completed')->count(),
            'failed_items' => AgentImageEnhancementJob::query()->where('run_id', $run->id)->where('mode', 'auto')->where('status', 'failed')->count(),
            'started_at' => $run->started_at ?? now(),
            'finished_at' => $pending ? null : now(),
            'last_error' => null,
            'last_heartbeat_at' => now(),
        ]);

        return $this->show();
    }

    public function pause(): JsonResponse
    {
        $this->run()->update(['status' => 'paused', 'last_heartbeat_at' => now()]);
        return $this->show();
    }

    public function stop(): JsonResponse
    {
        $this->run()->update([
            'status' => 'stopped',
            'current_catalog_item_id' => null,
            'finished_at' => now(),
            'last_heartbeat_at' => now(),
        ]);

        return $this->show();
    }

    public function regenerate(CatalogItem $catalogItem): JsonResponse
    {
        abort_unless($catalogItem->type === 'product', 422, 'Solo se pueden regenerar imágenes de productos.');

        $run = $this->run();
        $batch = $run->batch_uuid ?: (string) Str::uuid();

        AgentImageEnhancementJob::query()->create([
            'run_id' => $run->id,
            'catalog_item_id' => $catalogItem->id,
            'batch_uuid' => $batch,
            'idempotency_key' => "manual:{$catalogItem->id}:".Str::uuid(),
            'mode' => 'manual',
            'status' => 'pending',
        ]);

        $run->update([
            'batch_uuid' => $batch,
            'status' => 'running',
            'current_catalog_item_id' => null,
            'finished_at' => null,
            'last_error' => null,
            'started_at' => $run->started_at ?? now(),
            'last_heartbeat_at' => now(),
        ]);

        return $this->show();
    }

    private function run(): AgentImageEnhancementRun
    {
        return AgentImageEnhancementRun::query()->firstOrCreate(
            ['agent_id' => 'leonardo'],
            [
                'status' => 'idle',
                'total_items' => CatalogItem::query()->where('type', 'product')->count(),
            ],
        );
    }
}
