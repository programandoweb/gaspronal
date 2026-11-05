<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use App\Models\ContactSetting;
use App\Models\User;
use Database\Seeders\ContactSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ContactFormTest extends TestCase
{
    use RefreshDatabase;

    private function payload(): array
    {
        return [
            'first_name' => 'Ana',
            'last_name' => 'Gómez',
            'email' => 'ana@example.com',
            'phone' => '3001234567',
            'subject' => 'Cotización de equipos',
            'message' => 'Necesito cotizar varios equipos industriales.',
            'consent' => true,
            'website' => '',
        ];
    }

    public function test_public_form_is_saved_even_when_no_email_recipients_are_configured(): void
    {
        ContactSetting::query()->create(['notification_emails' => []]);
        $this->postJson('/api/v1/public/contact', $this->payload())
            ->assertCreated()->assertJsonPath('success', true);
        $this->assertDatabaseHas('contact_messages', [
            'email' => 'ana@example.com', 'notification_status' => 'not_configured',
        ]);
    }

    public function test_default_recipients_are_seeded_only_once(): void
    {
        $this->seed(ContactSettingsSeeder::class);
        $setting = ContactSetting::query()->findOrFail(1);
        $this->assertSame(['servicioalcliente@gaspronal.com'], $setting->notification_emails);
        $setting->update(['notification_emails' => ['ventas@example.com']]);
        $this->seed(ContactSettingsSeeder::class);
        $this->assertSame(['ventas@example.com'], $setting->fresh()->notification_emails);
    }

    public function test_multiple_recipients_are_recorded_without_sending_real_email(): void
    {
        config()->set('mail.default', 'array');
        ContactSetting::query()->create([
            'notification_emails' => ['ventas@example.com', 'soporte@example.com'],
        ]);

        $this->postJson('/api/v1/public/contact', $this->payload())->assertCreated();

        $message = ContactMessage::query()->firstOrFail();
        $this->assertSame('logged', $message->notification_status);
        $this->assertSame(
            ['ventas@example.com', 'soporte@example.com'],
            $message->notification_recipients
        );
    }

    public function test_honeypot_and_consent_are_required(): void
    {
        $invalid = $this->payload();
        $invalid['consent'] = false;
        $invalid['website'] = 'bot';
        $this->postJson('/api/v1/public/contact', $invalid)->assertUnprocessable()
            ->assertJsonValidationErrors(['consent', 'website']);
        $this->assertSame(0, ContactMessage::query()->count());
    }

    public function test_messages_and_recipients_require_authentication(): void
    {
        $this->getJson('/api/v1/contacts')->assertUnauthorized();
        $this->getJson('/api/v1/contacts/settings')->assertUnauthorized();
        $this->putJson('/api/v1/contacts/settings', ['notification_emails' => []])->assertUnauthorized();
    }

    public function test_authenticated_user_without_permissions_cannot_view_or_edit_contacts(): void
    {
        $user = User::query()->create([
            'name' => 'Cliente', 'email' => 'cliente@example.com', 'password' => 'password',
        ]);
        $this->actingAs($user, 'api')->getJson('/api/v1/contacts')->assertForbidden();
        $this->actingAs($user, 'api')
            ->putJson('/api/v1/contacts/settings', ['notification_emails' => []])
            ->assertForbidden();
    }

    public function test_authorized_user_can_read_messages_and_edit_recipient_list(): void
    {
        $user = User::query()->create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'example-password']);
        Permission::findOrCreate('contacts.view', 'api');
        Permission::findOrCreate('contacts.manage', 'api');
        $user->givePermissionTo(['contacts.view', 'contacts.manage']);

        $this->actingAs($user, 'api')
            ->putJson('/api/v1/contacts/settings', [
                'notification_emails' => ['ventas@example.com', 'soporte@example.com'],
            ])->assertOk()->assertJsonCount(2, 'data.notification_emails');

        $this->actingAs($user, 'api')->getJson('/api/v1/contacts')
            ->assertOk()->assertJsonPath('meta.can_manage', true);
    }
}
