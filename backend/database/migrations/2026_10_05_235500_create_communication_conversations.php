<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('communication_conversations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('provider_id')->nullable()->constrained('communication_providers')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('channel', 30)->index();
            $table->string('agent_id', 80)->default('claudio')->index();
            $table->string('external_thread_id', 191);
            $table->string('contact_phone', 40)->nullable()->index();
            $table->string('contact_name', 190)->nullable();
            $table->string('status', 40)->default('active')->index();
            $table->timestamp('human_takeover_at')->nullable();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['provider_id', 'external_thread_id'], 'communication_conversation_thread_unique');
            $table->index(['agent_id', 'channel', 'status', 'last_message_at'], 'communication_conversation_agent_idx');
        });

        Schema::create('communication_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('conversation_id')->constrained('communication_conversations')->cascadeOnDelete();
            $table->foreignId('provider_id')->nullable()->constrained('communication_providers')->nullOnDelete();
            $table->string('direction', 20)->index();
            $table->string('sender_type', 30)->index();
            $table->string('external_message_id', 191)->nullable();
            $table->longText('content');
            $table->string('status', 30)->default('received')->index();
            $table->json('metadata')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'external_message_id'], 'communication_message_external_unique');
            $table->index(['conversation_id', 'created_at'], 'communication_message_thread_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('communication_messages');
        Schema::dropIfExists('communication_conversations');
    }
};
