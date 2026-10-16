<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Deployment;
use App\Services\DeploymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Throwable;

class DeploymentController extends Controller
{
    public function index(DeploymentService $service): JsonResponse
    {
        $deployments = Deployment::query()
            ->with('requester:id,name,email')
            ->latest('id')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $deployments,
            'configuration' => $service->publicConfiguration(),
        ]);
    }

    public function cancel(Deployment $deployment, DeploymentService $service): JsonResponse
    {
        if (! in_array($deployment->status, ['queued', 'running', 'cancelling'], true)) {
            return response()->json(['message' => 'Este despliegue ya finalizó.'], 409);
        }

        if ($deployment->status === 'queued') {
            $deployment->update([
                'status' => 'cancelled',
                'finished_at' => now(),
                'failure_message' => 'Cancelado por un administrador.',
            ]);
        } else {
            $service->requestCancellation();
            $deployment->update(['status' => 'cancelling']);
        }

        return response()->json(['data' => $deployment->fresh()]);
    }

    public function destroy(Deployment $deployment): JsonResponse
    {
        if (in_array($deployment->status, ['queued', 'running', 'cancelling'], true)) {
            return response()->json(['message' => 'Cancela y espera a que finalice antes de eliminar.'], 409);
        }

        $deployment->delete();

        return response()->json(['message' => 'Registro eliminado.']);
    }

    public function store(Request $request, DeploymentService $service): JsonResponse
    {
        $data = $request->validate([
            'initialize_private_repo' => ['sometimes', 'boolean'],
        ]);

        $configuration = $service->publicConfiguration();

        if (! $configuration['enabled']) {
            return response()->json(['message' => 'El autodespliegue está deshabilitado en este servidor.'], 503);
        }

        if (! $configuration['ready']) {
            return response()->json(['message' => 'El script de autodespliegue no está configurado o no existe.'], 422);
        }

        if (Deployment::query()->whereIn('status', ['queued', 'running', 'cancelling'])->exists()) {
            return response()->json(['message' => 'Ya existe un despliegue en ejecución.'], 409);
        }

        $deployment = Deployment::query()->create([
            'status' => 'queued',
            'requested_by' => Auth::id(),
            'initialize_private_repo' => (bool) ($data['initialize_private_repo'] ?? false),
        ]);

        try {
            $service->launch($deployment);
        } catch (Throwable $exception) {
            report($exception);
            $deployment->update([
                'status' => 'failed',
                'finished_at' => now(),
                'failure_message' => 'No fue posible iniciar el despliegue.',
            ]);

            return response()->json(['message' => 'No fue posible iniciar el despliegue.'], 503);
        }

        return response()->json(['data' => $deployment->fresh('requester:id,name,email')], 202);
    }
}
