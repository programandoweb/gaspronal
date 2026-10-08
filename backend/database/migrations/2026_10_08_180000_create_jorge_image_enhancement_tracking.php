<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_image_enhancement_runs', function (Blueprint $table): void {
            $table->id();
            $table->string('agent_id', 80)->unique();
            $table->uuid('batch_uuid')->nullable()->index();
            $table->string('status', 30)->default('idle')->index();
            $table->unsignedInteger('total_items')->default(0);
            $table->unsignedInteger('processed_items')->default(0);
            $table->unsignedInteger('successful_items')->default(0);
            $table->unsignedInteger('failed_items')->default(0);
            $table->foreignId('current_catalog_item_id')->nullable()->constrained('catalog_items')->nullOnDelete();
            $table->text('last_error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->timestamps();
        });

        Schema::create('agent_image_enhancement_jobs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('run_id')->constrained('agent_image_enhancement_runs')->cascadeOnDelete();
            $table->foreignId('catalog_item_id')->constrained('catalog_items')->cascadeOnDelete();
            $table->uuid('batch_uuid')->nullable()->index();
            $table->string('idempotency_key', 190)->unique();
            $table->string('mode', 20)->default('auto')->index();
            $table->string('status', 30)->default('pending')->index();
            $table->unsignedInteger('attempts')->default(0);
            $table->string('source_image', 2048)->nullable();
            $table->string('generated_image', 2048)->nullable();
            $table->string('provider', 120)->nullable();
            $table->string('model', 200)->nullable();
            $table->text('prompt')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'catalog_item_id']);
            $table->index(['mode', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_image_enhancement_jobs');
        Schema::dropIfExists('agent_image_enhancement_runs');
    }
};
