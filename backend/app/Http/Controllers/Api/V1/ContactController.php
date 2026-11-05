<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\ContactSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Mail\Message as MailMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Throwable;

class ContactController extends Controller
{
    private const SUBJECTS = [
        'Cotización de equipos', 'Servicio técnico', 'Redes de gas',
        'Fabricación a medida', 'Otra consulta',
    ];

    /**
     * Primero se conserva el mensaje en MariaDB y después se intenta el aviso.
     * Un fallo de SMTP jamás pierde la solicitud ni revela detalles al visitante.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:190'],
            'phone' => ['required', 'string', 'min:7', 'max:40', 'regex:/^[0-9+().\s-]+$/'],
            'subject' => ['required', 'string', Rule::in(self::SUBJECTS)],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            'consent' => ['required', 'accepted'],
            'website' => ['nullable', 'string', 'max:0'], // Honeypot invisible al usuario.
        ]);

        // Límite adicional por correo + IP (funciona también detrás del proxy Next.js).
        $key = 'public-contact:' . hash('sha256', strtolower($data['email']).'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($key, 3)) {
            return response()->json(['message' => 'Demasiados envíos. Inténtalo más tarde.'], 429);
        }
        RateLimiter::hit($key, 300);

        $contactMessage = ContactMessage::query()->create([
            'first_name' => trim($data['first_name']),
            'last_name' => trim($data['last_name']),
            'email' => strtolower(trim($data['email'])),
            'phone' => trim($data['phone']),
            'subject' => $data['subject'],
            'message' => trim($data['message']),
            'consent_at' => now(),
            'notification_status' => 'pending',
        ]);

        $this->notifyRecipients($contactMessage);

        return response()->json([
            'message' => 'Recibimos tu mensaje. Nuestro equipo se pondrá en contacto contigo.',
            'success' => true,
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'filter' => ['nullable', Rule::in(['all', 'unread', 'read', 'failed'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = ContactMessage::query();
        $filter = $filters['filter'] ?? 'all';
        if ($filter === 'unread') $query->whereNull('read_at');
        if ($filter === 'read') $query->whereNotNull('read_at');
        if ($filter === 'failed') $query->where('notification_status', 'failed');

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $term = '%'.$search.'%';
                $q->where('first_name', 'like', $term)
                    ->orWhere('last_name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('subject', 'like', $term);
            });
        }

        $paginator = $query->orderByDesc('id')->paginate(15);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'total' => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'unread_count' => ContactMessage::query()->whereNull('read_at')->count(),
                'failed_count' => ContactMessage::query()->where('notification_status', 'failed')->count(),
                'can_manage' => (bool) $request->user()?->can('contacts.manage'),
            ],
        ]);
    }

    public function update(Request $request, ContactMessage $contactMessage): JsonResponse
    {
        $data = $request->validate(['read' => ['required', 'boolean']]);
        $contactMessage->update(['read_at' => $data['read'] ? now() : null]);

        return response()->json(['data' => $contactMessage->fresh()]);
    }

    public function settings(Request $request): JsonResponse
    {
        return response()->json([
            'data' => ['notification_emails' => ContactSetting::query()->find(1)?->notification_emails ?? []],
            'meta' => ['can_manage' => (bool) $request->user()?->can('contacts.manage')],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'notification_emails' => ['required', 'array', 'max:10'],
            'notification_emails.*' => ['required', 'email:rfc', 'max:190', 'distinct:ignore_case'],
        ]);
        $emails = array_values(array_unique(array_map(
            static fn (string $email): string => strtolower(trim($email)),
            $data['notification_emails'],
        )));

        $setting = ContactSetting::query()->updateOrCreate(['id' => 1], ['notification_emails' => $emails]);

        return response()->json(['data' => ['notification_emails' => $setting->notification_emails]]);
    }

    public function resend(ContactMessage $contactMessage): JsonResponse
    {
        $this->notifyRecipients($contactMessage);

        return response()->json(['data' => $contactMessage->fresh()]);
    }

    private function notifyRecipients(ContactMessage $contactMessage): void
    {
        $recipients = ContactSetting::query()->find(1)?->notification_emails ?? [];
        $contactMessage->update([
            'notification_recipients' => $recipients,
            'notification_status' => 'pending',
            'notification_error' => null,
            'notification_sent_at' => null,
        ]);

        if ($recipients === []) {
            $contactMessage->update(['notification_status' => 'not_configured']);
            return;
        }

        $body = implode("\n", [
            'Nuevo mensaje de contacto en Gaspronal',
            'ID de consulta: #'.$contactMessage->id,
            'Fecha: '.$contactMessage->created_at->format('Y-m-d H:i:s'),
            'Nombre: '.$contactMessage->first_name.' '.$contactMessage->last_name,
            'Correo: '.$contactMessage->email,
            'Teléfono: '.$contactMessage->phone,
            'Asunto: '.$contactMessage->subject,
            '',
            'Mensaje:',
            $contactMessage->message,
            '',
            'Este mensaje también se conserva en el dashboard de Gaspronal.',
        ]);

        try {
            Mail::raw($body, function (MailMessage $mail) use ($recipients, $contactMessage): void {
                $mail->to($recipients)
                    ->replyTo($contactMessage->email)
                    ->subject('[Gaspronal] Contacto #'.$contactMessage->id.' - '.$contactMessage->subject);
            });

            // El transporte log/array no envía correos reales.
            $mailTransport = (string) config('mail.default');
            $status = in_array($mailTransport, ['log', 'array'], true) ? 'logged' : 'sent';
            $contactMessage->update([
                'notification_status' => $status,
                'notification_sent_at' => $status === 'sent' ? now() : null,
                'notification_error' => null,
            ]);
        } catch (Throwable $exception) {
            $contactMessage->update([
                'notification_status' => 'failed',
                'notification_error' => 'No fue posible realizar la entrega por correo.',
                'notification_sent_at' => null,
            ]);

            Log::warning('contact_form.email_delivery_failed', [
                'contact_message_id' => $contactMessage->id,
                'exception_type' => get_class($exception),
            ]);
        }
    }
}
