<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PageBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InstitutionalContentController extends Controller
{
    private const FIELDS = [
        'bar_text', 'hero_kicker', 'hero_title', 'hero_description',
        'mission_kicker', 'mission_title', 'mission_description',
        'vision_kicker', 'vision_title', 'vision_description',
        'values_kicker', 'values_title', 'values_description',
        'safety_title', 'safety_description',
        'responsibility_title', 'responsibility_description',
        'teamwork_title', 'teamwork_description',
        'trust_title', 'trust_description',
        'cta_title', 'cta_description', 'cta_products', 'cta_advice',
    ];

    private function block(): PageBlock
    {
        return PageBlock::query()
            ->where('page_key', 'somos-gaspronal')
            ->where('block_key', 'institutional')
            ->firstOrFail();
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->block()->content,
            'meta' => ['can_manage' => (bool) $request->user()?->can('institutional.manage')],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $rules = ['content' => ['required', 'array']];
        foreach (self::FIELDS as $field) {
            $rules['content.' . $field] = ['present', 'nullable', 'string', 'max:5000'];
        }

        $validated = $request->validate($rules);
        $content = [];
        foreach (self::FIELDS as $field) {
            $content[$field] = (string) ($validated['content'][$field] ?? '');
        }

        $block = $this->block();
        $block->update(['content' => $content]);

        return response()->json(['data' => $block->fresh()->content]);
    }
}
