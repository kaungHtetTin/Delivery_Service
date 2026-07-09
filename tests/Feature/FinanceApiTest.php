<?php

namespace Tests\Feature;

use App\Models\FinanceCategory;
use App\Models\FinanceTransaction;
use App\Models\CommissionRule;
use App\Models\Rider;
use App\Models\User;
use Database\Seeders\FinanceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_category_seeder_creates_rider_oil_category()
    {
        $this->seed(FinanceCategorySeeder::class);

        $this->assertDatabaseHas('finance_categories', [
            'name' => FinanceCategory::RIDER_OIL,
            'type' => FinanceCategory::TYPE_EXPENSE,
            'is_active' => true,
        ]);
    }

    public function test_office_can_manage_finance_categories_and_transactions()
    {
        $office = $this->actingAsRole(User::ROLE_OFFICE_ADMIN);

        $incomeCategory = $this->postJson('/api/finance/categories', [
            'name' => 'Delivery Fee Collection',
            'type' => 'income',
            'description' => 'Rider cash returned to office.',
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'Delivery Fee Collection')
            ->assertJsonPath('created_by', $office->id)
            ->json();

        $expenseCategory = $this->postJson('/api/finance/categories', [
            'name' => 'Fuel',
            'type' => 'expense',
        ])
            ->assertCreated()
            ->json();

        $income = $this->postJson('/api/finance/transactions', [
            'type' => 'income',
            'category_id' => $incomeCategory['id'],
            'amount' => 12000,
            'payment_method' => 'cash',
            'transaction_date' => '2026-07-09',
            'description' => 'Morning rider settlement.',
        ])
            ->assertCreated()
            ->assertJsonPath('amount', '12000.00')
            ->assertJsonPath('category.name', 'Delivery Fee Collection')
            ->json();

        $this->postJson('/api/finance/transactions', [
            'type' => 'expense',
            'category_id' => $expenseCategory['id'],
            'amount' => 2000,
            'payment_method' => 'cash',
            'transaction_date' => '2026-07-09',
            'description' => 'Fuel top-up.',
        ])->assertCreated();

        $this->patchJson("/api/finance/transactions/{$income['id']}", [
            'amount' => 12500,
            'description' => 'Adjusted rider settlement.',
        ])
            ->assertOk()
            ->assertJsonPath('amount', '12500.00')
            ->assertJsonPath('description', 'Adjusted rider settlement.');

        $this->getJson('/api/finance/transactions/summary?date_from=2026-07-09&date_to=2026-07-09')
            ->assertOk()
            ->assertJsonPath('totals.income', 12500)
            ->assertJsonPath('totals.expense', 2000)
            ->assertJsonPath('totals.net', 10500);
    }

    public function test_finance_routes_are_office_only()
    {
        Sanctum::actingAs($this->createUser(['role' => User::ROLE_CLIENT]));

        $this->getJson('/api/finance/categories')->assertForbidden();

        Sanctum::actingAs($this->createUser([
            'email' => 'finance-rider@example.test',
            'role' => User::ROLE_RIDER,
        ]));

        $this->getJson('/api/finance/transactions')->assertForbidden();
    }

    public function test_rider_settlement_creates_company_income_transaction()
    {
        $office = $this->actingAsRole(User::ROLE_OFFICE_ADMIN);
        $rider = Rider::create([
            'code' => 'R-FIN',
            'name' => 'Finance Rider',
            'phone' => '09 111 222 777',
            'status' => 'available',
            'cash_held' => 8000,
        ]);

        $this->postJson("/api/riders/{$rider->id}/settlements", [
            'amount' => 5000,
            'payment_method' => 'mobile_banking',
            'note' => 'Collected at office.',
        ])
            ->assertOk()
            ->assertJsonPath('rider.cash_held', '3000.00')
            ->assertJsonPath('settlement.payment_method', 'mobile_banking')
            ->assertJsonPath('finance_transaction.amount', '5000.00')
            ->assertJsonPath('finance_transaction.payment_method', 'mobile_banking')
            ->assertJsonPath('finance_transaction.category.name', FinanceCategory::DELIVERY_FEE_COLLECTION);

        $this->assertDatabaseHas('finance_transactions', [
            'type' => FinanceTransaction::TYPE_INCOME,
            'amount' => 5000,
            'payment_method' => 'mobile_banking',
            'rider_id' => $rider->id,
            'created_by' => $office->id,
        ]);
    }

    public function test_rider_settlement_can_create_rider_oil_expense_transaction()
    {
        $office = $this->actingAsRole(User::ROLE_OFFICE_ADMIN);
        $rider = Rider::create([
            'code' => 'R-OIL',
            'name' => 'Oil Rider',
            'phone' => '09 111 222 888',
            'status' => 'available',
            'cash_held' => 10000,
        ]);

        $this->postJson("/api/riders/{$rider->id}/settlements", [
            'amount' => 7000,
            'payment_method' => 'cash',
            'rider_oil_cost' => 1200,
            'note' => 'Collected with oil cost.',
        ])
            ->assertOk()
            ->assertJsonPath('rider.cash_held', '3000.00')
            ->assertJsonPath('settlement.rider_oil_cost', '1200.00')
            ->assertJsonPath('finance_transaction.category.name', FinanceCategory::DELIVERY_FEE_COLLECTION)
            ->assertJsonPath('rider_oil_transaction.amount', '1200.00')
            ->assertJsonPath('rider_oil_transaction.category.name', FinanceCategory::RIDER_OIL);

        $this->assertDatabaseHas('finance_transactions', [
            'type' => FinanceTransaction::TYPE_EXPENSE,
            'amount' => 1200,
            'payment_method' => 'cash',
            'rider_id' => $rider->id,
            'created_by' => $office->id,
        ]);
    }

    public function test_finance_transactions_can_be_filtered_for_reports()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);
        $rider = Rider::create([
            'code' => 'R-FILTER',
            'name' => 'Filter Rider',
            'phone' => '09 222 333 888',
            'status' => 'available',
        ]);
        $otherRider = Rider::create([
            'code' => 'R-OTHER',
            'name' => 'Other Rider',
            'phone' => '09 222 333 999',
            'status' => 'available',
        ]);
        $incomeCategory = FinanceCategory::create([
            'name' => 'Delivery Fee Collection',
            'type' => FinanceCategory::TYPE_INCOME,
        ]);
        $expenseCategory = FinanceCategory::create([
            'name' => 'Fuel',
            'type' => FinanceCategory::TYPE_EXPENSE,
        ]);

        FinanceTransaction::create([
            'type' => FinanceTransaction::TYPE_INCOME,
            'category_id' => $incomeCategory->id,
            'amount' => 7000,
            'payment_method' => 'cash',
            'transaction_date' => '2026-07-09',
            'description' => 'Filtered settlement',
            'rider_id' => $rider->id,
        ]);
        FinanceTransaction::create([
            'type' => FinanceTransaction::TYPE_INCOME,
            'category_id' => $incomeCategory->id,
            'amount' => 3000,
            'payment_method' => 'mobile_banking',
            'transaction_date' => '2026-07-08',
            'description' => 'Wrong date',
            'rider_id' => $rider->id,
        ]);
        FinanceTransaction::create([
            'type' => FinanceTransaction::TYPE_EXPENSE,
            'category_id' => $expenseCategory->id,
            'amount' => 1000,
            'payment_method' => 'cash',
            'transaction_date' => '2026-07-10',
            'description' => 'Wrong type and date',
            'rider_id' => $otherRider->id,
        ]);

        $query = http_build_query([
            'type' => 'income',
            'category_id' => $incomeCategory->id,
            'payment_method' => 'mobile_banking',
            'date_from' => '2026-07-09',
            'date_to' => '2026-07-09',
            'rider_id' => $otherRider->id,
            'delivery_order_id' => 999999,
            'customer_id' => 999999,
            'client_user_id' => 999999,
        ]);

        $this->getJson("/api/finance/transactions?{$query}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.description', 'Filtered settlement');

        $this->getJson("/api/finance/transactions/summary?{$query}")
            ->assertOk()
            ->assertJsonPath('totals.income', 7000)
            ->assertJsonPath('totals.expense', 0)
            ->assertJsonPath('totals.net', 7000);
    }

    public function test_office_can_manage_commission_rules()
    {
        $this->actingAsRole(User::ROLE_OFFICE_ADMIN);
        $rider = Rider::create([
            'code' => 'R-COM',
            'name' => 'Commission Rider',
            'phone' => '09 333 444 555',
            'status' => 'available',
        ]);

        $rule = $this->postJson('/api/commission-rules', [
            'name' => 'Default percentage',
            'type' => CommissionRule::TYPE_PERCENTAGE,
            'percentage' => 10,
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'Default percentage')
            ->assertJsonPath('percentage', '10.00')
            ->json();

        $this->patchJson("/api/commission-rules/{$rule['id']}", [
            'rider_id' => $rider->id,
            'name' => 'Rider custom',
            'type' => CommissionRule::TYPE_FIXED_PLUS_PERCENTAGE,
            'fixed_amount' => 500,
            'percentage' => 5,
        ])
            ->assertOk()
            ->assertJsonPath('rider.name', 'Commission Rider')
            ->assertJsonPath('fixed_amount', '500.00')
            ->assertJsonPath('percentage', '5.00');

        $this->getJson('/api/commission-rules')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    private function actingAsRole(string $role): User
    {
        $user = $this->createUser(['role' => $role]);

        Sanctum::actingAs($user);

        return $user;
    }

    private function createUser(array $attributes = []): User
    {
        return User::create($attributes + [
            'name' => 'Finance Test User',
            'email' => 'finance-' . uniqid() . '@example.test',
            'phone' => '09 ' . random_int(100, 999) . ' ' . random_int(100, 999) . ' ' . random_int(100, 999),
            'password' => Hash::make('password'),
            'role' => User::ROLE_CLIENT,
        ]);
    }
}
