<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentImageEnhancementJob extends Model
{
    protected $fillable = [
        'run_id',
        'catalog_item_id',
        'batch_uuid',
        'idempotency_key',
        'mode',
        'status',
        'attempts',
        'source_image',
        'generated_image',
        'provider',
        'model',
        'prompt',
        'error',
        'started_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(AgentImageEnhancementRun::class, 'run_id');
    }

    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(CatalogItem::class, 'catalog_item_id');
    }
}
