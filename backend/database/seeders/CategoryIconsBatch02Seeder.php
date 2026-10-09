<?php

namespace Database\Seeders;

use App\Models\CatalogCategory;
use Illuminate\Database\Seeder;

/**
 * Tanda 2. Archivo PNG transparente por categoría.
 * Solo se asigna cuando existe una categoría con el slug exacto.
 * No crea categorías nuevas ni altera categorías de Productos no relacionadas.
 * Cargar los PNG antes de ejecutar:
 * backend/public/images/uploads/iconos-programandoweb/
 */
class CategoryIconsBatch02Seeder extends Seeder
{
    public function run(): void
    {
        $directory = 'images/uploads/iconos-programandoweb';
        $icons = [
            'soldadura-taller' => '11-soldadura-taller.png',
            'diseno-plano-tecnico' => '12-diseno-plano-tecnico.png',
            'cotizacion' => '13-cotizacion.png',
            'asesoria' => '14-asesoria.png',
            'whatsapp-contacto' => '15-whatsapp-contacto.png',
            'llamada-telefonica' => '16-llamada-telefonica.png',
            'correo' => '17-correo.png',
            'agenda-programacion' => '18-agenda-programacion.png',
            'entrega' => '19-entrega.png',
            'garantia-respaldo' => '20-garantia-respaldo.png',
        ];

        foreach ($icons as $slug => $filename) {
            if (! is_file(public_path($directory.'/'.$filename))) {
                $this->command?->warn("Falta archivo: {$filename}");
                continue;
            }

            $category = CatalogCategory::query()->where('slug', $slug)->first();
            if (! $category) {
                $this->command?->warn("Sin categoría correspondiente a {$slug}; no se modifica ningún registro.");
                continue;
            }

            $category->update(['image_url' => '/'.$directory.'/'.$filename]);
            $this->command?->info("Icono actualizado: {$slug}");
        }
    }
}
