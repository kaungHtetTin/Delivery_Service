<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinanceCategory extends Model
{
    use HasFactory;

    public const TYPE_INCOME = 'income';
    public const TYPE_EXPENSE = 'expense';
    public const TYPES = [
        self::TYPE_INCOME,
        self::TYPE_EXPENSE,
    ];

    public const DELIVERY_FEE_COLLECTION = 'Delivery Fee Collection';
    public const RIDER_COMMISSION = 'Rider Commission';
    public const RIDER_OIL = 'Rider Oil';
    public const FINANCE_ADJUSTMENT = 'Finance Adjustment';

    protected $fillable = [
        'name',
        'type',
        'description',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(FinanceTransaction::class, 'category_id');
    }

    public static function deliveryFeeIncomeCategory(?int $createdBy = null): self
    {
        return self::firstOrCreate(
            [
                'type' => self::TYPE_INCOME,
                'name' => self::DELIVERY_FEE_COLLECTION,
            ],
            [
                'description' => 'Delivery fees collected from riders.',
                'is_active' => true,
                'created_by' => $createdBy,
            ]
        );
    }

    public static function riderCommissionExpenseCategory(?int $createdBy = null): self
    {
        return self::firstOrCreate(
            [
                'type' => self::TYPE_EXPENSE,
                'name' => self::RIDER_COMMISSION,
            ],
            [
                'description' => 'Commission expenses payable to riders.',
                'is_active' => true,
                'created_by' => $createdBy,
            ]
        );
    }

    public static function riderOilExpenseCategory(?int $createdBy = null): self
    {
        return self::firstOrCreate(
            [
                'type' => self::TYPE_EXPENSE,
                'name' => self::RIDER_OIL,
            ],
            [
                'description' => 'Oil expense for rider delivery operations.',
                'is_active' => true,
                'created_by' => $createdBy,
            ]
        );
    }

    public static function financeAdjustmentExpenseCategory(?int $createdBy = null): self
    {
        return self::firstOrCreate(
            [
                'type' => self::TYPE_EXPENSE,
                'name' => self::FINANCE_ADJUSTMENT,
            ],
            [
                'description' => 'Automatic adjustments for corrected settled delivery fees.',
                'is_active' => true,
                'created_by' => $createdBy,
            ]
        );
    }
}
