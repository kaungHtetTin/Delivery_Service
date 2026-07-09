<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderSettlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'rider_id',
        'collected_by',
        'amount',
        'payment_method',
        'rider_oil_cost',
        'cash_held_before',
        'cash_held_after',
        'note',
        'collected_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'rider_oil_cost' => 'decimal:2',
        'cash_held_before' => 'decimal:2',
        'cash_held_after' => 'decimal:2',
        'collected_at' => 'datetime',
    ];

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }
}
