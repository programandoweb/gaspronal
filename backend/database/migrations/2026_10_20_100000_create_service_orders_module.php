<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_customers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->foreignId('commercial_lead_id')->nullable()->index()->constrained('commercial_leads')->nullOnDelete();
            $table->string('name', 190);
            $table->string('document', 80)->nullable()->index();
            $table->string('email', 190)->nullable()->index();
            $table->string('phone', 40)->nullable()->index();
            $table->string('whatsapp', 40)->nullable()->index();
            $table->json('addresses')->nullable();
            $table->string('reference', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['name', 'document']);
        });

        Schema::create('service_orders', function (Blueprint $table): void {
            $table->id();
            $table->string('number', 40)->unique();
            $table->foreignId('customer_id')->constrained('service_customers')->restrictOnDelete();
            $table->foreignId('commercial_quote_id')->nullable()->index()->constrained('commercial_quotes')->nullOnDelete();
            $table->string('status', 30)->default('pending')->index();
            $table->string('maintenance_type', 100)->index();
            $table->text('description');
            $table->string('service_location', 500);
            $table->string('contact_name', 190);
            $table->string('contact_phone', 40)->nullable();
            $table->json('customer_snapshot');
            $table->json('execution_snapshot')->nullable();
            $table->timestamp('started_at')->nullable()->index();
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamp('closed_at')->nullable()->index();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('closed_pdf_path')->nullable();
            $table->string('closed_pdf_hash', 64)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['customer_id', 'status', 'created_at']);
        });

        Schema::create('service_order_assignments', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps(); $table->unique(['service_order_id', 'user_id']);
        });
        Schema::create('service_order_activities', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('description'); $table->timestamp('arrived_at')->nullable(); $table->timestamp('departed_at')->nullable();
            $table->text('observations')->nullable(); $table->text('recommendations')->nullable(); $table->timestamps();
        });
        Schema::create('service_order_equipments', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->string('name', 190); $table->string('quantity', 60)->nullable(); $table->string('dimensions', 190)->nullable(); $table->text('specifications')->nullable(); $table->timestamps();
        });
        Schema::create('service_order_materials', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->string('name', 190); $table->string('quantity', 60)->nullable(); $table->string('unit', 50)->nullable(); $table->text('notes')->nullable(); $table->timestamps();
        });
        Schema::create('service_order_evidences', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind', 20)->index(); $table->string('path', 500); $table->string('mime', 100); $table->unsignedBigInteger('size'); $table->json('metadata')->nullable(); $table->timestamps();
        });
        Schema::create('service_order_signatures', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('role', 20); $table->string('signer_name', 190); $table->string('path', 500); $table->boolean('accepted')->default(false); $table->string('ip_address', 45)->nullable(); $table->timestamp('signed_at'); $table->timestamps(); $table->unique(['service_order_id', 'role']);
        });
        Schema::create('service_order_events', function (Blueprint $table): void {
            $table->id(); $table->foreignId('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 80)->index(); $table->json('payload')->nullable(); $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('service_order_events'); Schema::dropIfExists('service_order_signatures'); Schema::dropIfExists('service_order_evidences'); Schema::dropIfExists('service_order_materials'); Schema::dropIfExists('service_order_equipments'); Schema::dropIfExists('service_order_activities'); Schema::dropIfExists('service_order_assignments'); Schema::dropIfExists('service_orders'); Schema::dropIfExists('service_customers');
    }
};
