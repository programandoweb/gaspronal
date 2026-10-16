<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('agent_training_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('agent_id', 40)->default('claudio')->index();
            $table->timestamps();
        });
        Schema::create('agent_training_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('session_id')->constrained('agent_training_sessions')->cascadeOnDelete();
            $table->enum('role', ['user', 'assistant']);
            $table->longText('content');
            $table->uuid('request_id')->nullable();
            $table->timestamps();
            $table->unique(['session_id', 'request_id']);
        });
        Schema::create('agent_training_proposals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('session_id')->constrained('agent_training_sessions')->cascadeOnDelete();
            $table->string('category', 40);
            $table->string('title', 180);
            $table->text('content');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('agent_training_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('agent_id', 40)->default('claudio');
            $table->string('category', 40);
            $table->string('title', 180);
            $table->text('content');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['agent_id', 'category']);
        });
        Schema::create('agent_training_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rule_id')->constrained('agent_training_rules')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('title', 180);
            $table->text('content');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('proposal_id')->nullable()->constrained('agent_training_proposals')->nullOnDelete();
            $table->foreignId('restored_from_version_id')->nullable()->constrained('agent_training_versions')->nullOnDelete();
            $table->timestamps();
            $table->unique(['rule_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_training_versions');
        Schema::dropIfExists('agent_training_rules');
        Schema::dropIfExists('agent_training_proposals');
        Schema::dropIfExists('agent_training_messages');
        Schema::dropIfExists('agent_training_sessions');
    }
};
