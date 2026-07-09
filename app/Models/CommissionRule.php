<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionRule extends Model
{
    use HasFactory;

    public const TYPE_NONE = 'none';
    public const TYPE_FIXED = 'fixed';
    public const TYPE_PERCENTAGE = 'percentage';
    public const TYPE_FIXED_PLUS_PERCENTAGE = 'fixed_plus_percentage';
    public const TYPES = [
        self::TYPE_NONE,
        self::TYPE_FIXED,
        self::TYPE_PERCENTAGE,
        self::TYPE_FIXED_PLUS_PERCENTAGE,
    ];

    protected $fillable = [
        'rider_id',
        'name',
        'type',
        'fixed_amount',
        'percentage',
        'is_active',
    ];

    protected $casts = [
        'rider_id' => 'integer',
        'fixed_amount' => 'decimal:2',
        'percentage' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function calculate(float $deliveryFee): float
    {
        $fixed = (float) $this->fixed_amount;
        $percentageAmount = round($deliveryFee * ((float) $this->percentage / 100), 2);

        return match ($this->type) {
            self::TYPE_FIXED => $fixed,
            self::TYPE_PERCENTAGE => $percentageAmount,
            self::TYPE_FIXED_PLUS_PERCENTAGE => $fixed + $percentageAmount,
            default => 0,
        };
    }

    public static function activeForRider(?int $riderId): ?self
    {
        if ($riderId) {
            $riderRule = self::query()
                ->where('rider_id', $riderId)
                ->where('is_active', true)
                ->latest('id')
                ->first();

            if ($riderRule) {
                return $riderRule;
            }
        }

        return self::query()
            ->whereNull('rider_id')
            ->where('is_active', true)
            ->latest('id')
            ->first();
    }
}
