<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('instagram_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('client_id', 100)->nullable();
            $table->string('instagram_user_id', 100);
            $table->string('graph_host', 50)->default('graph.facebook.com');
            $table->text('access_token');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instagram_settings');
    }
};
