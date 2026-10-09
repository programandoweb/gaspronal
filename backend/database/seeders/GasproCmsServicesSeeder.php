<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\PostCategory;
use Illuminate\Database\Seeder;

/**
 * Fichas recuperadas de https://www.gaspronal.com/2019/servicios
 * Las URL publicadas se conservan mediante la categoría "servicios".
 * Idempotente: no modifica publicaciones editadas manualmente.
 */
class GasproCmsServicesSeeder extends Seeder
{
    public function run(): void
    {
        $category = PostCategory::query()->firstOrCreate(
            ['slug' => 'servicios'],
            [
                'name' => 'Servicios',
                'description' => 'Servicios industriales y técnicos de Gaspronal.',
                'is_active' => true,
            ],
        );

        $services = [
            [
                'title' => 'Fabricación de equipos industriales',
                'slug' => 'fabricacion-de-equipos-industriales',
                'excerpt' => 'Diseño y fabricación de equipos industriales en acero inoxidable para la industria alimenticia y proyectos especiales a medida.',
                'content' => "Gaspronal fabrica equipos industriales en acero inoxidable adaptados a las necesidades de cada cliente. Su trabajo comprende el diseño, la innovación y la fabricación de soluciones para actividades de la industria alimenticia, con atención a la seguridad de operación y a la mejora continua de los procesos.\n\nTambién desarrolla equipos especiales a medida para negocios de arepas, panaderías, restaurantes y comidas rápidas, materializando ideas y proyectos de cocina en acero inoxidable.",
            ],
            [
                'title' => 'Instalación, reparación y mantenimiento de equipos a gas domésticos e industriales',
                'slug' => 'instalacion-reparacion-y-mantenimiento-de-equipos-a-gas-domesticos-e-industriales',
                'excerpt' => 'Servicio técnico de instalación, reparación y mantenimiento preventivo y correctivo de equipos a gas para cocinas.',
                'content' => 'Gaspronal ofrece mantenimiento preventivo y correctivo de equipos de cocina domésticos e industriales, así como instalación y reparación de equipos a gas de distintas marcas. Su equipo técnico está orientado a prestar atención oportuna y soluciones profesionales con énfasis en el servicio al cliente.',
            ],
            [
                'title' => 'Instalación de redes de gas propano y natural',
                'slug' => 'instalacion-de-redes-de-gas-propano-y-natural',
                'excerpt' => 'Revisión, reforma, corrección e instalación de redes de gas natural y gas propano.',
                'content' => 'Gaspronal presenta servicios de revisión, reforma, corrección e instalación de redes de gas natural y propano. En su publicación histórica indica contar con certificación para trabajos en redes de gas natural y autorización de E.P.M. La vigencia de cualquier certificación debe confirmarse antes de contratar.',
            ],
            [
                'title' => 'Asesoría y entrenamiento técnico',
                'slug' => 'asesoria-y-entrenamiento-tecnico',
                'excerpt' => 'Capacitación del personal operativo en manipulación, cuidados y limpieza de equipos fabricados por Gaspronal.',
                'content' => 'Gaspronal ofrece asesoría y entrenamiento técnico al personal que utiliza sus equipos, incluyendo orientación sobre manipulación, limpieza y cuidado. El objetivo es contribuir a prevenir accidentes, optimizar recursos, facilitar el trabajo y prolongar la vida útil de los equipos.',
            ],
            [
                'title' => 'Servicio correctivo de equipos industriales',
                'slug' => 'servicio-correctivo-de-equipos-industriales',
                'excerpt' => 'Reparación y recuperación de equipos industriales deteriorados para prolongar su vida útil.',
                'content' => "El servicio correctivo de Gaspronal está orientado a recuperar equipos industriales afectados por el uso y el desgaste. Incluye intervenciones como mantenimiento general y pintura de estufas; en freidoras, según el daño, puede comprender traslado al taller, lavado, desengrase, soldadura y pruebas de verificación. Estas intervenciones buscan devolver funcionalidad al equipo y prolongar su vida útil.",
            ],
        ];

        foreach ($services as $service) {
            Post::query()->firstOrCreate(
                ['slug' => $service['slug']],
                [
                    'category_id' => $category->id,
                    'title' => $service['title'],
                    'excerpt' => $service['excerpt'],
                    'content' => $service['content'],
                    'status' => 'published',
                    'seo_title' => $service['title'].' | Gaspronal',
                    'seo_description' => $service['excerpt'],
                    'published_at' => now(),
                ],
            );
        }
    }
}
