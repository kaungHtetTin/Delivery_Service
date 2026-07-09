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
                'name' => 'Super Admin Office',
                'phone' => '09 500 100 100',
                'password' => Hash::make('password'),
                'role' => User::ROLE_SUPER_ADMIN,
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
                'key' => 'app_icon',
                'value' => '',
                'group' => 'branding',
                'description' => 'Application icon image.',
            ],
            [
                'key' => 'favicon',
                'value' => '',
                'group' => 'branding',
                'description' => 'Browser favicon image.',
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
