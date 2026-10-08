<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AgentImageEnhancementRun extends Model
{
    protected $fillable = [
        'agent_id',
        'batch_uuid',
        'status',
        'total_items',
        'processed_items',
        'successful_items',
        'failed_items',
        'current_catalog_item_id',
        'last_error',
        'started_at',
        'finished_at',
        'last_heartbeat_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'last_heartbeat_at' => 'datetime',
        ];
    }

    public function currentItem(): BelongsTo
    {
        return $this->belongsTo(CatalogItem::class, 'current_catalog_item_id');
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(AgentImageEnhancementJob::class, 'run_id');
    }
}
