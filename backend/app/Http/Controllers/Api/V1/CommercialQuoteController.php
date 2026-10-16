<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommercialQuote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

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
        return response()->json(['data' => $commercialQuote->load(['lead', 'items'])]);
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
