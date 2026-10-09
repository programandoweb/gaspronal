<?php

namespace App\Console\Commands;

use App\Models\LeonardoServiceImageJob;
use App\Services\LeonardoServiceImageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class LeonardoGenerateServiceImage extends Command
{
    protected $signature = 'agent:leonardo:service-image-next';
    protected $description = 'Genera la siguiente imagen de servicios Gaspro CMS.';

    public function handle(LeonardoServiceImageService $service): int
    {
        $job = DB::transaction(function () {
            $job = LeonardoServiceImageJob::where('status','pending')->orderBy('id')->lockForUpdate()->first();
            if ($job) $job->update(['status'=>'processing','attempts'=>$job->attempts+1,'started_at'=>now()]);
            return $job;
        });
        if (!$job) return self::SUCCESS;
        try {
            $result = $service->generateFor($job->post()->with('category')->firstOrFail(), $job->variant);
            $job->update([...$result,'status'=>'completed','finished_at'=>now(),'error'=>null]);
            $this->info("Imagen {$job->id} generada correctamente.");
        } catch (Throwable $error) {
            report($error);
            $job->update(['status'=>'failed','finished_at'=>now(),'error'=>mb_substr($error->getMessage(),0,2000)]);
            $this->error("Error en imagen {$job->id}: {$error->getMessage()}");
        }
        return self::SUCCESS;
    }
}
