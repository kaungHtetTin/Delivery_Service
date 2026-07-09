<?php

return [
    'cache_enabled' => env('MAP_TILE_CACHE_ENABLED', true),
    'cache_disk' => env('MAP_TILE_CACHE_DISK', 'local'),
    'cache_path' => trim(env('MAP_TILE_CACHE_PATH', 'map-tiles'), '/'),
    'max_cache_gb' => (float) env('MAP_TILE_CACHE_MAX_GB', 10),
    'min_zoom' => (int) env('MAP_TILE_MIN_ZOOM', 0),
    'max_zoom' => (int) env('MAP_TILE_MAX_ZOOM', 19),
    'provider' => env('MAP_TILE_PROVIDER_URL', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    'provider_user_agent' => env('MAP_TILE_PROVIDER_USER_AGENT', env('APP_NAME', 'FlowDrop Delivery') . ' tile cache'),
    'timeout' => (int) env('MAP_TILE_PROVIDER_TIMEOUT', 8),
];
