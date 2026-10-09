<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  Schema::create('cms_service_topics', function(Blueprint $table):void {
   $table->id();$table->string('name',150);$table->string('slug',170)->unique();
   $table->string('image_url',500)->nullable();$table->boolean('is_active')->default(true);$table->timestamps();
  });
  Schema::table('posts',function(Blueprint $table):void {
   $table->foreignId('service_topic_id')->nullable()->after('category_id')->constrained('cms_service_topics')->nullOnDelete();
  });
 }
 public function down():void {
  Schema::table('posts',fn(Blueprint $table)=>$table->dropConstrainedForeignId('service_topic_id'));
  Schema::dropIfExists('cms_service_topics');
 }
};
