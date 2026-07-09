<?php

return [
    'api_authenticated_per_minute' => env('API_AUTH_RATE_LIMIT_PER_MINUTE', 600),
    'api_guest_per_minute' => env('API_GUEST_RATE_LIMIT_PER_MINUTE', 180),
    'rider_locations_per_minute' => env('RIDER_LOCATION_RATE_LIMIT_PER_MINUTE', 240),
];
