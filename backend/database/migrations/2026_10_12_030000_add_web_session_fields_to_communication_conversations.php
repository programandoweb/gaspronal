<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('communication_conversations', function (Blueprint $table): void {
            $table->string('web_token_hash', 64)->nullable()->unique()->after('external_thread_id');
            $table->string('initial_path', 500)->nullable()->after('contact_name');
            $table->timestamp('data_processing_consent_at')->nullable()->after('human_takeover_at');
            $table->string('data_processing_policy_version', 80)->nullable()->after('data_processing_consent_at');
            $table->timestamp('expires_at')->nullable()->index()->after('last_message_at');
        });
    }

    public function down(): void
    {
        Schema::table('communication_conversations', function (Blueprint $table): void {
            $table->dropUnique(['web_token_hash']);
            $table->dropColumn(['web_token_hash', 'initial_path', 'data_processing_consent_at', 'data_processing_policy_version', 'expires_at']);
        });
    }
};
