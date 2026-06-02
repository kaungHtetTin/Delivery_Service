# Delivery Service Management System Architecture

## Current Decision

Build the platform as one Laravel application with React mounted through Laravel Vite integration. Deliver the MVP through small vertical slices so client, office, and rider workflows remain connected as backend capabilities are added.

## Local Backend Baseline

The current machine provides PHP `8.0.7`, so the initial backend is scaffolded on Laravel `9.52.21`. This is a local-compatible foundation that allows API development to proceed immediately.

Upgrade path before production:

* PHP `8.2+`
* A current supported Laravel release
* Current Composer release
* MySQL or PostgreSQL for the deployed environment

## Frontend

The frontend is a React and Vite application inside Laravel.

Structure:

```text
resources/
  js/
    DeliveryApp.jsx Portal shells, screens, and prototype workflow state
    api.js        Laravel API adapter with local fallback behavior
    data.js       Seed data and status definitions
    icons.jsx     Shared SVG icon component
    main.jsx      React entry point
    styles.css    Theme tokens and responsive design system
  views/
    app.blade.php Laravel HTML shell
```

The React prototype now hydrates orders and riders from the Laravel API when it is available. It retains browser storage as a fallback so UI work remains usable while the backend server is offline.

## Backend

The Laravel API and React frontend live together at the repository root.

Current foundation:

* Guest delivery request creation and order listing
* Order detail with rider, status history, payments, and COD relationship
* Office manual rider assignment
* Guarded rider workflow status updates
* Rider list and active assignment list
* Rider GPS location reporting
* SQLite local environment and demo seed data
* Feature tests for request creation, assignment, workflow guards, and GPS reporting

## Backend Roadmap

The Laravel API should be scaffolded after the PHP upgrade with:

1. Authentication and role-based access control
2. Delivery order migrations, models, policies, and API endpoints
3. Order status history
4. Rider profiles, assignment, and location updates
5. Payments, screenshots, and manual approval
6. Cash collection records
7. Notifications and realtime events
8. Reports

## Realtime Direction

Start with API polling where needed during early MVP work. Introduce realtime delivery order and rider-location events once the core backend workflows are stable. This keeps Socket.IO or WebSocket transport behind a clear event boundary.

## File Storage

Use protected storage for mobile banking screenshots. Product photos can follow a separate retention policy because they may be removed after order acceptance or completion.
