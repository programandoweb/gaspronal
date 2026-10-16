<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use App\Services\DeploymentService;
use Illuminate\Console\Command;
use Throwable;

class RunDeployment extends Command
{
    protected $signature = 'deployment:run {deployment}';
    protected $description = 'Ejecuta un despliegue solicitado desde el dashboard.';

    public function handle(DeploymentService $service): int
    {
        $deployment = Deployment::query()->findOrFail((int) $this->argument('deployment'));

        try {
            $service->run($deployment);
            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);

            $deployment->refresh();
            $cancelled = $deployment->status === 'cancelling';
            $deployment->update([
                'status' => $cancelled ? 'cancelled' : 'failed',
                'finished_at' => now(),
                'failure_message' => $cancelled ? 'Cancelado por un administrador.' : 'No fue posible completar el despliegue.',
                'output' => mb_substr($exception->getMessage(), 0, 100000),
            ]);

            return self::FAILURE;
        }
    }
}
