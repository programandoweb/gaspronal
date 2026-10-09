<?php

namespace Database\Seeders;

use App\Models\CatalogCategory;
use Illuminate\Database\Seeder;

/**
 * Asocia iconografía industrial relevante con categorías del catálogo público.
 * Nunca reemplaza una imagen configurada manualmente. Si no hay icono apropiado,
 * conserva la fotografía automática actual.
 * Archivos: backend/public/images/uploads/iconos-programandoweb/
 */
class CatalogCategorySemanticIconsSeeder extends Seeder
{
    public function run(): void
    {
        $folder = 'images/uploads/iconos-programandoweb';
        $assignments = [
            'asadores-y-planchas-asadoras' => '33-asadero.png',
            'campanas-extractoras' => '36-campana-extractora.png',
            'equipos-mixtos' => '35-cocina-industrial.png',
            'estufas-industriales' => '37-estufa-industrial.png',
            'freidoras-de-alto-rendimiento' => '38-freidora.png',
            'panaderia' => '32-panaderia.png',
        ];

        foreach ($assignments as $slug => $filename) {
            $category = CatalogCategory::query()->where('slug', $slug)->first();
            if (! $category) {
                $this->command?->warn("No existe la categoría {$slug}.");
                continue;
            }

            if (filled($category->image_url)) {
                $this->command?->info("Se conserva la imagen actual de {$slug}.");
                continue;
            }

            if (! is_file(public_path($folder.'/'.$filename))) {
                $this->command?->warn("No existe {$filename}; se conserva el fallback de {$slug}.");
                continue;
            }

            $category->update(['image_url' => '/'.$folder.'/'.$filename]);
            $this->command?->info("Asignado {$filename} a {$slug}.");
        }
    }
}
