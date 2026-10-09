<?php

namespace Database\Seeders;

use App\Models\CmsServiceTopic;
use Illuminate\Database\Seeder;

/**
 * Tanda 4: Sectores / Aplicaciones, iconos 31 al 38.
 * Archivos manuales: backend/public/images/uploads/iconos-programandoweb/
 * No modifica las categorias del catalogo ni las URLs historicas.
 */
class CategoryIconsBatch04Seeder extends Seeder
{
    public function run(): void
    {
        $folder = 'images/uploads/iconos-programandoweb';
        $topics = [
            ['slug' => 'restaurante', 'name' => 'Restaurante', 'file' => '31-restaurante.png'],
            ['slug' => 'panaderia', 'name' => 'Panadería', 'file' => '32-panaderia.png'],
            ['slug' => 'asadero', 'name' => 'Asadero', 'file' => '33-asadero.png'],
            ['slug' => 'hotel-hospitality', 'name' => 'Hotel / hospitality', 'file' => '34-hotel-hospitality.png'],
            ['slug' => 'cocina-industrial', 'name' => 'Cocina industrial', 'file' => '35-cocina-industrial.png'],
            ['slug' => 'campana-extractora', 'name' => 'Campana extractora', 'file' => '36-campana-extractora.png'],
            ['slug' => 'estufa-industrial', 'name' => 'Estufa industrial', 'file' => '37-estufa-industrial.png'],
            ['slug' => 'freidora', 'name' => 'Freidora', 'file' => '38-freidora.png'],
        ];

        foreach ($topics as $topic) {
            $category = CmsServiceTopic::query()->firstOrCreate(
                ['slug' => $topic['slug']],
                ['name' => $topic['name'], 'is_active' => true]
            );

            if (! is_file(public_path($folder.'/'.$topic['file']))) {
                $this->command?->warn('Falta el PNG '.$topic['file'].'. Se conserva la imagen anterior.');
                continue;
            }

            $category->update(['image_url' => '/'.$folder.'/'.$topic['file']]);
            $this->command?->info('Icono asignado: '.$topic['name']);
        }
    }
}
