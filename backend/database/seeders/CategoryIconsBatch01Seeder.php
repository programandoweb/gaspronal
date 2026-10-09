<?php

namespace Database\Seeders;

use App\Models\CatalogCategory;
use Illuminate\Database\Seeder;

/**
 * Tanda 1: diez íconos, asociados en el orden visible de las primeras
 * diez categorías del carrusel de Productos.
 *
 * Archivos desplegados manualmente en:
 * backend/public/images/uploads/iconos-programandoweb
 *
 * Reejecutable. Nunca toca productos ni categorías sin archivo disponible.
 */
class CategoryIconsBatch01Seeder extends Seeder
{
    public function run(): void
    {
        $folder = 'images/uploads/iconos-programandoweb';
        $assignments = [
            'asadores-y-planchas-asadoras' => '01-mantenimiento-preventivo.png',
            'campanas-extractoras' => '02-reparacion.png',
            'carros-para-comidas-y-bebidas' => '03-instalacion.png',
            'equipos-bano-maria' => '04-diagnostico-tecnico.png',
            'equipos-mixtos' => '05-fabricacion-a-medida.png',
            'estufas-industriales' => '06-redes-de-gas.png',
            'fabricas-de-arepas' => '07-extraccion.png',
            'freidoras-de-alto-rendimiento' => '08-refrigeracion.png',
            'hornos-industriales' => '09-equipos-electricos.png',
            'marmitas' => '10-acero-inoxidable.png',
        ];

        foreach ($assignments as $slug => $filename) {
            if (! is_file(public_path($folder.'/'.$filename))) {
                $this->command?->warn("No se encuentra {$filename}; se conserva la imagen anterior de {$slug}.");
                continue;
            }
            $updated = CatalogCategory::query()->where('slug', $slug)
                ->update(['image_url' => '/'.$folder.'/'.$filename]);
            if (!$updated) $this->command?->warn("Categoría inexistente: {$slug}.");
        }
    }
}
