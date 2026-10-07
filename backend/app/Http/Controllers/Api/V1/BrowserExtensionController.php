<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BrowserExtension;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BrowserExtensionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 25), 10), 100);

        return response()->json(
            BrowserExtension::query()
                ->orderByDesc('enabled')
                ->orderBy('name')
                ->paginate($perPage)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'installation_id' => ['required', 'uuid', 'unique:browser_extensions,installation_id'],
            'name' => ['required', 'string', 'max:120'],
            'type' => ['nullable', Rule::in(['whatsapp_web'])],
            'version' => ['nullable', 'string', 'max:40'],
            'machine_name' => ['nullable', 'string', 'max:120'],
            'whatsapp_number' => ['nullable', 'string', 'max:32'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);

        $extension = BrowserExtension::query()->create([
            ...$data,
            'type' => $data['type'] ?? 'whatsapp_web',
            'enabled' => $data['enabled'] ?? true,
            'last_seen_at' => now(),
        ]);

        return response()->json(['data' => $extension], 201);
    }

    public function update(Request $request, BrowserExtension $browserExtension): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'version' => ['nullable', 'string', 'max:40'],
            'machine_name' => ['nullable', 'string', 'max:120'],
            'whatsapp_number' => ['nullable', 'string', 'max:32'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
            'last_seen_at' => ['nullable', 'date'],
        ]);

        $browserExtension->fill($data)->save();

        return response()->json(['data' => $browserExtension->fresh()]);
    }

    public function destroy(BrowserExtension $browserExtension): JsonResponse
    {
        $browserExtension->delete();

        return response()->json([], 204);
    }
}
