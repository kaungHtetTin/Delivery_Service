# FlowDrop Delivery

FlowDrop is a mini delivery service management platform for local delivery operations. React and Laravel live together in one application.

## Current Slice

The application includes:

* Mobile-first client portal with a five-step delivery request form and tracking view
* Dense office dashboard with order queue, rider status, map preview, order drawer, and manual assignment
* Mobile-first rider portal with active jobs, job details, GPS state, and workflow progression
* Dynamic brand color selector and light/dark themes
* Shared compact glass-like visual system
* Laravel API hydration with local browser persistence as an offline prototype fallback
* Laravel delivery order APIs, riders, status histories, GPS reporting, payments, COD collections, seed data, and feature tests

## Run Locally

```powershell
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
if (-not (Test-Path database/database.sqlite)) { New-Item -ItemType File database/database.sqlite }
php artisan migrate --seed
php artisan serve
```

In a second terminal:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:8000`. The local application uses SQLite so it can run without additional database setup.

## Build

```powershell
npm run build
```

The generated production assets are written to `public/build`.

## Documentation

* [Product specification](docs/specification.txt)
* [Roadmap](docs/roadmap.md)
* [UI/UX specification](docs/ui-ux-specification.md)
* [Architecture notes](docs/architecture.md)
