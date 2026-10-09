<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        DB::table('post_categories')->updateOrInsert(
            ['slug' => 'servicios'],
            ['name' => 'Servicios', 'description' => 'Artículos y páginas informativas de servicios industriales.', 'is_active' => true, 'updated_at' => now(), 'created_at' => now()]
        );
    }
    public function down(): void {
        // No borrar contenido ni categorías con publicaciones durante un rollback.
    }
};
