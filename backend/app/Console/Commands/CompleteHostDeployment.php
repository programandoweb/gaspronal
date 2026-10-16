<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use Illuminate\Console\Command;

class CompleteHostDeployment extends Command
{
    protected $signature = 'deployment:host-status {deployment} {status} {--output-file=}';
    protected $description = 'Actualiza el estado de una ejecución iniciada en el VPS.';

    public function handle(): int
    {
        $deployment = Deployment::findOrFail((int) $this->argument('deployment'));
        $status = (string) $this->argument('status');
        if (! in_array($status, ['running', 'succeeded', 'failed', 'cancelled'], true)) {
            return self::FAILURE;
        }

        if ($status === 'running') {
            if ($deployment->status !== 'queued') return self::FAILURE;
            $deployment->update(['status' => 'running', 'started_at' => now()]);
            return self::SUCCESS;
        }

        if (! in_array($deployment->status, ['running', 'cancelling'], true)) {
            return self::FAILURE;
        }

        $path = $this->option('output-file');
        $output = is_string($path) && is_file($path) ? mb_substr((string) file_get_contents($path), -100000) : '';
        $deployment->update([
            'status' => $status,
            'finished_at' => now(),
            'output' => $output,
            'exit_code' => $status === 'succeeded' ? 0 : ($status === 'cancelled' ? 130 : 1),
            'failure_message' => $status === 'failed' ? 'El despliegue del VPS terminó con errores.' : ($status === 'cancelled' ? 'Cancelado por un administrador.' : null),
        ]);
        return self::SUCCESS;
    }
}
