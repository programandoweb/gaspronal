<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->runOnce(GasproNotasSeeder::class);
        $this->runOnce(GoogleIndexedGasproNotasSeeder::class);
        $this->runOnce(LegacyProductsSeeder::class);
        $this->runOnce(LegacyServicesSeeder::class);
        $this->runOnce(AiProviderSeeder::class);
        $this->runOnce(GeminiProviderSeeder::class);
        $this->runOnce(AiModelSeeder::class);
        $this->runOnce(HeroPermissionDefaultsSeeder::class);

        $email = trim((string) env('ADMIN_EMAIL', ''));
        $password = (string) env('ADMIN_PASSWORD', '');

        if ($email !== '' && $password !== '') {
            // Credenciales de bootstrap: sólo se aplican al crear la cuenta.
            // Nunca sobrescribir una contraseña existente durante un deploy/seed.
            User::query()->firstOrCreate(
                ['email' => $email],
                [
                    'name' => env('ADMIN_NAME', 'Administrador Gaspronal'),
                    'password' => Hash::make($password),
                ],
            );
        }

        // Idempotente: mantiene sincronizados roles/permisos y cuentas base.
        $this->call(AccessControlSeeder::class);

        // Idempotente y no destructivo: garantiza únicamente los heroes base que falten.
        $this->call(HeroSlideSeeder::class);
    }

    /**
     * Ejecuta cada seeder de datos una sola vez por base de datos.
     */
    private function runOnce(string $seederClass): void
    {
        if (DB::table('seeder_runs')->where('seeder', $seederClass)->exists()) {
            $this->command?->info("Seeder omitido (ya ejecutado): {$seederClass}");

            return;
        }

        DB::transaction(function () use ($seederClass): void {
            $this->call($seederClass);

            DB::table('seeder_runs')->insert([
                'seeder' => $seederClass,
                'executed_at' => now(),
            ]);
        });
    }
}
