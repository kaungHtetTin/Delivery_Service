<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SystemSeeder extends Seeder
{
    public function run()
    {
        User::updateOrCreate(
            ['email' => 'office@example.test'],
            [
                'name' => 'May Aye',
                'phone' => '09 500 100 100',
                'password' => Hash::make('password'),
                'role' => User::ROLE_OFFICE_ADMIN,
            ]
        );

        foreach ($this->systemSettings() as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                [
                    'value' => $setting['value'],
                    'group' => $setting['group'],
                    'description' => $setting['description'],
                ]
            );
        }
    }

    private function systemSettings(): array
    {
        return [
            [
                'key' => 'app_name',
                'value' => 'FlowDrop Delivery',
                'group' => 'branding',
                'description' => 'Application display name.',
            ],
            [
                'key' => 'brand_color',
                'value' => '#087f74',
                'group' => 'branding',
                'description' => 'Default primary UI color.',
            ],
            [
                'key' => 'default_theme',
                'value' => 'light',
                'group' => 'branding',
                'description' => 'Default theme mode.',
            ],
            [
                'key' => 'contact_email',
                'value' => 'office@example.test',
                'group' => 'contact',
                'description' => 'Support and operations contact email.',
            ],
            [
                'key' => 'contact_phone',
                'value' => '09 500 100 100',
                'group' => 'contact',
                'description' => 'Support and operations contact phone.',
            ],
        ];
    }
}
