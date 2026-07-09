<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="theme-color" content="#087f74">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <meta
            name="description"
            content="Professional local delivery service management platform"
        >
        <link rel="manifest" href="{{ url('/app.webmanifest') }}">
        <link rel="icon" href="{{ url('/flowdrop-icon.svg') }}" type="image/svg+xml">
        <link rel="apple-touch-icon" href="{{ url('/pwa-icon-192.png') }}">
        <title>FlowDrop Delivery</title>
        @viteReactRefresh
        @vite('resources/js/main.jsx')
    </head>
    <body>
        <div
            id="root"
            data-app-base-url="{{ url('/') }}"
            data-api-base-url="{{ url('/api') }}"
            data-portal="{{ $portal ?? 'client' }}"
            data-service-worker-url="{{ url('/service-worker.js') }}"
        ></div>
    </body>
</html>
