<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PageBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PageBlockController extends Controller {
    public function publicIndex(Request $request): JsonResponse {
        $page = $request->validate(['page' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9._-]+$/']])['page'];
        return response()->json(['data' => PageBlock::query()->where('page_key', $page)->where('is_active', true)->orderBy('sort_order')->get()]);
    }

    public function index(Request $request): JsonResponse {
        return response()->json([
            'data' => PageBlock::query()->orderBy('page_key')->orderBy('sort_order')->orderBy('id')->get(),
            'meta' => ['can_manage' => (bool) $request->user()?->can('heroes.manage')],
        ]);
    }

    public function store(Request $request): JsonResponse {
        $data = $this->validateBlock($request);
        return response()->json(['data' => PageBlock::create($data)], 201);
    }

    public function update(Request $request, PageBlock $pageBlock): JsonResponse {
        $data = $this->validateBlock($request, $pageBlock);
        $pageBlock->update($data);
        return response()->json(['data' => $pageBlock->fresh()]);
    }

    public function destroy(PageBlock $pageBlock): JsonResponse {
        $pageBlock->delete();
        return response()->json(['ok' => true]);
    }

    private function validateBlock(Request $request, ?PageBlock $block = null): array {
        return $request->validate([
            'page_key' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9._-]+$/'],
            'block_key' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9._-]+$/',
                Rule::unique('page_blocks')->where(fn ($q) => $q->where('page_key', $request->input('page_key')))->ignore($block?->id)],
            'label' => ['required', 'string', 'max:160'],
            'content' => ['required', 'array', 'max:30'],
            'content.*' => ['nullable'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:9999'],
        ]);
    }
}
