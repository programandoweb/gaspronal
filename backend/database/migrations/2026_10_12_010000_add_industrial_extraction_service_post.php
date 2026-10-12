<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $categoryId = DB::table('post_categories')->where('slug', 'servicios')->value('id');
        if (! $categoryId) {
            return;
        }

        $slug = 'sistemas-de-extraccion-industrial';
        if (DB::table('posts')->where('slug', $slug)->exists()) {
            return;
        }

        DB::table('posts')->insert([
            'category_id' => $categoryId,
            'title' => 'Sistemas de extracción industrial',
            'slug' => $slug,
            'excerpt' => 'Montaje de sistemas de extracción para cocinas y espacios que exigen evacuación eficiente de humos.',
            'content' => 'Gaspronal ofrece soluciones de extracción industrial para cocinas y espacios de producción que requieren una evacuación eficiente de humos. Consulta con nuestro equipo las necesidades y especificaciones de tu proyecto.',
            'status' => 'published',
            'seo_title' => 'Sistemas de extracción industrial | Gaspronal',
            'seo_description' => 'Montaje de sistemas de extracción industrial para cocinas y espacios de producción.',
            'published_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        // No eliminar contenidos editados posteriormente por los administradores del CMS.
    }
};
