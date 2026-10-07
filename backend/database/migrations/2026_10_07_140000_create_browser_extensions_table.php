<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('browser_extensions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('installation_id')->unique();
            $table->string('name', 120);
            $table->string('type', 60)->default('whatsapp_web');
            $table->string('version', 40)->nullable();
            $table->string('machine_name', 120)->nullable();
            $table->string('whatsapp_number', 32)->nullable();
            $table->boolean('enabled')->default(true);
            $table->json('settings')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index(['enabled', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('browser_extensions');
    }
};
