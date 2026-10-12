<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AgentResearchRun;
use App\Models\CatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class JorgeResearchController extends Controller
{
    public function show(): JsonResponse
    {
        $run = AgentResearchRun::query()->firstOrCreate(
            ['agent_id' => 'jorge'],
            ['status' => 'idle', 'total_items' => CatalogItem::query()->where('type', 'product')->count()]
        );

        $run->refresh();
        $run->load('currentItem:id,name,reference,legacy_research_status');

        return response()->json([
            'data' => [
                'run' => $run,
                'pending_items' => CatalogItem::query()->where('type', 'product')->where('legacy_research_status', 'pending')->count(),
                'completed_items' => CatalogItem::query()->where('type', 'product')->where('legacy_research_status', 'completed')->count(),
            ],
        ]);
    }

    public function play(): JsonResponse
    {
        CatalogItem::query()
            ->where('type', 'product')
            ->where('legacy_research_status', 'processing')
            ->update(['legacy_research_status' => 'pending']);

        $run = AgentResearchRun::query()->firstOrCreate(['agent_id' => 'jorge']);

        $run->update([
            'status' => 'running',
            'total_items' => CatalogItem::query()->where('type', 'product')->count(),
            'processed_items' => CatalogItem::query()->where('type', 'product')->whereIn('legacy_research_status', ['completed', 'failed'])->count(),
            'successful_items' => CatalogItem::query()->where('type', 'product')->where('legacy_research_status', 'completed')->count(),
            'failed_items' => CatalogItem::query()->where('type', 'product')->where('legacy_research_status', 'failed')->count(),
            'started_at' => $run->started_at ?? now(),
            'finished_at' => null,
            'last_error' => null,
        ]);

        return $this->show();
    }

    public function pause(): JsonResponse
    {
        AgentResearchRun::query()->updateOrCreate(
            ['agent_id' => 'jorge'],
            ['status' => 'paused', 'last_heartbeat_at' => now()]
        );

        return $this->show();
    }

    public function stop(): JsonResponse
    {
        AgentResearchRun::query()->updateOrCreate(
            ['agent_id' => 'jorge'],
            [
                'status' => 'stopped',
                'current_catalog_item_id' => null,
                'finished_at' => now(),
                'last_heartbeat_at' => now(),
            ]
        );

        return $this->show();
    }
    /**
     * Reinicia solo las imágenes del catálogo y la investigación de Jorge.
     * No toca categorías, servicios, fichas técnicas ni SEO.
     */
    public function resetProductImages(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasRole('root'), 403, 'Operación exclusiva para root.');

        $validated = $request->validate([
            'confirmation' => ['required', 'in:BORRAR FOTOS'],
        ]);

        $total = DB::transaction(function (): int {
            $run = AgentResearchRun::query()->firstOrCreate(['agent_id' => 'jorge']);
            $run->update(['status' => 'stopped', 'current_catalog_item_id' => null]);

            $total = CatalogItem::query()->where('type', 'product')->count();
            CatalogItem::query()->where('type', 'product')->update([
                'gallery' => null,
                'og_image' => null,
                'legacy_research_status' => 'pending',
                'legacy_research_error' => null,
                'legacy_researched_at' => null,
            ]);

            $run->update([
                'status' => 'running',
                'total_items' => $total,
                'processed_items' => 0,
                'successful_items' => 0,
                'failed_items' => 0,
                'current_catalog_item_id' => null,
                'last_error' => null,
                'started_at' => now(),
                'finished_at' => null,
                'last_heartbeat_at' => now(),
            ]);

            return $total;
        });

        return response()->json([
            'ok' => true,
            'message' => 'Galerías desvinculadas y Jorge reiniciado. La tarea programada recuperará las fotografías originales.',
            'processed_items' => 0,
            'total_items' => $total,
            'instruction' => 'Recorrer los productos pendientes por ID y recuperar exclusivamente imágenes originales de sus fichas en https://www.gaspronal.com/2019/productos. No inventar imágenes ni utilizar IA generativa.',
        ]);
    }

}
