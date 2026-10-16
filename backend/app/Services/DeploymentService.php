<?php

namespace App\Services;

use App\Models\Deployment;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class DeploymentService
{
    public function publicConfiguration(): array
    {
        $script = trim((string) config('deployment.script', ''));

        return [
            'enabled' => (bool) config('deployment.enabled', false),
            'ready' => (bool) config('deployment.enabled', false)
                && $script !== ''
                && is_file($script),
            'script_name' => $script !== '' ? basename($script) : null,
        ];
    }

    private function cancellationMarker(): string
    {
        return dirname((string) config('deployment.script')).'/backend/bootstrap/cache/.deploy-cancel-request';
    }

    public function requestCancellation(): void
    {
        if (file_put_contents($this->cancellationMarker(), now()->toIso8601String()) === false) {
            throw new RuntimeException('No se pudo solicitar la cancelación.');
        }
    }

    public function launch(Deployment $deployment): void
    {
        @unlink($this->cancellationMarker());
        $php = trim((string) config('deployment.php_binary', 'php'));

        if ($php === '') {
            throw new RuntimeException('No hay un binario PHP configurado para iniciar el despliegue.');
        }

        $command = sprintf(
            'nohup %s %s deployment:run %d >/dev/null 2>&1 &',
            escapeshellarg($php),
            escapeshellarg(base_path('artisan')),
            $deployment->id,
        );

        $result = Process::path(base_path())->timeout(10)->run($command);

        if ($result->failed()) {
            throw new RuntimeException('No fue posible iniciar el proceso de despliegue.');
        }
    }

    public function run(Deployment $deployment): void
    {
        $script = trim((string) config('deployment.script', ''));

        if (! (bool) config('deployment.enabled', false) || $script === '' || ! is_file($script)) {
            throw new RuntimeException('El script de despliegue no está disponible.');
        }

        $deployment->refresh();
        if ($deployment->status !== 'queued') {
            return;
        }

        $deployment->update([
            'status' => 'running',
            'started_at' => now(),
            'failure_message' => null,
        ]);

        $timeout = max(60, (int) config('deployment.timeout', 1800));

        $marker = '/tmp/gaspronal-init-private-repo';

        if ($deployment->initialize_private_repo) {
            file_put_contents($marker, (string) $deployment->id);
        } else {
            @unlink($marker);
        }

        $command = (bool) config('deployment.use_sudo', false)
            ? 'sudo -n '.escapeshellarg((string) config('deployment.sudo_command', '/usr/local/bin/gaspronal-deploy'))
            : 'bash '.escapeshellarg($script);

        try {
            $result = Process::path(dirname($script))
                ->timeout($timeout)
                ->run($command);
        } finally {
            @unlink($marker);
        }

        $output = trim($result->output().PHP_EOL.$result->errorOutput());

        $deployment->refresh();
        $cancelled = $deployment->status === 'cancelling'
            || is_file($this->cancellationMarker())
            || $result->exitCode() === 130;

        $deployment->update([
            'status' => $cancelled ? 'cancelled' : ($result->successful() ? 'succeeded' : 'failed'),
            'finished_at' => now(),
            'exit_code' => $result->exitCode(),
            'output' => mb_substr($output, 0, 100000),
            'failure_message' => $cancelled ? 'Cancelado por un administrador.' : ($result->successful() ? null : 'El script de despliegue terminó con errores.'),
        ]);
        @unlink($this->cancellationMarker());
    }
}
