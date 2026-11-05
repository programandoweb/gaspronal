<?php

namespace Database\Seeders;

use App\Models\ContactSetting;
use Illuminate\Database\Seeder;

class ContactSettingsSeeder extends Seeder
{
    public function run(): void
    {
        // Correo público histórico de Gaspronal. No sobrescribir ajustes del dashboard.
        ContactSetting::query()->firstOrCreate(
            ['id' => 1],
            ['notification_emails' => ['servicioalcliente@gaspronal.com']]
        );
    }
}
