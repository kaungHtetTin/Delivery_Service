<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'socket_server' => [
        'enabled' => env('SOCKET_SERVER_ENABLED', true),
        'url' => env('SOCKET_SERVER_URL', 'http://127.0.0.1:3000'),
        'key' => env('SOCKET_SERVER_KEY', env('INTERNAL_API_KEY')),
        'auth_secret' => env('SOCKET_AUTH_SECRET'),
        'token_ttl' => env('SOCKET_AUTH_TOKEN_TTL', 3600),
        'timeout' => env('SOCKET_SERVER_TIMEOUT', 2),
    ],

    'live_tracking' => [
        'location_retention_days' => env('RIDER_LOCATION_RETENTION_DAYS', 14),
    ],

    'firebase' => [
        'push_enabled' => env('FIREBASE_PUSH_ENABLED', false),
        'project_id' => env('FIREBASE_PROJECT_ID', env('VITE_FIREBASE_PROJECT_ID')),
        'client_email' => env('FIREBASE_CLIENT_EMAIL'),
        'private_key' => env('FIREBASE_PRIVATE_KEY'),
        'timeout' => env('FIREBASE_TIMEOUT', 5),
        'public' => [
            'apiKey' => env('VITE_FIREBASE_API_KEY'),
            'authDomain' => env('VITE_FIREBASE_AUTH_DOMAIN'),
            'projectId' => env('VITE_FIREBASE_PROJECT_ID'),
            'storageBucket' => env('VITE_FIREBASE_STORAGE_BUCKET'),
            'messagingSenderId' => env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
            'appId' => env('VITE_FIREBASE_APP_ID'),
            'measurementId' => env('VITE_FIREBASE_MEASUREMENT_ID'),
        ],
        'vapid_key' => env('VITE_FIREBASE_VAPID_KEY', env('FIREBASE_VAPID_KEY')),
    ],

];
