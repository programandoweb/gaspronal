<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $old = DB::table('agent_image_enhancement_runs')->where('agent_id', 'jorge')->lockForUpdate()->first();
            $new = DB::table('agent_image_enhancement_runs')->where('agent_id', 'leonardo')->lockForUpdate()->first();

            if ($old && ! $new) {
                DB::table('agent_image_enhancement_runs')->where('id', $old->id)->update([
                    'agent_id' => 'leonardo', 'status' => 'paused', 'updated_at' => now(),
                ]);
                DB::table('agent_image_enhancement_jobs')->where('run_id', $old->id)
                    ->where('status', 'processing')->update(['status' => 'pending', 'updated_at' => now()]);
            } elseif ($old && $new) {
                // Conservar IDs y progreso; todas las claves de idempotencia son globalmente únicas.
                DB::table('agent_image_enhancement_jobs')->where('run_id', $old->id)
                    ->update(['run_id' => $new->id, 'updated_at' => now()]);
                DB::table('agent_image_enhancement_jobs')->where('run_id', $new->id)
                    ->where('status', 'processing')->update(['status' => 'pending', 'updated_at' => now()]);
                DB::table('agent_image_enhancement_runs')->where('id', $new->id)
                    ->update(['status' => 'paused', 'updated_at' => now()]);
                DB::table('agent_image_enhancement_runs')->where('id', $old->id)->delete();
            }
        });
    }

    public function down(): void
    {
        // No reasignar ejecuciones: el historial fotográfico pertenece a Leonardo.
    }
};
