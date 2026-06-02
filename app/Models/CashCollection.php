<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class CashCollection extends Model
{
    use HasFactory;

    protected $fillable = [
        'delivery_order_id',
        'rider_id',
        'product_cash_collected',
        'delivery_fee_collected',
        'total_cash_collected',
        'payment_note',
        'confirmed_at',
    ];

    protected $casts = [
        'product_cash_collected' => 'decimal:2',
        'delivery_fee_collected' => 'decimal:2',
        'total_cash_collected' => 'decimal:2',
        'confirmed_at' => 'datetime',
    ];

    public function deliveryOrder(): BelongsTo
    {
        return $this->belongsTo(DeliveryOrder::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }
}
