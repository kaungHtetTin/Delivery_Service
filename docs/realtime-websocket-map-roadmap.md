# GPS Realtime Tracking System Roadmap

## Goal

Activate the rider GPS page and build full realtime rider tracking for office and clients.

The target operating process is:

- Rider taps **Start active** when ready to work.
- Start active means the rider is online, listening for assignments, and sharing live location.
- Office can see all active/online riders during working hours.
- Client can see only their assigned rider, and only after the product is picked up.
- GPS permission denial should warn the rider but should not block the delivery workflow.
- The first production goal is live current position only, not route history playback.

## Important Browser And PWA Reality

Browser geolocation can support foreground live tracking with `watchPosition()` and permission prompts, but reliable all-day background GPS is not guaranteed by a normal web page or PWA on all devices.

Planned approach:

- Use PWA for installability, app-shell caching, offline queueing, and better mobile experience.
- Use browser Geolocation API for the first web/PWA version.
- Do not build all-day native background tracking for the current operation.
- When the rider opens or returns to the app during working hours, immediately refresh GPS, restart the watcher if needed, and flush queued updates.
- Do not promise perfect background GPS from a browser-only PWA.

Reference notes:

- MDN Geolocation API: geolocation requires user permission and secure contexts.
- MDN `watchPosition()`: browser can watch position changes while the page/app is allowed to run.
- MDN/Chrome PWA background sync docs: service workers can run background sync tasks, but this is not the same as continuous background GPS tracking.

## Current System Starting Point

Already available or partially available:

- `rider_locations` data model exists.
- Laravel endpoint exists:
  - `POST /api/riders/{rider}/locations`
- Laravel publishes `rider.location.updated`.
- Socket server supports `rider.location.updated` and `rider:location-updated`.
- Office app has placeholder map components.
- Rider app has a placeholder GPS page.
- Client app has workflow tracking, but not real GPS tracking yet.

## Tracking Policy

### Rider Status

Add a clear duty state:

- `offline`: not working, no location sharing.
- `online` or `available`: working and sharing location.
- `busy`: assigned and working an active delivery.
- `on_break`: temporarily paused; location sharing can pause or use low frequency.
- `suspended`: blocked by office.

### Start Active

When rider taps **Start active**:

- Set rider status to `available` or `online`.
- Request GPS permission if not already granted.
- Start location watcher.
- Start socket connection if not already connected.
- Show GPS status card:
  - permission state
  - tracking state
  - last sent location time
  - accuracy
  - network status

### Stop Active

When rider taps **Stop active**:

- Set rider status to `offline`.
- Stop browser watcher.
- Stop sending location updates.
- Keep delivery workflow usable if there is an active order, but warn office if GPS is off.

## Recommended Location Update Strategy

For around 200 riders, use adaptive tracking instead of a fixed very-fast interval.

### Default Working-Hours Tracking

- Send every 15 seconds when moving.
- Send every 45-60 seconds when stationary.
- Always send immediately when:
  - rider taps Start active
  - rider accepts assignment
  - order status changes to picked up
  - order status changes to delivered/completed
  - app returns from background to foreground

### Movement Threshold

Only send if one of these is true:

- moved at least 15 meters
- heading changed meaningfully
- speed changed meaningfully
- last successful send is older than the max interval

### Accuracy And Battery Tradeoff

Use balanced mode:

- `enableHighAccuracy: true` for active delivery and first fix.
- Use normal accuracy when rider is online but stationary or waiting.
- Reject or mark poor-quality fixes when accuracy is worse than 100 meters.
- Keep stale marker logic instead of over-polling.

Expected load at 200 riders:

- 15 second interval while moving = about 13-14 updates per second if all riders move.
- With movement threshold and stationary throttling, expected normal load should be lower.
- This is reasonable for Laravel + MySQL if writes are indexed and payloads are small.

## Phase 1. Rider GPS Page Activation

### Backend

- Add rider duty endpoints:
  - `POST /api/riders/{rider}/start-active`
  - `POST /api/riders/{rider}/stop-active`
- Update rider status and `last_active_at`.
- Return rider profile and latest location.
- Keep authorization strict:
  - rider can only start/stop own rider profile
  - office can override status if needed

### Frontend

- Replace rider GPS placeholder with real controls:
  - Start active
  - Stop active
  - GPS permission state
  - live latitude/longitude
  - accuracy
  - speed
  - last sent time
  - warning banner if GPS denied/unavailable
- Continue delivery workflow even if GPS fails.

### Acceptance

- Rider can start active.
- Rider status changes to online/available.
- Browser asks for GPS permission.
- Denied GPS shows warning but does not block the app.
- Location updates are sent while active.

## Phase 2. PWA Rider App

### Required

- Add web app manifest.
- Add service worker.
- Make rider app installable.
- Add app icons and splash-safe theme colors.
- Cache core rider app shell.
- Add offline indicator.
- Queue unsent location updates locally when network is offline.

### Offline Queue

Use IndexedDB or a small local queue for:

- last known location
- unsent location payloads
- send retry count
- created timestamp

Flush queue when:

- network returns
- app opens
- rider taps Start active
- socket reconnects

### Acceptance

- Rider can install app on supported mobile browsers.
- Rider app opens with cached shell when network is unstable.
- Location sends resume after connection returns.
- App clearly shows when updates are queued.

## Phase 3. Location Ingestion API Hardening

### Current Endpoint

Continue using:

- `POST /api/riders/{rider}/locations`

### Add Validation

Store:

- `rider_id`
- `delivery_order_id` nullable
- `latitude`
- `longitude`
- `accuracy`
- `speed`
- `heading`
- `battery_percent`
- `recorded_at`
- `source` such as `browser`, `pwa`, `native`

### Add Server Rules

- Rider can only update own location.
- Office/admin cannot spoof rider location through normal UI.
- Reject impossible coordinates.
- Reject very old timestamps.
- Rate-limit per rider.
- Deduplicate same position/time payloads.
- Mark stale if no update for more than 2 minutes.

### Database

Recommended indexes:

- `rider_locations(rider_id, recorded_at)`
- `rider_locations(delivery_order_id, recorded_at)`
- `riders(status, last_active_at)`

### Acceptance

- 200 active riders can send updates without noticeable app slowdown.
- Invalid or unauthorized location updates are rejected.
- Duplicate updates do not spam socket events.

## Phase 4. Realtime Socket Authorization And Rooms

### Rooms

- `office`: office sees all active riders.
- `rider:{riderId}`: rider receives own assignment/status events.
- `order:{orderId}`: client and assigned rider can receive allowed order events.
- `client:{userId}`: client account events.

### Location Event Rules

Office receives:

- all online rider location events
- rider status change events

Rider receives:

- own tracking acknowledgment
- own assignment/order events

Client receives rider location only when:

- order belongs to that client
- rider is assigned
- order status is `picked_up`, `delivered`, or another in-transit status before completion
- order is not completed/cancelled/failed

### Acceptance

- Client cannot subscribe to another order.
- Office sees all working riders.
- Rider cannot publish fake events directly to socket server.
- Laravel remains source of truth.

## Phase 5. Office Live Map

### Scope

Office map shows all online/working riders, not only assigned riders.

### Required UI

- Real map provider:
  - Leaflet + OpenStreetMap for first cost-effective version
  - Google Maps or Mapbox later if routing/geocoding quality is needed
- Rider markers:
  - rider name
  - status
  - active order count
  - last update time
  - GPS accuracy
  - stale/online indicator
- Search/filter:
  - rider name
  - status
  - area
  - active assignment
- Click marker to open rider detail or assigned orders.

### Stale Logic

- Fresh: updated within 30 seconds.
- Warning: updated 31-120 seconds ago.
- Stale: older than 2 minutes.
- Offline: rider stopped active or no update for configured timeout.

### Acceptance

- Office sees all active riders on one map.
- Marker moves without page refresh.
- Stale riders are visually clear.
- Map remains useful with 0 riders or missing GPS permission.

## Phase 6. Client Live Tracking

### Visibility Rule

Client sees rider live position only after product pickup.

Recommended statuses:

- Hide live rider marker:
  - pending
  - rider_assigned
  - rider_accepted
- Show live rider marker:
  - picked_up
  - delivered if confirmation is still pending
- Stop showing live rider marker:
  - completed
  - failed
  - cancelled

### UI

- Client tracking page shows:
  - order status timeline
  - assigned rider name
  - live rider marker after pickup
  - last updated time
  - fallback text if GPS unavailable

### Acceptance

- Client can only see own assigned order rider.
- Rider location appears only after pickup.
- Completed/cancelled orders stop showing live rider position.

## Phase 7. App-Entry Tracking Strategy

### Browser/PWA Version

Use this for the current operation:

- Tracking works best while app is open/foreground.
- PWA installation improves launch and persistence.
- Queue and flush location updates when network drops.
- On visibility change, page focus, app open, or network return, immediately request/send current position.
- Restart the browser GPS watcher when the rider re-enters the app if the browser has paused it.
- Show warning if GPS permission is denied or the browser cannot provide a current position.
- Accept that live position can become stale while the rider stays outside the app for too long.

### Operational Rule

All-day background GPS is not required for the current workflow because riders are expected to enter the app frequently during working hours.

If the business process changes later and riders stop opening the app frequently, reassess a native wrapper such as Capacitor with platform background-location support.

### Acceptance

- PWA version is honest about foreground/app-entry tracking.
- Rider app sends a fresh GPS point whenever the rider opens or returns to the app.
- Queued updates flush when the app reconnects or returns to the foreground.
- Laravel backend does not care whether source is browser, PWA, or a future native wrapper.

## Phase 8. Monitoring And Operations

### Metrics

Track:

- active riders
- updates per minute
- average GPS accuracy
- stale rider count
- socket connected clients
- socket publish failures
- location API validation failures
- offline queued update count

### Logs

Log:

- start active
- stop active
- GPS denied
- stale rider detected
- abnormal update frequency
- socket publish failure

### Office Alerts

Show alerts for:

- rider online but GPS denied
- active delivery with stale rider GPS
- rider has not updated location for more than 2 minutes
- location accuracy is poor for repeated updates

## Phase 9. Privacy And Compliance

### Required Product Rules

- Rider must visibly know when location tracking is active.
- Tracking starts only after rider action or explicit office process.
- Tracking stops when rider stops active/offline.
- Client only sees rider after pickup.
- Do not expose all rider locations to clients.
- Keep current-position use limited to operations.

### Data Retention

Because only live current position is required:

- Keep detailed `rider_locations` for a short operational retention window.
- Suggested first policy: 7-14 days.
- Keep only latest location on `riders` table later if storage volume becomes high.
- Add pruning command:
  - `php artisan rider-locations:prune`

## Phase 10. Testing Plan

### Backend Tests

- Rider can start active.
- Rider can stop active.
- Rider can update own location.
- Rider cannot update another rider location.
- GPS denied state does not block delivery workflow.
- Client cannot access another order location.
- Client sees rider location only after pickup.
- Office can see all online riders.

### Frontend Tests

- Rider GPS permission allowed.
- Rider GPS permission denied.
- Offline queue and reconnect.
- Office map marker update.
- Client tracking marker hidden before pickup.
- Client tracking marker visible after pickup.
- Stale marker display.

### Load Tests

Simulate:

- 200 riders online
- update every 15 seconds
- socket broadcast to office dashboard
- multiple client tracking pages

Target:

- no request backlog
- no database lock issues
- no visible frontend map lag

## Suggested Implementation Order

1. Activate rider GPS page with Start active / Stop active.
2. Harden location API validation and indexes.
3. Add adaptive browser location watcher and send interval.
4. Add PWA manifest, service worker, install prompt, and offline queue.
5. Add office live map showing all online riders.
6. Add socket room authorization for office, rider, and client map events.
7. Add client live tracking after pickup only.
8. Add stale GPS alerts for office.
9. Add monitoring/logging for 200-rider operation.
10. Review native wrapper only if app-entry tracking is not enough for operations.

## First Build Milestone

The first useful milestone should be:

- Rider can tap Start active.
- Rider app sends current GPS every 15-60 seconds depending on movement.
- Office map shows all active riders.
- Client tracking shows assigned rider only after pickup.
- GPS denied shows warning and workflow continues.
- PWA install works, with offline queueing.

## Out Of Scope For First GPS Release

- Route optimization.
- Turn-by-turn navigation.
- Automatic nearest-rider assignment.
- Long-term route replay.
- Geofencing alerts.
- Proof-of-arrival automation.
- Exact ETA engine.
- Native app background service.

The current operating model does not require an all-day native background service. Revisit it only if riders no longer open the app frequently enough during working hours.
