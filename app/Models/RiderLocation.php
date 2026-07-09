<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class RiderLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'rider_id',
        'delivery_order_id',
        'latitude',
        'longitude',
        'accuracy',
        'speed',
        'heading',
        'battery_percent',
        'source',
        'recorded_at',
    ];

    protected $appends = [
        'freshness',
        'is_stale',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
    ];

    public function getFreshnessAttribute(): string
    {
        if (! $this->recorded_at) {
            return 'stale';
        }

        $ageSeconds = $this->recorded_at->diffInSeconds(now(), false);

        if ($ageSeconds <= 30) {
            return 'fresh';
        }

        return $ageSeconds <= 120 ? 'warning' : 'stale';
    }

    public function getIsStaleAttribute(): bool
    {
        return $this->freshness === 'stale';
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function deliveryOrder(): BelongsTo
    {
        return $this->belongsTo(DeliveryOrder::class);
    }
}
