# FlowDrop Delivery

FlowDrop is a mini delivery service management platform for local delivery operations. This repository currently contains the first frontend implementation slice based on the product roadmap.

## Current Slice

The React prototype includes:

* Mobile-first client portal with a five-step delivery request form and tracking view
* Dense office dashboard with order queue, rider status, map preview, order drawer, and manual assignment
* Mobile-first rider portal with active jobs, job details, GPS state, and workflow progression
* Dynamic brand color selector and light/dark themes
* Shared compact glass-like visual system
* Local browser persistence for prototype data

The current data layer is intentionally local and API-ready. Laravel APIs, authentication, database migrations, and realtime transport are the next backend milestone.

## Run Locally

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Build

```powershell
npm run build
```

## Documentation

* [Product specification](docs/specification.txt)
* [Roadmap](docs/roadmap.md)
* [UI/UX specification](docs/ui-ux-specification.md)
* [Architecture notes](docs/architecture.md)
