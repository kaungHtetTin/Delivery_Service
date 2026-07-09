<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Model;

class Rider extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'code',
        'name',
        'phone',
        'email',
        'status',
        'vehicle_type',
        'current_area',
        'last_active_at',
        'cash_held',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'last_active_at' => 'datetime',
        'cash_held' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deliveryOrders(): HasMany
    {
        return $this->hasMany(DeliveryOrder::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(RiderLocation::class);
    }

    public function latestLocation(): HasOne
    {
        return $this->hasOne(RiderLocation::class)->latestOfMany('recorded_at');
    }

    public function cashCollections(): HasMany
    {
        return $this->hasMany(CashCollection::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(RiderSettlement::class);
    }
}
