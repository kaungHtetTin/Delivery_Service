<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="theme-color" content="#087f74">
        <meta
            name="description"
            content="Professional local delivery service management platform"
        >
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="icon" href="/flowdrop-icon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/flowdrop-icon.svg">
        <title>FlowDrop Delivery</title>
        @viteReactRefresh
        @vite('resources/js/main.jsx')
    </head>
    <body>
        <div
            id="root"
            data-api-base-url="{{ url('/api') }}"
            data-portal="{{ $portal ?? 'client' }}"
        ></div>
    </body>
</html>
