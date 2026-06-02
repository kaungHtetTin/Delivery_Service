# Delivery Service Management System Architecture

## Current Decision

Build the platform as a React frontend with a Laravel API backend. Deliver the MVP through small vertical slices so client, office, and rider workflows remain connected as backend capabilities are added.

## Local Environment Constraint

The current machine provides PHP `8.0.7`. A modern Laravel baseline requires a PHP upgrade before backend scaffolding. Upgrade PHP before creating the Laravel API project so the application is not locked to an outdated framework release.

Recommended backend prerequisite:

* PHP `8.2+`
* Current Composer release
* MySQL for the initial local environment

## Frontend

The initial frontend is a React and Vite application.

Structure:

```text
src/
  App.jsx       Portal shells, screens, and prototype workflow state
  data.js       Seed data and status definitions
  icons.jsx     Shared SVG icon component
  main.jsx      React entry point
  styles.css    Theme tokens and responsive design system
```

The prototype currently uses browser storage. Replace the local state boundary with API services when the Laravel backend is ready.

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
