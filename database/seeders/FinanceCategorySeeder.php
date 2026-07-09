<?php

namespace Database\Seeders;

use App\Models\FinanceCategory;
use Illuminate\Database\Seeder;

class FinanceCategorySeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->categories() as $category) {
            FinanceCategory::updateOrCreate(
                [
                    'type' => $category['type'],
                    'name' => $category['name'],
                ],
                [
                    'description' => $category['description'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function categories(): array
    {
        return [
            [
                'name' => FinanceCategory::RIDER_OIL,
                'type' => FinanceCategory::TYPE_EXPENSE,
                'description' => 'Oil expense for rider delivery operations.',
            ],
        ];
    }
}
