<?php

namespace Database\Seeders;

use App\Models\Rider;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DeliveryDemoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        foreach ($this->clients() as $client) {
            User::updateOrCreate(
                ['email' => $client['email']],
                [
                    'name' => $client['name'],
                    'phone' => $client['phone'],
                    'password' => Hash::make('password'),
                    'role' => User::ROLE_CLIENT,
                ]
            );
        }

        foreach ($this->riders() as $index => $rider) {
            $user = User::updateOrCreate(
                ['email' => $rider['email']],
                [
                    'name' => $rider['name'],
                    'phone' => $rider['phone'],
                    'password' => Hash::make('password'),
                    'role' => User::ROLE_RIDER,
                ]
            );

            Rider::updateOrCreate(
                ['code' => sprintf('R-%03d', $index + 1)],
                [
                    'user_id' => $user->id,
                    'name' => $rider['name'],
                    'phone' => $rider['phone'],
                    'email' => $rider['email'],
                    'status' => 'available',
                    'vehicle_type' => 'motorbike',
                    'current_area' => $rider['area'],
                    'last_active_at' => null,
                    'cash_held' => 0,
                ]
            );
        }
    }

    private function clients(): array
    {
        $clients = [
            ['name' => 'Moe Thandar', 'email' => 'client@example.test', 'phone' => '09 774 221 890'],
        ];

        for ($index = 2; $index <= 20; $index++) {
            $clients[] = [
                'name' => sprintf('Client User %02d', $index),
                'email' => sprintf('client%02d@example.test', $index),
                'phone' => sprintf('09 600 200 %03d', $index),
            ];
        }

        return $clients;
    }

    private function riders(): array
    {
        $areas = [
            'Kamayut',
            'Lanmadaw',
            'Dagon',
            'Sanchaung',
            'Yankin',
            'Tamwe',
            'Bahan',
            'Insein',
            'Hledan',
            'Thingangyun',
        ];

        $riders = [
            [
                'name' => 'Aung Kyaw',
                'email' => 'rider@example.test',
                'phone' => '09 772 883 120',
                'area' => $areas[0],
            ],
        ];

        for ($index = 2; $index <= 10; $index++) {
            $riders[] = [
                'name' => sprintf('Rider User %02d', $index),
                'email' => sprintf('rider%02d@example.test', $index),
                'phone' => sprintf('09 700 100 %03d', $index),
                'area' => $areas[$index - 1],
            ];
        }

        return $riders;
    }
}
