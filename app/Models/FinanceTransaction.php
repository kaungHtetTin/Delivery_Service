<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceTransaction extends Model
{
    use HasFactory;

    public const TYPE_INCOME = 'income';
    public const TYPE_EXPENSE = 'expense';
    public const TYPES = [
        self::TYPE_INCOME,
        self::TYPE_EXPENSE,
    ];

    public const PAYMENT_METHODS = [
        'cash',
        'mobile_banking',
        'bank_transfer',
        'other',
    ];

    protected $fillable = [
        'type',
        'category_id',
        'amount',
        'payment_method',
        'transaction_date',
        'description',
        'reference_type',
        'reference_id',
        'rider_id',
        'delivery_order_id',
        'customer_id',
        'client_user_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_date' => 'date',
        'category_id' => 'integer',
        'rider_id' => 'integer',
        'delivery_order_id' => 'integer',
        'customer_id' => 'integer',
        'client_user_id' => 'integer',
        'created_by' => 'integer',
        'updated_by' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinanceCategory::class, 'category_id');
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function deliveryOrder(): BelongsTo
    {
        return $this->belongsTo(DeliveryOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function clientUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
