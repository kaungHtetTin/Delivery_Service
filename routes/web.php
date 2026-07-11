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
    $traceUrl = url('/api/notifications/push-worker-trace');
    $firebaseVersion = '12.16.0';
    $script = <<<JS
const firebaseConfig = {$jsonConfig};
const defaultClickUrl = "{$clientUrl}";
const defaultIconUrl = "{$iconUrl}";
const traceUrl = "{$traceUrl}";

function traceFirebaseWorker(eventName, details = {}) {
  try {
    return fetch(traceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ event: eventName, details }),
      keepalive: true,
    }).catch(() => {});
  } catch (error) {
    return Promise.resolve();
  }
}

function payloadSummary(payload) {
  const data = payload?.data || {};
  return {
    has_data: !!payload?.data,
    has_notification: !!payload?.notification,
    has_webpush: !!payload?.webpush,
    has_fcm_options: !!payload?.fcmOptions,
    payload_keys: payload ? Object.keys(payload).slice(0, 20) : [],
    data_keys: Object.keys(data).slice(0, 20),
    title: payload?.notification?.title || data.title || "",
    message_id: payload?.messageId || payload?.data?.["google.c.a.c_id"] || "",
    link: data.link || payload?.fcmOptions?.link || defaultClickUrl,
  };
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let details = { has_data: !!event.data };

    try {
      if (event.data) {
        details = payloadSummary(event.data.json());
      }
    } catch (error) {
      details.error = error?.message || String(error);
    }

    await traceFirebaseWorker("push_event", details);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || defaultClickUrl;

  event.waitUntil(
    traceFirebaseWorker("notification_click", { title: event.notification?.title || "", link })
      .then(() => clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clientList) => {
      const existingClient = clientList.find((client) => client.url === link);

      if (existingClient) {
        return existingClient.focus();
      }

      return clients.openWindow(link);
    })
  );
});

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    importScripts("https://www.gstatic.com/firebasejs/{$firebaseVersion}/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/{$firebaseVersion}/firebase-messaging-compat.js");

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      if (payload.notification) {
        traceFirebaseWorker("background_message_notification_payload", payloadSummary(payload));
        return;
      }

      const data = payload.data || {};

      traceFirebaseWorker("background_message_data_payload", payloadSummary(payload));

      self.registration.showNotification(data.title || "Delivery update", {
        body: data.body || "",
        icon: data.icon || defaultIconUrl,
        badge: defaultIconUrl,
        tag: data.notification_id || data.order_id || undefined,
        renotify: false,
        data: {
          link: data.link || defaultClickUrl,
        },
      }).catch((error) => traceFirebaseWorker("show_notification_failed", {
        error: error?.message || String(error),
        title: data.title || "Delivery update",
      }));
    });
  }
} catch (error) {
  console.warn("[firebase-sw] setup_failed", error?.message || error);
  traceFirebaseWorker("setup_failed", { error: error?.message || String(error) });
}
JS;

    return response($script, 200, [
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
        'Content-Type' => 'application/javascript; charset=UTF-8',
    ]);
})->name('firebase.messaging.worker');
Route::view('/client', 'app', ['portal' => 'client'])->name('client');
Route::view('/rider', 'app', ['portal' => 'rider'])->name('rider');
Route::view('/office', 'app', ['portal' => 'admin'])->name('office');
