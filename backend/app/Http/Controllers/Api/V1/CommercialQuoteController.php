<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommercialQuote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

class CommercialQuoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            CommercialQuote::query()
                ->with(['lead:id,name,email,whatsapp,status', 'items'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->latest()
                ->paginate(min(max($request->integer('per_page', 25), 1), 100))
        );
    }

    public function show(CommercialQuote $commercialQuote): JsonResponse
    {
        $commercialQuote->load(['lead', 'items']);
        $data = $commercialQuote->toArray();
        if ($commercialQuote->status === 'approved') {
            $data['share_url'] = $this->shareUrl($commercialQuote);
        }
        return response()->json(['data' => $data]);
    }

    public function update(Request $request, CommercialQuote $commercialQuote): JsonResponse
    {
        abort_if($commercialQuote->status === 'approved', 422, 'Una propuesta aprobada no puede editarse.');

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($commercialQuote, $data): void {
            $items = $commercialQuote->items()->get()->keyBy('id');
            $total = 0.0;

            foreach ($data['items'] as $line) {
                $item = $items->get((int) $line['id']);
                abort_unless($item, 422, 'La línea de propuesta no pertenece a esta cotización.');

                $quantity = (float) $line['quantity'];
                $unitPrice = (float) $line['unit_price'];
                $lineTotal = round($quantity * $unitPrice, 2);
                $total += $lineTotal;

                $item->update([
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ]);
            }

            $commercialQuote->update([
                'notes' => $data['notes'] ?? null,
                'subtotal' => $total,
                'total' => $total,
                'status' => 'pending_approval',
            ]);
        });

        return $this->show($commercialQuote->fresh());
    }

    private function shareUrl(CommercialQuote $quote): string
    {
        $path = URL::temporarySignedRoute('commercial.quotes.public-share', now()->addDays(30), ['commercialQuote' => $quote->id], absolute: false);
        return rtrim((string) config('app.public_backend_url'), '/').$path;
    }

    public function publicShare(Request $request, CommercialQuote $commercialQuote)
    {
        abort_unless($request->hasValidSignature(false), 403, 'Enlace de propuesta no válido o vencido.');
        abort_unless($commercialQuote->status === 'approved', 404);
        $commercialQuote->load(['lead', 'items']);
        $safe = fn ($value) => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $rows = $commercialQuote->items->map(fn ($item) => '<tr><td>'.$safe($item->description).'</td><td>'.$safe($item->quantity).'</td><td>'.$safe($item->unit_price).'</td><td>'.$safe($item->line_total).'</td></tr>')->implode('');
        $html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Propuesta Gaspronal</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:30px auto;padding:16px;color:#182b38}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border-bottom:1px solid #ddd;text-align:left;padding:12px}h1{color:#075e62}</style></head><body><h1>Gaspronal</h1><h2>Propuesta '.$safe($commercialQuote->number).'</h2><p>Cliente: '.$safe($commercialQuote->lead->name).'</p><table><thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>'.$rows.'</tbody></table><h2>Total: '.$safe($commercialQuote->currency).' '.$safe($commercialQuote->total).'</h2><p>'.nl2br($safe($commercialQuote->notes ?? '')).'</p></body></html>';
        return response($html)->header('Content-Type', 'text/html; charset=UTF-8')->header('X-Robots-Tag', 'noindex, nofollow');
    }

    public function send(Request $request, CommercialQuote $commercialQuote): JsonResponse
    {
        abort_unless($commercialQuote->status === 'approved', 422, 'Solo se pueden compartir propuestas aprobadas.');
        $data = $request->validate(['email' => ['required', 'email', 'max:190']]);
        $commercialQuote->load(['lead', 'items']);
        $currency = $commercialQuote->currency ?: 'COP';
        $lines = $commercialQuote->items->map(fn ($item) => sprintf('%s | Cantidad: %s | Precio unitario: %s %s',
            $item->description, $item->quantity, $currency, number_format((float) $item->unit_price, 2, ',', '.')
        ))->implode("\n");
        $body = "Gaspronal - Propuesta {$commercialQuote->number}\n\n".
            "Estimado/a {$commercialQuote->lead->name}:\n\n".
            "Compartimos nuestra propuesta comercial aprobada:\n\n{$lines}\n\n".
            "Total: {$currency} ".number_format((float) $commercialQuote->total, 2, ',', '.')."\n\n".
            ($commercialQuote->notes ? "Observaciones: {$commercialQuote->notes}\n\n" : '').
            "Consulta tu propuesta en: ".$this->shareUrl($commercialQuote)."\n\n".
            "Atentamente,\nEquipo comercial Gaspronal";
        Mail::raw($body, function ($message) use ($data, $commercialQuote): void {
            $message->to($data['email'])->subject('Gaspronal - Propuesta '.$commercialQuote->number);
        });
        return response()->json(['message' => 'Propuesta enviada por correo electrónico.']);
    }

    public function approve(CommercialQuote $commercialQuote): JsonResponse
    {
        abort_unless($commercialQuote->status === 'pending_approval', 422, 'La propuesta no está pendiente de aprobación.');
        abort_unless($commercialQuote->items()->exists(), 422, 'La propuesta no tiene ítems.');
        abort_unless($commercialQuote->items()->where('unit_price', '<=', 0)->doesntExist(), 422, 'Debes establecer precios válidos antes de aprobar la propuesta.');

        DB::transaction(function () use ($commercialQuote): void {
            $commercialQuote->update([
                'status' => 'approved',
                'approved_by' => auth('api')->id(),
                'approved_at' => now(),
            ]);
            $commercialQuote->lead()->update([
                'status' => 'awaiting_human',
                'human_followup_at' => now(),
            ]);
        });

        return $this->show($commercialQuote->fresh());
    }
}
