<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('agent_settings', function (Blueprint $table): void {
            $table->boolean('web_channel_enabled')->default(false)->after('fallback_ai_model_id');
            $table->text('web_welcome_message')->nullable()->after('web_channel_enabled');
        });
    }
    public function down(): void
    {
        Schema::table('agent_settings', function (Blueprint $table): void {
            $table->dropColumn(['web_channel_enabled', 'web_welcome_message']);
        });
    }
};
