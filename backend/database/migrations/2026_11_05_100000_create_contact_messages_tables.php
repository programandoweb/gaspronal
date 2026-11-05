<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_settings', function (Blueprint $table): void {
            $table->id();
            $table->json('notification_emails');
            $table->timestamps();
        });

        Schema::create('contact_messages', function (Blueprint $table): void {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 190)->index();
            $table->string('phone', 40);
            $table->string('subject', 150);
            $table->text('message');
            $table->timestamp('consent_at');
            $table->timestamp('read_at')->nullable()->index();
            $table->string('notification_status', 25)->default('pending')->index();
            $table->json('notification_recipients')->nullable();
            $table->timestamp('notification_sent_at')->nullable();
            $table->string('notification_error', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_messages');
        Schema::dropIfExists('contact_settings');
    }
};
