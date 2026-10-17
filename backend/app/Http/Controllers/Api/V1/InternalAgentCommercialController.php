<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CatalogItem;
use App\Models\CommercialAppointment;
use App\Models\CommercialLead;
use App\Models\CommercialQuote;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\CommunicationConversation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InternalAgentCommercialController extends Controller
{
    public function execute(Request $request, string $agent): JsonResponse
    {
        $this->authorizeAgent($request);
        abort_unless(strtolower($agent) === 'claudio', 404, 'Herramientas comerciales no disponibles para este agente.');

        $payload = $request->validate([
            'tool' => ['required', 'string'],
            'arguments' => ['nullable', 'array'],
        ]);

        $arguments = $payload['arguments'] ?? [];

        $webChannel = ($arguments['agent_channel'] ?? null) === 'web';
        if ($webChannel && in_array($payload['tool'], ['create_appointment', 'handoff_to_human', 'register_customer', 'create_quote'], true)) {
            $this->requireWebConsent($arguments);
        }

        return match ($payload['tool']) {
            'catalog_search' => $this->catalogSearch($arguments),
            'create_quote' => $this->createQuote($arguments),
            'create_appointment' => $this->createAppointment($arguments),
            'handoff_to_human' => $this->handoff($arguments),
            'register_customer' => $this->registerCustomer($arguments),
            default => abort(422, 'Herramienta comercial no reconocida.'),
        };
    }

    private function catalogSearch(array $arguments): JsonResponse
    {
        $query = trim((string) ($arguments['query'] ?? ''));

        // Search plural/singular variants and relevant words, including category slugs.
        // Only published catalog entries are exposed to the commercial agent.
        $normalized = mb_strtolower($query);
        $terms = preg_split('/\\s+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $stopWords = ['de', 'del', 'la', 'las', 'el', 'los', 'en', 'para', 'por', 'con', 'un', 'una', 'y', 'que', 'tienen', 'tiene', 'busco', 'quiero', 'necesito'];
        $terms = array_values(array_filter($terms, fn ($term) => mb_strlen($term) >= 4 && ! in_array($term, $stopWords, true)));
        $variants = [$normalized];
        foreach ($terms as $term) {
            $variants[] = $term;
            if (str_ends_with($term, 'es') && mb_strlen($term) > 5) {
                $variants[] = mb_substr($term, 0, -2);
            } elseif (str_ends_with($term, 's') && mb_strlen($term) > 4) {
                $variants[] = mb_substr($term, 0, -1);
            }
        }
        $variants = array_values(array_unique(array_filter($variants)));

        $items = CatalogItem::query()
            ->with('category:id,name,slug')
            ->where('status', 'published')
            ->when($query !== '', function ($builder) use ($variants) {
                $builder->where(function ($matches) use ($variants) {
                    foreach ($variants as $variant) {
                        $pattern = '%'.addcslashes($variant, '%_\\\\').'%';
                        $matches->orWhere('name', 'like', $pattern)
                            ->orWhere('reference', 'like', $pattern)
                            ->orWhere('short_description', 'like', $pattern)
                            ->orWhere('description', 'like', $pattern)
                            ->orWhere('applications', 'like', $pattern)
                            ->orWhere('specifications', 'like', $pattern)
                            ->orWhereHas('category', fn ($category) => $category
                                ->where('name', 'like', $pattern)
                                ->orWhere('slug', 'like', $pattern));
                    }
                });
            })
            ->orderBy('name')
            ->limit(10)
            ->get([
                'id', 'category_id', 'type', 'name', 'reference', 'slug',
                'short_description', 'description', 'specifications', 'applications',
            ])
            ->map(function (CatalogItem $item): array {
                $images = $this->publicImageUrls($item);
                $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

                return [
                    'id' => $item->id,
                    'type' => $item->type,
                    'name' => $item->name,
                    'reference' => $item->reference,
                    'category' => $item->category ? [
                        'name' => $item->category->name,
                        'slug' => $item->category->slug,
                    ] : null,
                    'short_description' => $item->short_description,
                    'description' => $item->description,
                    'specifications' => $item->specifications,
                    'applications' => $item->applications,
                    'product_url' => $frontendUrl.($item->type === 'service' ? $item->public_url : '/productos/'.$item->slug),
                    'legacy_url' => $item->legacy_source_url ?: $item->public_url,
                    'image_urls' => $images,
                    'has_images' => $images !== [],
                ];
            });

        return response()->json(['data' => $items]);
    }

    /** @return array<int, string> */
    private function publicImageUrls(CatalogItem $item): array
    {
        $backendUrl = rtrim((string) config('app.public_backend_url'), '/');

        return collect([$item->og_image, ...($item->gallery ?? [])])
            ->filter(fn ($url) => is_string($url) && trim($url) !== '')
            ->map(function (string $url) use ($backendUrl): string {
                $url = trim($url);

                return str_starts_with($url, '/') ? $backendUrl.$url : $url;
            })
            ->unique()
            ->values()
            ->all();
    }

    private function createQuote(array $arguments): JsonResponse
    {
        $data = validator($arguments, [
            'name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:190'],
            'whatsapp' => ['required', 'string', 'max:40'],
            'customer_confirmed' => ['required', 'accepted'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.catalog_item_id' => ['nullable', 'integer', 'exists:catalog_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ])->validate();

        $quote = DB::transaction(function () use ($data): CommercialQuote {
            $lead = CommercialLead::query()->firstOrCreate(
                ['email' => mb_strtolower(trim($data['email'])), 'whatsapp' => trim($data['whatsapp'])],
                ['name' => trim($data['name']), 'source' => 'claudio']
            );
            $lead->update(['name' => trim($data['name']), 'status' => 'pending_quote_approval']);
            $quote = CommercialQuote::create([
                'lead_id' => $lead->id,
                'number' => 'CLA-'.now()->format('Ymd').'-'.strtoupper(Str::random(8)),
                'status' => 'pending_approval',
                'currency' => 'COP',
                'subtotal' => 0,
                'total' => 0,
                'notes' => $data['notes'] ?? null,
                'created_by_agent' => 'claudio',
            ]);
            $total = 0;
            foreach ($data['items'] as $item) {
                $catalogItem = ! empty($item['catalog_item_id'])
                    ? CatalogItem::query()->where('status', 'published')->find($item['catalog_item_id'])
                    : null;
                $unitPrice = $catalogItem && $catalogItem->commercial_price !== null
                    ? (float) $catalogItem->commercial_price
                    : 0.0;
                $lineTotal = round((float) $item['quantity'] * $unitPrice, 2);
                $total += $lineTotal;
                $quote->items()->create([
                    'catalog_item_id' => $item['catalog_item_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ]);
            }
            $quote->update(['subtotal' => $total, 'total' => $total]);
            return $quote;
        });
        return response()->json(['data' => $quote->load(['lead', 'items']), 'message' => 'Propuesta creada y pendiente de aprobación humana.'], 201);
    }

    private function createAppointment(array $arguments): JsonResponse
    {
        validator($arguments, [
            'name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:190'],
            'whatsapp' => ['required', 'string', 'max:40'],
            'scheduled_at' => ['required', 'date', 'after:now'],
            'channel' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ])->validate();

        $lead = CommercialLead::query()->firstOrCreate(
            ['email' => strtolower(trim($arguments['email'])), 'whatsapp' => trim($arguments['whatsapp'])],
            ['name' => trim($arguments['name']), 'source' => 'claudio']
        );
        $lead->update(['name' => trim($arguments['name']), 'status' => 'appointment_scheduled']);

        $appointment = CommercialAppointment::create([
            'lead_id' => $lead->id,
            'scheduled_at' => $arguments['scheduled_at'],
            'status' => 'scheduled',
            'channel' => $arguments['channel'] ?? 'commercial_call',
            'notes' => $arguments['notes'] ?? null,
            'created_by_agent' => 'claudio',
        ]);

        return response()->json(['data' => $appointment->load('lead')], 201);
    }

    private function registerCustomer(array $arguments): JsonResponse
    {
        validator($arguments, [
            'name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:190'],
            'whatsapp' => ['required', 'string', 'max:20', 'regex:/^\\+[1-9]\\d{7,14}$/'],
            'accepts_data_processing' => ['required', 'accepted'],
            'policy_version' => ['nullable', 'string', 'max:40'],
            'communication_conversation_id' => ['nullable', 'integer', 'exists:communication_conversations,id'],
        ])->validate();

        $email = mb_strtolower(trim((string) $arguments['email']));
        $whatsapp = trim((string) $arguments['whatsapp']);

        $emailUser = User::query()->where('email', $email)->first();
        $whatsappUser = User::query()->where('whatsapp', $whatsapp)->first();

        if ($emailUser && $whatsappUser && ! $emailUser->is($whatsappUser)) {
            abort(422, 'El correo y el WhatsApp pertenecen a clientes diferentes. Se requiere validación humana.');
        }

        $user = $emailUser ?? $whatsappUser ?? new User();

        if ($user->exists && $user->hasAnyRole(['root', 'admin'])) {
            abort(422, 'Los datos corresponden a un usuario interno de Gaspronal y no pueden registrarse como cliente desde el agente.');
        }

        $user->name = trim((string) $arguments['name']);
        $user->email = $email;
        $user->whatsapp = $whatsapp;
        $user->password = null;
        $user->data_processing_consent_at = now();
        $user->data_processing_consent_source = 'claudio';
        $user->data_processing_policy_version = trim((string) ($arguments['policy_version'] ?? '2026-10-05'));
        $user->save();

        if (! $user->hasRole('cliente')) {
            $user->assignRole('cliente');
        }

        if (! empty($arguments['communication_conversation_id'])) {
            CommunicationConversation::query()
                ->whereKey($arguments['communication_conversation_id'])
                ->where('agent_id', 'claudio')
                ->whereIn('channel', ['whatsapp', 'web'])
                ->update([
                    'user_id' => $user->id,
                    'contact_name' => $user->name,
                    'contact_phone' => $user->whatsapp,
                ]);
        }

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'whatsapp' => $user->whatsapp,
                'role' => 'cliente',
                'data_processing_consent_at' => $user->data_processing_consent_at?->toIso8601String(),
            ],
        ], $user->wasRecentlyCreated ? 201 : 200);
    }

    private function handoff(array $arguments): JsonResponse
    {
        validator($arguments, [
            'name' => ['required', 'string', 'max:190'],
            'email' => ['required', 'email', 'max:190'],
            'whatsapp' => ['required', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'communication_conversation_id' => ['nullable', 'integer', 'exists:communication_conversations,id'],
        ])->validate();

        $lead = CommercialLead::query()->firstOrCreate(
            ['email' => strtolower(trim($arguments['email'])), 'whatsapp' => trim($arguments['whatsapp'])],
            ['name' => trim($arguments['name']), 'source' => 'claudio']
        );
        $lead->update([
            'name' => trim($arguments['name']),
            'status' => 'awaiting_human',
            'notes' => $arguments['notes'] ?? $lead->notes,
            'human_followup_at' => now(),
        ]);

        if (! empty($arguments['communication_conversation_id'])) {
            CommunicationConversation::query()
                ->whereKey($arguments['communication_conversation_id'])
                ->where('agent_id', 'claudio')
                ->whereIn('channel', ['whatsapp', 'web'])
                ->update([
                    'status' => 'waiting_human',
                    'human_takeover_at' => now(),
                ]);
        }

        return response()->json(['data' => $lead]);
    }

    private function authorizeAgent(Request $request): void
    {
        $secret = trim((string) config('agents.shared_secret'));
        abort_if($secret === '' || ! hash_equals($secret, (string) $request->header('X-Agent-Shared-Secret', '')), 401, 'No autorizado.');
    }

    private function requireWebConsent(array $arguments): void
    {
        $conversationId = (int) ($arguments['communication_conversation_id'] ?? 0);
        $allowed = $conversationId > 0 && CommunicationConversation::query()
            ->whereKey($conversationId)
            ->where('agent_id', 'claudio')
            ->where('channel', 'web')
            ->whereNotNull('data_processing_consent_at')
            ->exists();
        abort_unless($allowed, 422, 'Antes de registrar datos o gestionar una solicitud comercial debe existir consentimiento explícito de tratamiento de datos.');
    }
}
