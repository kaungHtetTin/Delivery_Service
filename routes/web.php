<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\MapTileController;
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
Route::get('/map-tiles/{z}/{x}/{y}', [MapTileController::class, 'show'])
    ->whereNumber(['z', 'x', 'y'])
    ->name('map-tiles.show');
Route::get('/app.webmanifest', function (Request $request) {
    $settings = SystemSetting::query()
        ->whereIn('key', ['app_name', 'brand_color', 'app_icon'])
        ->pluck('value', 'key');
    $appName = $settings->get('app_name') ?: 'FlowDrop Delivery';
    $brandColor = $settings->get('brand_color') ?: '#087f74';
    $appIcon = $settings->get('app_icon');
    $portal = $request->query('portal', 'client');
    $portal = in_array($portal, ['client', 'rider', 'office'], true) ? $portal : 'client';
    $portalConfig = [
        'client' => [
            'label' => 'Client',
            'short_name' => 'Client',
            'description' => 'Create deliveries and receive delivery updates.',
            'url' => url('/client'),
        ],
        'rider' => [
            'label' => 'Rider',
            'short_name' => 'Rider',
            'description' => 'Manage assigned deliveries, GPS tracking, and rider alerts.',
            'url' => url('/rider'),
        ],
        'office' => [
            'label' => 'Office',
            'short_name' => 'Office',
            'description' => 'Manage delivery operations, riders, and office alerts.',
            'url' => url('/office'),
        ],
    ];
    $currentPortal = $portalConfig[$portal];
    $manifestName = "{$appName} {$currentPortal['label']}";
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
        'id' => $currentPortal['url'],
        'name' => $manifestName,
        'short_name' => $currentPortal['short_name'],
        'description' => $currentPortal['description'],
        'start_url' => $currentPortal['url'],
        'scope' => url('/') . '/',
        'display' => 'standalone',
        'background_color' => '#eef4f4',
        'theme_color' => $brandColor,
        'orientation' => 'portrait',
        'categories' => ['business', 'productivity', 'navigation'],
        'icons' => $icons,
        'shortcuts' => [
            [
                'name' => 'Client',
                'short_name' => 'Client',
                'description' => 'Open client deliveries.',
                'url' => url('/client'),
                'icons' => [['src' => url('/pwa-icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
            ],
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
Route::get('/firebase-messaging-sw.js', function () {
    $config = array_filter(
        (array) config('services.firebase.public', []),
        fn ($value) => filled($value)
    );
    $jsonConfig = json_encode((object) $config, JSON_UNESCAPED_SLASHES);
    $clientUrl = url('/client');
    $iconUrl = url('/pwa-icon-192.png');
    $firebaseVersion = '12.16.0';
    $script = <<<JS
const firebaseConfig = {$jsonConfig};
const defaultClickUrl = "{$clientUrl}";
const defaultIconUrl = "{$iconUrl}";

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    importScripts("https://www.gstatic.com/firebasejs/{$firebaseVersion}/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/{$firebaseVersion}/firebase-messaging-compat.js");

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};

      self.registration.showNotification(notification.title || data.title || "Delivery update", {
        body: notification.body || data.body || "",
        icon: notification.icon || defaultIconUrl,
        badge: defaultIconUrl,
        data: {
          link: data.link || defaultClickUrl,
        },
      });
    });
  }
} catch (error) {
  console.warn("[firebase-sw] setup_failed", error?.message || error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || defaultClickUrl;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => client.url === link);

      if (existingClient) {
        return existingClient.focus();
      }

      return clients.openWindow(link);
    })
  );
});
JS;

    return response($script, 200, [
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
        'Content-Type' => 'application/javascript; charset=UTF-8',
    ]);
})->name('firebase.messaging.worker');
Route::view('/client', 'app', ['portal' => 'client'])->name('client');
Route::view('/rider', 'app', ['portal' => 'rider'])->name('rider');
Route::view('/office', 'app', ['portal' => 'admin'])->name('office');
