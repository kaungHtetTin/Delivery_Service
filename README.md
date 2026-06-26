# FlowDrop Delivery

FlowDrop is a mini delivery service management platform for local delivery operations. React and Laravel live together in one application.

## Current Slice

The application includes:

* Mobile-first client portal with a five-step delivery request form and tracking view
* Dense office dashboard with order queue, rider status, status-map preview, order drawer, and manual assignment
* Mobile-first rider portal with active jobs, job details, manual GPS/status screen, and workflow progression
* Dynamic brand color selector and light/dark themes
* Shared compact glass-like visual system
* Laravel delivery order APIs, riders, status histories, GPS reporting, payments, COD collections, seed data, and feature tests
* Admin management CRUD for users, customers, shops, system settings, orders, riders, payments, and cash collections
* Client pending-order edit/delete, COD toggle, rider assignment, rider completion, and office collection confirmation

## Requirements

Install these locally before running the app:

* PHP 8.1+
* Composer
* Node.js 18+ and npm
* MySQL or MariaDB
* XAMPP is fine for local Apache/MySQL development

## Run Locally

```powershell
composer install
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
```

Create the local MySQL databases:

```sql
CREATE DATABASE delivery_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE delivery_app_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Confirm `.env` matches your MySQL credentials. The default local values are:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=delivery_app
DB_USERNAME=root
DB_PASSWORD=
```

Run migrations and seed the account-only mini-version data:

```powershell
php artisan migrate:fresh --seed
```

Start the Laravel app:

```powershell
php artisan serve
```

In a second terminal:

```powershell
npm run dev
```

Open `http://127.0.0.1:8000`. The local application and test suite use MySQL by default. The app database is `delivery_app`; PHPUnit uses the separate `delivery_app_testing` database so tests can refresh schema safely. Update `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `.env` if your local MySQL credentials differ.

## Seeded Accounts

The default seed data is intentionally account-only for the mini version. It creates system settings, one super admin / office account, 10 rider accounts with rider profiles, and 20 client accounts. It does not create demo orders, payments, customers, shops, or cash collection records.

| Portal | Email | Password | Role |
| --- | --- | --- | --- |
| Office | `office@example.test` | `password` | Super admin |
| Rider | `rider@example.test` | `password` | Rider |
| Client | `client@example.test` | `password` | Client |

Additional seeded accounts are available as `rider02@example.test` through `rider10@example.test` and `client02@example.test` through `client20@example.test`, all using `password`.

Portal paths:

* Client: `http://127.0.0.1:8000`
* Rider: `http://127.0.0.1:8000/rider`
* Office: `http://127.0.0.1:8000/office`

## Mini Version Scope

The first mini version supports the normal operating process:

* Client creates a delivery request.
* Client can edit/delete their own pending request before office review.
* Office reviews orders, edits details, assigns riders, and records/approves delivery fee collection.
* Rider progresses assigned jobs through the delivery workflow.
* Rider completes delivery with a final delivery fee.
* Cash collection records update rider cash held.
* Office can view basic reports for orders, payments, cash collection, and rider activity.

This version uses normal request/response API updates. Websocket realtime tracking, live map provider integration, automatic rider assignment, distance-based pricing, branch management, and advanced settlement reports are future scope.

## Known Limitations

* Tracking screens show workflow status only; they do not show live rider movement.
* Map previews are static visual aids, not connected to a map provider.
* Rider GPS reporting is stored by API, but continuous background location streaming is not part of this mini version.
* Delivery fees are entered manually; distance-based or zone-based pricing is not implemented.
* Office reports are basic summaries, not full accounting or settlement reports.
* Notifications are in-app/API based; push notifications, SMS, and email alerts are future scope.
* Automatic rider assignment and rider recommendations are not implemented.

## Build

```powershell
npm run build
```

The generated production assets are written to `public/build`.

## Test

```powershell
php artisan test
```

The test suite uses `delivery_app_testing` from `phpunit.xml`. It refreshes that database during tests, so do not point it at real data.

## Documentation

* [Product specification](docs/specification.txt)
* [Roadmap](docs/roadmap.md)
* [Mini version roadmap](docs/mini-version-roadmap.md)
* [Realtime websocket and map roadmap](docs/realtime-websocket-map-roadmap.md)
* [UI/UX specification](docs/ui-ux-specification.md)
* [Architecture notes](docs/architecture.md)
* [Separate socket server](socket-server/README.md)
