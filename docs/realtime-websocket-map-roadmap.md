# Realtime Websocket and Map Tracking Roadmap

## Goal

Add realtime order updates, rider location streaming, and office/client map tracking without making the core delivery workflow depend on websocket availability.

Laravel remains the source of truth. The separate Node.js socket server broadcasts changes after Laravel saves them.

## Target Architecture

```text
Client / Office / Rider app
        |
        | HTTP API
        v
Laravel API  ---->  MySQL
        |
        | server-to-server event publish
        v
Node.js Socket Server
        |
        | Socket.IO events
        v
Connected office / client / rider screens
```

## Core Principles

- Laravel owns all business rules, validation, order state, rider assignment, payments, and cash collection.
- Socket server only broadcasts events.
- If the socket server is down, the application must still work through normal HTTP API requests.
- Frontend should treat websocket events as "something changed" and refetch Laravel API data when exact state matters.
- Realtime map tracking should be opt-in and visible only for active deliveries.
- Rider location should update while the rider is on duty or working an active job, not permanently.

## Phase 1. Socket Server Hardening

### Required

- Finalize separate `socket-server` install and startup flow.
- Add production `.env` values:
  - `PORT`
  - `CORS_ORIGIN`
  - `INTERNAL_API_KEY`
  - `SOCKET_AUTH_SECRET`
  - `ALLOW_UNSIGNED_AUTH=false`
- Add process manager setup notes for production, for example PM2 or systemd.
- Add structured logging for:
  - socket connect/disconnect
  - event publish success/failure
  - auth failure
- Add graceful shutdown handling.
- Add basic rate limits for HTTP publish endpoints.

### Acceptance Check

- `npm install` works inside `socket-server`.
- `npm start` starts the server.
- `/health` returns service status.
- Unauthorized event publish calls are rejected.
- Valid event publish calls emit to expected rooms.

## Phase 2. Laravel Realtime Configuration

### Required

- Add Laravel environment values:
  - `SOCKET_SERVER_URL`
  - `SOCKET_SERVER_KEY`
  - `SOCKET_AUTH_SECRET`
  - `REALTIME_ENABLED=true`
- Add a Laravel service class, for example `RealtimeEventPublisher`.
- Publisher should use Laravel HTTP client to call the Node server.
- Publisher must fail silently/log-only if the socket server is unavailable.
- Add feature flag check so realtime can be disabled without changing code.
- Add tests proving order operations still succeed when the socket server is down.

### Acceptance Check

- Laravel can publish a test event to the socket server.
- Laravel order actions do not fail when the socket server is offline.
- Failed publish attempts are logged but do not rollback order changes.

## Phase 3. Socket Auth Token Endpoint

### Required

- Add Laravel API endpoint:
  - `GET /api/realtime/token`
- Endpoint returns a short-lived signed socket token.
- Token payload should include:
  - `role`
  - `userId`
  - `riderId` when user is a rider
  - active `orderIds` the user can watch
  - `exp`
- Office token can join the `office` room.
- Rider token can join only their rider room and assigned active order rooms.
- Client token can join only their client room and own order rooms.

### Acceptance Check

- Office, rider, and client receive valid tokens.
- Wrong-role users cannot request rooms they do not own.
- Expired tokens are rejected by the socket server.

## Phase 4. Laravel Event Publishing

### Required Events

Publish events after these Laravel actions succeed:

- Delivery request created
- Delivery request updated
- Delivery request deleted/cancelled
- Office approves/reviews order
- Rider assigned or changed
- Rider accepts job
- Rider progresses status
- Rider completes delivery
- Payment screenshot uploaded
- Payment approved/rejected
- Cash collection created/updated/confirmed
- Notification created
- Rider GPS location updated

### Suggested Event Types

| Laravel action | Socket event type |
| --- | --- |
| Order created | `order.created` |
| Order updated | `order.updated` |
| Rider assigned | `order.assigned` |
| Status changed | `order.status.updated` |
| Payment changed | `payment.updated` |
| Cash collection changed | `cash.collection.updated` |
| Notification created | `notification.created` |
| Rider location changed | `rider.location.updated` |

### Acceptance Check

- Office receives new/updated order events.
- Rider receives assignment/status events for their jobs.
- Client receives events for their own orders only.
- Cash collection and report screens can refresh after related events.

## Phase 5. Frontend Socket Client

### Required

- Install `socket.io-client` in the Laravel frontend app.
- Add a small realtime client module, for example `resources/js/realtime.js`.
- Fetch `/api/realtime/token` after login/session load.
- Connect to `SOCKET_SERVER_URL`.
- Listen for:
  - `socket:ready`
  - `order:created`
  - `order:updated`
  - `order:assigned`
  - `order:status-updated`
  - `cash-collection:updated`
  - `rider:location-updated`
  - `notification:created`
- Refetch affected API data after important events.
- Show a quiet offline/reconnecting state only when useful.

### Acceptance Check

- Office order table updates without page refresh.
- Rider receives assigned job without page refresh.
- Client tracking status updates without page refresh.
- App continues working if websocket connection fails.

## Phase 6. Rider Location Capture

### Required

- Add rider location tracking UI permission flow.
- Use browser Geolocation API in rider portal.
- Only track when:
  - rider is logged in
  - rider has active assigned job, or rider manually enables duty tracking
- Send location to Laravel API at a safe interval, for example 15-30 seconds during active job.
- Store:
  - rider id
  - latitude
  - longitude
  - accuracy
  - heading
  - speed
  - battery info if available
  - captured timestamp
- Publish `rider.location.updated` after Laravel saves location.

### Acceptance Check

- Rider can allow/deny location permission.
- Location is stored only for authenticated rider.
- Rider cannot update another rider's location.
- Office receives realtime rider location updates.

## Phase 7. Realtime Office Map

### Required

- Choose map provider:
  - Leaflet + OpenStreetMap for lower cost/simple setup
  - Google Maps for commercial-grade search/routing
  - Mapbox if custom styling is important
- Replace static office map preview with real map component.
- Show active riders as markers.
- Marker popup should show:
  - rider name
  - status
  - active order count
  - last location timestamp
- Show stale marker state when location is old, for example older than 2 minutes.
- Allow clicking a rider marker to filter/open assigned orders.

### Acceptance Check

- Office map renders active rider markers.
- Rider marker moves when location event arrives.
- Stale rider location is visually clear.
- Map still loads with no active riders.

## Phase 8. Client Tracking Map

### Required

- Replace client static tracking map with real status map.
- Show pickup and delivery points if geocoded coordinates exist.
- Show rider marker only after rider is assigned and location is available.
- Hide exact rider location after order is completed/cancelled.
- Show text fallback when coordinates are missing.

### Acceptance Check

- Client can see assigned rider movement for their own active order.
- Client cannot subscribe to another client's order room.
- Completed delivery stops showing live rider movement.

## Phase 9. Coordinate and Geocoding Model

### Required

- Add optional coordinates to pickup and receiver addresses:
  - pickup latitude/longitude
  - delivery latitude/longitude
- Add UI to set coordinates later through map pin or geocoding.
- Avoid blocking order creation when coordinates are absent.
- Keep address text as the required source of truth.

### Acceptance Check

- Existing orders without coordinates still work.
- New orders can store coordinates when available.
- Map components gracefully handle missing coordinates.

## Phase 10. Push Notification Preparation

### Required

- Keep websocket for active in-app realtime updates.
- Prepare Firebase Cloud Messaging for background/offline push later.
- Add future data model:
  - user id
  - device token
  - platform
  - last used timestamp
- Decide which events deserve push notifications:
  - rider assignment
  - order approved/rejected
  - delivery completed
  - payment approved/rejected
  - urgent delivery issue

### Acceptance Check

- Realtime websocket flow remains separate from FCM.
- Push notifications are not required for websocket map tracking.

## Security Checklist

- Use HTTPS/WSS in production.
- Disable unsigned socket auth in production.
- Use short-lived socket tokens.
- Never trust client-provided room ids without Laravel authorization.
- Do not expose internal publish API publicly without firewall/API key protection.
- Rate limit publish endpoints.
- Validate event payload shape.
- Log suspicious auth failures.

## Deployment Checklist

- Run Laravel app separately.
- Run Node socket server separately.
- Use process manager for socket server.
- Put socket server behind reverse proxy if needed.
- Use `wss://` endpoint in production.
- Configure allowed CORS origins.
- Monitor:
  - active sockets
  - event publish failures
  - connection errors
  - location update volume

## Suggested Implementation Order

1. Finish and verify standalone socket server install/start.
2. Add Laravel `RealtimeEventPublisher` with feature flag and safe failure behavior.
3. Add Laravel `/api/realtime/token`.
4. Publish order assignment and status update events.
5. Add frontend socket client and refetch-on-event behavior.
6. Add rider geolocation capture and API save.
7. Add office realtime map.
8. Add client order tracking map.
9. Add coordinate/geocoding improvements.
10. Add FCM push notification support later.

## Out of Scope for First Realtime Release

- Automatic rider assignment
- Distance-based fee calculation
- Route optimization
- Turn-by-turn navigation
- Offline map caching
- Advanced fleet analytics
- Push notification delivery guarantees
