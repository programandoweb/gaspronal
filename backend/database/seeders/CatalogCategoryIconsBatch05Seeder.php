<?php

namespace Database\Seeders;

use App\Models\CatalogCategory;
use Illuminate\Database\Seeder;

/**
 * Iconos personalizados para las cinco categorias pendientes en Productos.
 *
 * Tanda 5: PNG 39-43 en public/images/uploads/iconos-programandoweb/.
 * Idempotente: NO sobreescribe imagenes seleccionadas manualmente y
 * conserva el fallback de fotografias si falta cualquier archivo.
 *
 * Ejecutar despues de copiar los cinco PNG al directorio en el VPS:
 * php artisan db:seed --class=CatalogCategoryIconsBatch05Seeder --force
 */
class CatalogCategoryIconsBatch05Seeder extends Seeder
{
    public function run(): void
    {
        $directory = 'images/uploads/iconos-programandoweb';

        $icons = [
            'marmitas' => '39-marmitas.png',
            'mesas-y-mesones' => '40-mesas-y-mesones.png',
            'fabricas-de-arepas' => '41-fabricas-de-arepas.png',
            'carros-para-comidas-y-bebidas' => '42-carros-para-comidas-y-bebidas.png',
            'equipos-bano-maria' => '43-equipos-bano-maria.png',
        ];

        foreach ($icons as $slug => $filename) {
            $category = CatalogCategory::query()->where('slug', $slug)->first();

            if (!$category) {
                $this->command?->warn("Categoria inexistente: {$slug}. No se modifica nada.");
                continue;
            }

            if (filled($category->image_url)) {
                $this->command?->info("Se conserva la imagen personalizada de {$slug}.");
                continue;
            }

            if (!is_file(public_path($directory.'/'.$filename))) {
                $this->command?->warn("Falta {$filename}; se conserva el fallback de {$slug}.");
                continue;
            }

            $url = '/'.$directory.'/'.$filename;
            $category->update(['image_url' => $url]);
            $this->command?->info("Asignado {$filename} a {$slug}.");
        }
    }
}
