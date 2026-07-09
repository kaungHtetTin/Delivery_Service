<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Set this to "*" when Laravel is behind a trusted hosting proxy, load
    | balancer, or CDN that controls X-Forwarded-* headers. Leave it empty for
    | directly exposed servers.
    |
    */

    'proxies' => env('TRUSTED_PROXIES'),
];
