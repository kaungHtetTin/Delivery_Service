<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DeliveryOrder extends Model
{
    use HasFactory;

    public const STATUSES = [
        'pending',
        'approved',
        'rider_assigned',
        'rider_accepted',
        'going_to_pickup',
        'arrived_at_pickup',
        'picked_up',
        'going_to_delivery',
        'arrived_at_delivery',
        'delivered',
        'completed',
        'failed',
        'cancelled',
    ];

    public const TRANSITIONS = [
        'pending' => ['approved', 'cancelled'],
        'approved' => ['rider_assigned', 'cancelled'],
        'rider_assigned' => ['rider_accepted', 'failed', 'cancelled'],
        'rider_accepted' => ['going_to_pickup', 'failed', 'cancelled'],
        'going_to_pickup' => ['arrived_at_pickup', 'failed', 'cancelled'],
        'arrived_at_pickup' => ['picked_up', 'failed', 'cancelled'],
        'picked_up' => ['going_to_delivery', 'failed', 'cancelled'],
        'going_to_delivery' => ['arrived_at_delivery', 'failed', 'cancelled'],
        'arrived_at_delivery' => ['delivered', 'failed', 'cancelled'],
        'delivered' => ['completed'],
        'completed' => [],
        'failed' => [],
        'cancelled' => [],
    ];

    protected $fillable = [
        'code',
        'client_user_id',
        'customer_id',
        'shop_id',
        'client_name',
        'client_phone',
        'pickup_contact_name',
        'pickup_phone',
        'pickup_address',
        'pickup_latitude',
        'pickup_longitude',
        'receiver_name',
        'receiver_phone',
        'receiver_address',
        'receiver_latitude',
        'receiver_longitude',
        'product_name',
        'product_category',
        'quantity',
        'product_value',
        'is_fragile',
        'special_handling_note',
        'delivery_fee_payment_method',
        'product_payment_method',
        'cod_amount',
        'prepaid_amount',
        'delivery_fee',
        'payment_status',
        'status',
        'rider_id',
        'client_note',
        'internal_note',
        'approved_at',
        'assigned_at',
        'picked_up_at',
        'delivered_at',
        'completed_at',
    ];

    protected $casts = [
        'client_user_id' => 'integer',
        'customer_id' => 'integer',
        'shop_id' => 'integer',
        'rider_id' => 'integer',
        'is_fragile' => 'boolean',
        'product_value' => 'decimal:2',
        'cod_amount' => 'decimal:2',
        'prepaid_amount' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'approved_at' => 'datetime',
        'assigned_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (DeliveryOrder $order) {
            $order->code ??= 'FD-' . now()->format('ymd') . '-' . Str::upper(Str::random(4));
        });
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function clientUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_user_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function cashCollection(): HasOne
    {
        return $this->hasOne(CashCollection::class);
    }

    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::TRANSITIONS[$this->status] ?? [], true);
    }
}
