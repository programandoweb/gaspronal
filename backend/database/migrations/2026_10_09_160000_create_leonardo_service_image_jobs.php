<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('leonardo_service_image_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('posts')->cascadeOnDelete();
            $table->uuid('batch_uuid')->index();
            $table->unsignedTinyInteger('variant');
            $table->string('status', 24)->default('pending')->index();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('generated_image', 2048)->nullable();
            $table->string('provider')->nullable();
            $table->string('model')->nullable();
            $table->longText('prompt')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('leonardo_service_image_jobs'); }
};
