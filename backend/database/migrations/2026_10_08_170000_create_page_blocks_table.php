<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('page_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('page_key', 100);
            $table->string('block_key', 100);
            $table->string('label', 160);
            $table->json('content');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['page_key', 'block_key']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('page_blocks');
    }
};
