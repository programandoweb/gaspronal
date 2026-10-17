<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_settings', function (Blueprint $table): void {
            $table->decimal('ai_temperature', 3, 2)->default(0.75)->after('fallback_ai_model_id');
            $table->string('tone_profile', 40)->default('paisa_amable')->after('ai_temperature');
            $table->string('response_style', 40)->default('balanced')->after('tone_profile');
            $table->text('tone_instructions')->nullable()->after('response_style');
        });
    }

    public function down(): void
    {
        Schema::table('agent_settings', function (Blueprint $table): void {
            $table->dropColumn(['ai_temperature', 'tone_profile', 'response_style', 'tone_instructions']);
        });
    }
};
