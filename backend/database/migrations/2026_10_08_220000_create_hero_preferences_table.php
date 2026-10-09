<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('hero_preferences', function (Blueprint $table): void {
            $table->string('section_key', 120)->primary();
            $table->unsignedTinyInteger('active_option')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hero_preferences');
    }
};
