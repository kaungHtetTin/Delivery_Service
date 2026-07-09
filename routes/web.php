<?php

use Illuminate\Support\Facades\Route;
use App\Models\SystemSetting;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', fn () => redirect()->route('client'));
Route::get('/app.webmanifest', function () {
    $settings = SystemSetting::query()
        ->whereIn('key', ['app_name', 'brand_color', 'app_icon'])
        ->pluck('value', 'key');
    $appName = $settings->get('app_name') ?: 'FlowDrop Delivery';
    $brandColor = $settings->get('brand_color') ?: '#087f74';
    $appIcon = $settings->get('app_icon');
    $icons = [
        [
            'src' => url('/pwa-icon-192.png'),
            'sizes' => '192x192',
            'type' => 'image/png',
            'purpose' => 'any',
        ],
        [
            'src' => url('/pwa-icon-512.png'),
            'sizes' => '512x512',
            'type' => 'image/png',
            'purpose' => 'any maskable',
        ],
        [
            'src' => url('/flowdrop-icon.svg'),
            'sizes' => 'any',
            'type' => 'image/svg+xml',
            'purpose' => 'any maskable',
        ],
    ];

    if (is_string($appIcon) && $appIcon !== '') {
        array_unshift($icons, [
            'src' => $appIcon,
            'sizes' => 'any',
            'purpose' => 'any',
        ]);
    }

    return response()->json([
        'id' => url('/rider'),
        'name' => $appName,
        'short_name' => str($appName)->limit(12, '')->toString(),
        'description' => 'Delivery operations, rider GPS tracking, and client delivery updates.',
        'start_url' => url('/rider'),
        'scope' => url('/') . '/',
        'display' => 'standalone',
        'background_color' => '#eef4f4',
        'theme_color' => $brandColor,
        'orientation' => 'portrait',
        'categories' => ['business', 'productivity', 'navigation'],
        'icons' => $icons,
        'shortcuts' => [
            [
                'name' => 'Rider GPS',
                'short_name' => 'GPS',
                'description' => 'Open rider GPS tracking.',
                'url' => url('/rider'),
                'icons' => [['src' => url('/pwa-icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
            ],
            [
                'name' => 'Office',
                'short_name' => 'Office',
                'description' => 'Open office operations.',
                'url' => url('/office'),
                'icons' => [['src' => url('/pwa-icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
            ],
        ],
    ])->header('Content-Type', 'application/manifest+json');
})->name('app.manifest');
Route::view('/client', 'app', ['portal' => 'client'])->name('client');
Route::view('/rider', 'app', ['portal' => 'rider'])->name('rider');
Route::view('/office', 'app', ['portal' => 'admin'])->name('office');
