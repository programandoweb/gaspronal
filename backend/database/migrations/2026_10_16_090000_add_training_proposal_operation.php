<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('agent_training_proposals', function (Blueprint $table): void {
            $table->enum('operation', ['append', 'replace'])->default('append');
        });
    }

    public function down(): void
    {
        Schema::table('agent_training_proposals', function (Blueprint $table): void {
            $table->dropColumn('operation');
        });
    }
};
