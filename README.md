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
* Admin management CRUD for users, customers, shops, system settings, pricing rules, orders, riders, payments, and cash collections
* Saved customer/shop references on delivery orders and default pricing-rule fee calculation

## Run Locally

```powershell
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate

# Create this database in MySQL first if it does not exist:
# CREATE DATABASE delivery_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
php artisan migrate --seed
php artisan serve
```

In a second terminal:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:8000`. The local application uses MySQL by default; update `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `.env` if your local MySQL credentials differ.

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
