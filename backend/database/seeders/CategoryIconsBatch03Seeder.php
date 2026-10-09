<?php

namespace Database\Seeders;

use App\Models\CmsServiceTopic;
use Illuminate\Database\Seeder;

/**
 * Tanda 3: clasificaciones Gaspro CMS > Servicios, íconos 21 a 30.
 * Copiar archivos a backend/public/images/uploads/iconos-programandoweb/
 * No modifica las categorías ni las imágenes del catálogo de Productos.
 * Es idempotente y conserva la imagen actual si falta un archivo.
 */
class CategoryIconsBatch03Seeder extends Seeder
{
    public function run(): void
    {
        $folder = 'images/uploads/iconos-programandoweb';
        $items = [
            ['slug' => 'cliente-b2b', 'name' => 'Cliente B2B', 'file' => '21-cliente-b2b.png'],
            ['slug' => 'proyecto', 'name' => 'Proyecto', 'file' => '22-proyecto.png'],
            ['slug' => 'seguridad', 'name' => 'Seguridad', 'file' => '23-seguridad.png'],
            ['slug' => 'verificacion', 'name' => 'Verificación', 'file' => '24-verificacion.png'],
            ['slug' => 'calidad', 'name' => 'Calidad', 'file' => '25-calidad.png'],
            ['slug' => 'certificacion-conformidad', 'name' => 'Certificación / conformidad', 'file' => '26-certificacion-conformidad.png'],
            ['slug' => 'proteccion', 'name' => 'Protección', 'file' => '27-proteccion.png'],
            ['slug' => 'control-de-riesgo', 'name' => 'Control de riesgo', 'file' => '28-control-de-riesgo.png'],
            ['slug' => 'continuidad-operativa', 'name' => 'Continuidad operativa', 'file' => '29-continuidad-operativa.png'],
            ['slug' => 'soporte-tecnico', 'name' => 'Soporte técnico', 'file' => '30-soporte-tecnico.png'],
        ];

        foreach ($items as $item) {
            $topic = CmsServiceTopic::query()->firstOrCreate(
                ['slug' => $item['slug']],
                ['name' => $item['name'], 'is_active' => true]
            );

            if (! is_file(public_path($folder.'/'.$item['file']))) {
                $this->command?->warn("Falta el archivo {$item['file']}; no se cambia la imagen.");
                continue;
            }

            $topic->update(['image_url' => '/'.$folder.'/'.$item['file']]);
            $this->command?->info("Clasificación actualizada: {$item['name']}");
        }
    }
}
