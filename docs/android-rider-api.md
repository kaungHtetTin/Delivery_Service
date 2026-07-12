# Android Rider API Documentation

This document describes the REST API and realtime socket contract for the native Android rider application.

The Android rider app should match the current rider webapp behavior: jobs, history, GPS duty tracking, notifications, and account/device setup. The API is designed so the Android app can use mobile-ready payloads instead of re-mapping the raw web dashboard response.

## Environments

Use the Laravel API base URL for all REST calls.

```text
Production API base URL: https://your-domain.com/api
Local API base URL:      http://10.0.2.2/delivery/public/api
Socket URL:             returned by app_config.socket_url
Socket path:            /socket.io
```

For Android emulator, `10.0.2.2` points to the host machine. For a real device on the same network, use your computer LAN IP or deployed HTTPS domain.

## Authentication

The Android app uses Laravel Sanctum bearer tokens.

Send the token on every protected API request:

```http
Authorization: Bearer {token}
Accept: application/json
Content-Type: application/json
```

For file uploads, omit `Content-Type`; Android/OkHttp should set the multipart boundary.

### Login

```http
POST /api/android/rider/auth/token
```

Authenticates only rider accounts. Client, office, and super admin accounts are rejected.

Request:

```json
{
  "email": "rider@example.com",
  "password": "password",
  "device_name": "Samsung A55 Rider App",
  "fcm_token": "optional-firebase-token"
}
```

Response `200`:

```json
{
  "token_type": "Bearer",
  "token": "1|plain-text-sanctum-token",
  "user": {
    "id": 8,
    "name": "Aung Rider",
    "email": "rider@example.com",
    "phone": "09 111 222 333",
    "role": "rider",
    "profile_photo_url": "https://your-domain.com/storage/profiles/rider.jpg"
  },
  "rider": {
    "id": 2,
    "code": "R-001",
    "name": "Aung Rider",
    "initials": "AR",
    "phone": "09 111 222 333",
    "email": "rider@example.com",
    "status": "available",
    "status_label": "Available",
    "vehicle_type": "motorbike",
    "vehicle_label": "Motorbike",
    "current_area": "Yankin",
    "cash_held": 4500,
    "last_active_at": "2026-07-12T10:00:00+06:30",
    "last_active_label": "2026-07-12 10:00:00",
    "current_location": null,
    "profile_photo_url": "https://your-domain.com/storage/profiles/rider.jpg"
  },
  "app_config": {
    "app_name": "FlowDrop Delivery",
    "portal_name": "Rider",
    "brand_color": "#087f74",
    "app_icon_url": "https://your-domain.com/pwa-icon-192.png",
    "map_tile_url": "https://your-domain.com/map-tiles/{z}/{x}/{y}",
    "socket_enabled": true,
    "socket_url": "https://delivery-socket.example.com",
    "socket_path": "/socket.io",
    "socket_token_endpoint": "https://your-domain.com/api/realtime/token",
    "gps": {
      "active_statuses": ["online", "available", "busy"],
      "moving_interval_seconds": 15,
      "stationary_interval_seconds": 45,
      "stale_after_seconds": 120
    },
    "tabs": [
      {"key": "jobs", "label": "Jobs", "icon": "box"},
      {"key": "history", "label": "History", "icon": "clock"},
      {"key": "gps", "label": "GPS", "icon": "location"},
      {"key": "notifications", "label": "Alerts", "icon": "bell"},
      {"key": "account", "label": "Account", "icon": "user"}
    ]
  }
}
```

Common errors:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["This account is not a rider account."]
  }
}
```

## App Bootstrap

```http
GET /api/android/rider/bootstrap
Authorization: Bearer {token}
```

Use this after app launch, after login, and after returning from long background periods. It gives the current rider profile, dashboard counters, and app configuration.

Response `200`:

```json
{
  "user": {},
  "rider": {},
  "summary": {
    "active_jobs": 2,
    "history_jobs": 18,
    "completed_jobs": 15,
    "delivery_fees_total": 56000,
    "cash_held": 4500,
    "unread_notifications": 3
  },
  "app_config": {}
}
```

Recommended Android behavior:

- Store `token` securely using encrypted storage.
- Cache `app_config` locally.
- Refresh bootstrap when opening the app.
- Use `summary.active_jobs` and `summary.unread_notifications` for bottom navigation badges.

## Rider Jobs

### List Jobs

```http
GET /api/android/rider/jobs?scope=active&page=1&per_page=15
Authorization: Bearer {token}
```

Query parameters:

| Name | Required | Values | Description |
| --- | --- | --- | --- |
| `scope` | No | `active`, `history` | Defaults to `active`. |
| `status` | No | any delivery status | Optional status filter. |
| `page` | No | integer | Pagination page. |
| `per_page` | No | 1-100 | Defaults to 15. |

Active statuses are every status except `completed`, `failed`, and `cancelled`.

History statuses are `completed`, `failed`, and `cancelled`.

Response `200`:

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 31,
      "code": "FD-260712-ABCD",
      "status": "rider_assigned",
      "status_label": "Rider Assigned",
      "is_history": false,
      "next_action": {
        "label": "Confirm Accept",
        "status": "rider_accepted"
      },
      "can_report_issue": true,
      "created_at": "2026-07-12T09:20:00+06:30",
      "updated_at": "2026-07-12T09:35:00+06:30",
      "assigned_at": "2026-07-12T09:35:00+06:30",
      "picked_up_at": null,
      "delivered_at": null,
      "completed_at": null,
      "client": {
        "name": "Moe Thandar",
        "phone": "09 774 221 890",
        "email": null
      },
      "pickup": {
        "contact_name": "Linn Fashion",
        "phone": "09 790 331 482",
        "address": "Kabar Aye Market, Yankin",
        "latitude": null,
        "longitude": null,
        "phone_uri": "tel:09790331482",
        "map_uri": "https://www.google.com/maps/search/?api=1&query=Kabar%20Aye%20Market%2C%20Yankin"
      },
      "delivery": {
        "receiver_name": "May Thu",
        "receiver_phone": "09 420 882 144",
        "address": "Sanchaung Street, Sanchaung",
        "latitude": null,
        "longitude": null,
        "phone_uri": "tel:09420882144",
        "map_uri": "https://www.google.com/maps/search/?api=1&query=Sanchaung%20Street%2C%20Sanchaung"
      },
      "package": {
        "name": "Clothing package",
        "category": "Package",
        "quantity": 1,
        "is_fragile": false,
        "note": ""
      },
      "money": {
        "delivery_fee": 3000,
        "delivery_fee_payment_method": "cash",
        "payment_status": "unpaid",
        "product_payment_method": "already_paid",
        "cod_enabled": false,
        "cod_amount": 0
      },
      "rider": {}
    }
  ],
  "first_page_url": "...",
  "from": 1,
  "last_page": 1,
  "next_page_url": null,
  "path": "https://your-domain.com/api/android/rider/jobs",
  "per_page": 15,
  "prev_page_url": null,
  "to": 1,
  "total": 1
}
```

Android UI mapping:

- Jobs tab: `scope=active`
- History tab: `scope=history`
- History filters:
  - All: `scope=history`
  - Completed: `scope=history&status=completed`
  - Failed: `scope=history&status=failed`
  - Cancelled: `scope=history&status=cancelled`

### Job Detail

```http
GET /api/android/rider/jobs/{deliveryOrder}
Authorization: Bearer {token}
```

The rider can only view jobs assigned to their rider profile.

Response `200` includes the same job object plus:

```json
{
  "status_history": [
    {
      "id": 88,
      "status": "rider_assigned",
      "status_label": "Rider Assigned",
      "actor_type": "office_admin",
      "note": null,
      "created_at": "2026-07-12T09:35:00+06:30"
    }
  ],
  "cash_collection": {
    "delivery_fee_collected": 3000,
    "product_cash_collected": 0,
    "total_cash_collected": 3000
  }
}
```

## Job Workflow

The rider workflow mirrors the web rider app.

| Current status | Button label | Next status | Requires modal |
| --- | --- | --- | --- |
| `rider_assigned` | Confirm Accept | `rider_accepted` | No |
| `rider_accepted` | Pick up | `picked_up` | Yes, destination and COD |
| `picked_up` | Delivered | `delivered` | No |
| `delivered` | Complete order | `completed` | Yes, final delivery fee |

Issue actions:

| Current statuses | Action | Status |
| --- | --- | --- |
| before `delivered` | Mark failed | `failed` |
| before `delivered` | Cancel job | `cancelled` |

### Progress Job

```http
POST /api/android/rider/jobs/{deliveryOrder}/action
Authorization: Bearer {token}
```

Accept job:

```json
{
  "status": "rider_accepted"
}
```

Mark delivered:

```json
{
  "status": "delivered"
}
```

Report failed:

```json
{
  "status": "failed",
  "note": "Receiver unavailable"
}
```

Cancel job:

```json
{
  "status": "cancelled",
  "note": "Package problem"
}
```

Pickup request:

```json
{
  "status": "picked_up",
  "receiver_name": "Daw Hnin",
  "receiver_phone": "09 555 222 777",
  "receiver_address": "Bahan Street, Yangon",
  "product_payment_method": "rider_collects",
  "cod_amount": 12500
}
```

If COD is off:

```json
{
  "status": "picked_up",
  "receiver_name": "Daw Hnin",
  "receiver_phone": "09 555 222 777",
  "receiver_address": "Bahan Street, Yangon",
  "product_payment_method": "already_paid",
  "cod_amount": 0
}
```

Complete request:

```json
{
  "status": "completed",
  "delivery_fee": 3000
}
```

Response `200`:

Returns full job detail with updated status.

Validation rules:

- `status` is required.
- `picked_up` requires `receiver_phone` and `receiver_address`.
- `completed` requires `delivery_fee`.
- Rider can only progress assigned jobs.
- Status cannot skip required workflow steps.

Example validation error:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "status": ["Cannot move delivery from rider_assigned to delivered."]
  }
}
```

## Duty And GPS

Rider duty status controls whether live GPS should be sent.

Active duty statuses:

```json
["online", "available", "busy"]
```

The Android app should send location while the rider is active and permission is granted.

Recommended GPS timing:

- Moving: every 15 seconds
- Stationary: every 45 to 60 seconds
- Send immediately after start duty
- Queue offline locations locally and retry later
- Drop locations older than 15 minutes

### Start Duty

```http
POST /api/android/rider/duty/start
Authorization: Bearer {token}
```

Response `200`:

```json
{
  "message": "Rider duty started.",
  "rider": {
    "id": 2,
    "status": "available"
  }
}
```

If the rider is already `busy`, the rider remains `busy`.

### Stop Duty

```http
POST /api/android/rider/duty/stop
Authorization: Bearer {token}
```

Response `200`:

```json
{
  "message": "Rider duty stopped.",
  "rider": {
    "id": 2,
    "status": "offline"
  }
}
```

### Send GPS Location

```http
POST /api/android/rider/locations
Authorization: Bearer {token}
```

Request:

```json
{
  "delivery_order_id": 31,
  "latitude": 16.840939,
  "longitude": 96.173526,
  "accuracy": 18,
  "speed": 4.5,
  "heading": 120,
  "battery_percent": 83,
  "recorded_at": "2026-07-12T10:05:00+06:30"
}
```

Fields:

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `delivery_order_id` | No | integer | Assigned order ID. If omitted, server auto-links to current active trackable order. |
| `latitude` | Yes | number | -90 to 90. |
| `longitude` | Yes | number | -180 to 180. |
| `accuracy` | No | number | Meters, 0 to 5000. |
| `speed` | No | number | Meters per second, 0 to 80. |
| `heading` | No | number | Degrees, 0 to 360. |
| `battery_percent` | No | integer | 0 to 100. |
| `recorded_at` | No | ISO string | Defaults to server time. |

The Android endpoint automatically sets `source` to `native`.

Response `201`:

```json
{
  "message": "Location stored.",
  "location": {
    "id": 101,
    "delivery_order_id": 31,
    "latitude": 16.840939,
    "longitude": 96.173526,
    "accuracy": 18,
    "speed": 4.5,
    "heading": 120,
    "battery_percent": 83,
    "source": "native",
    "recorded_at": "2026-07-12T10:05:00+06:30",
    "freshness": "fresh",
    "is_stale": false
  },
  "rider": {}
}
```

Duplicate locations may return `200` with:

```json
{
  "message": "Location already synced.",
  "location": {},
  "rider": {}
}
```

Important validation:

- Only rider accounts can write GPS.
- Rider can only link location to assigned orders.
- Terminal orders (`completed`, `failed`, `cancelled`) are not linked.
- `recorded_at` cannot be more than 15 minutes old.
- `recorded_at` cannot be more than 2 minutes in the future.

### GPS Event Log

```http
POST /api/android/rider/gps-events
Authorization: Bearer {token}
```

Use this to report permission problems, queue failures, and GPS warnings.

Allowed events:

```json
[
  "permission_denied",
  "position_unavailable",
  "timeout",
  "unsupported",
  "poor_accuracy",
  "offline_queued",
  "queue_flush_failed",
  "queue_flush_completed",
  "watcher_restarted"
]
```

Request:

```json
{
  "event": "permission_denied",
  "message": "Location permission denied by user.",
  "permission": "denied",
  "tracking_state": "warning",
  "queued_count": 4,
  "accuracy": null,
  "occurred_at": "2026-07-12T10:05:00+06:30"
}
```

Response `200`:

```json
{
  "message": "GPS event recorded."
}
```

## Notifications

### List Notifications

```http
GET /api/android/rider/notifications?page=1&per_page=50
Authorization: Bearer {token}
```

Response `200`:

```json
{
  "current_page": 1,
  "data": [
    {
      "id": "9d4f...",
      "title": "New delivery assignment",
      "body": "Pickup is ready for FD-260712-ABCD.",
      "kind": "new_assignment",
      "order_id": 31,
      "order_code": "FD-260712-ABCD",
      "status": null,
      "read_at": null,
      "created_at": "2026-07-12T09:35:00+06:30",
      "data": {
        "title": "New delivery assignment",
        "body": "Pickup is ready for FD-260712-ABCD.",
        "kind": "new_assignment",
        "order_id": 31,
        "order_code": "FD-260712-ABCD"
      }
    }
  ],
  "total": 1
}
```

### Mark Notification Read

```http
PATCH /api/android/rider/notifications/{notification}/read
Authorization: Bearer {token}
```

Response `200`:

```json
{
  "id": "9d4f...",
  "title": "New delivery assignment",
  "read_at": "2026-07-12T10:10:00+06:30"
}
```

## Android Device Token For FCM

The login endpoint can save the FCM token, but Android should also update it whenever Firebase refreshes the token.

### Save Device Token

```http
POST /api/android/rider/device-token
Authorization: Bearer {token}
```

Request:

```json
{
  "fcm_token": "firebase-device-token"
}
```

Response `200`:

```json
{
  "message": "Android device token saved.",
  "device": {
    "id": 12,
    "platform": "android",
    "last_seen_at": "2026-07-12T10:10:00+06:30"
  }
}
```

### Delete Device Token

```http
DELETE /api/android/rider/device-token
Authorization: Bearer {token}
```

Request:

```json
{
  "fcm_token": "firebase-device-token"
}
```

Response `200`:

```json
{
  "message": "Android device token removed."
}
```

## Account Endpoints

The Android rider app can reuse the existing user endpoints.

### Current User

```http
GET /api/user
Authorization: Bearer {token}
```

### Update Profile Without Photo

```http
PATCH /api/user
Authorization: Bearer {token}
```

Request:

```json
{
  "name": "Aung Rider",
  "email": "rider@example.com",
  "phone": "09 111 222 333",
  "current_password": "old-password",
  "password": "new-password",
  "password_confirmation": "new-password"
}
```

Password fields are optional. Only send them when changing password.

### Update Profile With Photo

```http
POST /api/user/profile
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

Multipart fields:

| Name | Required | Description |
| --- | --- | --- |
| `name` | Yes | Full name. |
| `email` | Yes | Email. |
| `phone` | Yes | Phone number. |
| `profile_photo` | No | JPG or PNG up to 2 MB. |
| `current_password` | No | Required only when changing password. |
| `password` | No | New password. |
| `password_confirmation` | No | Must match new password. |

### Logout

```http
POST /api/auth/logout
Authorization: Bearer {token}
```

Response:

```json
{
  "message": "Signed out successfully."
}
```

Android should then clear local token, cached rider data, queued auth-only work, and disconnect the socket.

## Realtime WebSocket

The Android app can use the same websocket server as the web app.

### Get Socket Token

```http
GET /api/realtime/token
Authorization: Bearer {token}
```

Response `200`:

```json
{
  "token": "base64url-payload.base64url-signature",
  "expires_at": 1783845900,
  "payload": {
    "role": "rider",
    "userId": "8",
    "riderId": "2",
    "orderIds": ["31", "32"]
  }
}
```

If realtime is not configured:

```json
{
  "message": "Realtime socket auth is not configured."
}
```

Status code: `503`

### Connect With Socket.IO

Use Android Socket.IO client. Connect to `app_config.socket_url`.

Socket auth:

```json
{
  "token": "{realtime_token}"
}
```

Socket.IO options:

```text
path: /socket.io
transports: websocket, polling
reconnection: true
```

Events to listen:

| Event | Purpose |
| --- | --- |
| `socket:ready` | Confirms connection and joined rooms. |
| `order:assigned` | New or changed rider assignment. |
| `order:updated` | Order content changed. |
| `order:status-updated` | Status changed. |
| `rider:location-updated` | Rider GPS event published. |
| `notification:created` | New notification. |

Events Android may emit:

| Event | Payload | Purpose |
| --- | --- | --- |
| `order:watch` | order ID | Join an allowed order room. Usually not required because token includes active order IDs. |
| `order:unwatch` | order ID | Leave an order room. |

Recommended event handling:

- On `order:assigned`, refetch `GET /api/android/rider/jobs?scope=active`.
- On `order:updated`, refetch changed job detail if visible.
- On `order:status-updated`, refetch job detail and bootstrap counters.
- On `notification:created`, refetch notifications or increment unread badge.
- When socket token expires, call `GET /api/realtime/token` again and reconnect.

Important server config:

Laravel `.env` and socket server `.env` must share the same value:

```dotenv
SOCKET_AUTH_SECRET=long-random-token-signing-secret
```

If the secrets differ, Android can fetch a token but the socket server will reject it.

## Shared Data Models

### Rider Object

```json
{
  "id": 2,
  "code": "R-001",
  "name": "Aung Rider",
  "initials": "AR",
  "phone": "09 111 222 333",
  "email": "rider@example.com",
  "status": "available",
  "status_label": "Available",
  "vehicle_type": "motorbike",
  "vehicle_label": "Motorbike",
  "current_area": "Yankin",
  "cash_held": 4500,
  "last_active_at": "2026-07-12T10:00:00+06:30",
  "last_active_label": "2026-07-12 10:00:00",
  "current_location": {},
  "profile_photo_url": "https://your-domain.com/storage/profiles/rider.jpg"
}
```

Rider statuses:

```json
["offline", "online", "available", "busy", "on_break", "suspended"]
```

### Location Object

```json
{
  "id": 101,
  "delivery_order_id": 31,
  "latitude": 16.840939,
  "longitude": 96.173526,
  "accuracy": 18,
  "speed": 4.5,
  "heading": 120,
  "battery_percent": 83,
  "source": "native",
  "recorded_at": "2026-07-12T10:05:00+06:30",
  "freshness": "fresh",
  "is_stale": false
}
```

Freshness values:

| Value | Meaning |
| --- | --- |
| `fresh` | Location is 30 seconds old or less. |
| `warning` | Location is between 31 and 120 seconds old. |
| `stale` | Location is older than 120 seconds. |

### Order Statuses

```json
[
  "pending",
  "approved",
  "rider_assigned",
  "rider_accepted",
  "going_to_pickup",
  "arrived_at_pickup",
  "picked_up",
  "going_to_delivery",
  "arrived_at_delivery",
  "delivered",
  "completed",
  "failed",
  "cancelled"
]
```

The current rider app uses this simplified workflow:

```text
rider_assigned -> rider_accepted -> picked_up -> delivered -> completed
```

Terminal statuses:

```json
["completed", "failed", "cancelled"]
```

## Error Handling

### 401 Unauthorized

Token is missing, invalid, or expired.

```json
{
  "message": "Unauthenticated."
}
```

Android behavior:

- Clear local token.
- Disconnect socket.
- Show login screen.

### 403 Forbidden

Account is not a rider account or rider is trying to access another rider's job.

```json
{
  "message": "This action is not available for your role."
}
```

### 404 Not Found

Record does not exist.

```json
{
  "message": "No query results for model..."
}
```

### 422 Validation Error

Request failed validation or workflow transition rule.

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "delivery_fee": ["The delivery fee field is required."]
  }
}
```

Android should display the first validation message:

```text
errors.values().first().first()
```

### 429 Too Many Requests

Rate limit exceeded, most likely GPS location writes.

```json
{
  "message": "Too Many Attempts."
}
```

Android behavior:

- Keep the GPS record in local queue.
- Retry later with backoff.

### 500 Server Error

Unexpected server error.

Android behavior:

- Do not discard important offline work.
- Show a generic retry message.
- Log the response for diagnostics.

## Android Implementation Notes

### Suggested Local Storage

Store:

- API bearer token
- user object
- rider object
- app_config
- queued GPS locations
- last successful GPS sync time
- FCM token sync status

Do not store:

- password
- socket auth token after expiry

### Suggested Startup Sequence

```text
1. Read saved API token.
2. If no token, show login.
3. Call GET /api/android/rider/bootstrap.
4. Call GET /api/android/rider/jobs?scope=active.
5. Call GET /api/android/rider/notifications.
6. Call GET /api/realtime/token.
7. Connect Socket.IO.
8. If rider.status is active, start foreground GPS service.
```

### Suggested Refresh Sequence

When pull-to-refresh or socket event occurs:

```text
1. GET /api/android/rider/bootstrap
2. GET /api/android/rider/jobs?scope=active
3. If current screen is detail, GET /api/android/rider/jobs/{id}
4. GET /api/android/rider/notifications if badge changed
```

### Offline GPS Queue

Each queued record should contain:

```json
{
  "local_id": "uuid",
  "delivery_order_id": 31,
  "latitude": 16.840939,
  "longitude": 96.173526,
  "accuracy": 18,
  "speed": 4.5,
  "heading": 120,
  "battery_percent": 83,
  "recorded_at": "2026-07-12T10:05:00+06:30",
  "attempts": 0
}
```

Flush rules:

- Flush oldest first.
- Remove record after API success.
- Remove record after `422` if invalid timestamp, invalid coordinates, or invalid order link.
- Keep record after network errors, `429`, or `5xx`.
- Report `queue_flush_failed` or `queue_flush_completed` through `/gps-events`.

### Android Permissions

Required permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

For Android 10 and above, request background location separately after foreground permission is granted.

For Android 13 and above, request notification permission before showing foreground service notifications.

### Recommended Headers

For JSON:

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer {token}
```

For multipart:

```http
Accept: application/json
Authorization: Bearer {token}
```

### Recommended Date Format

Send ISO 8601:

```text
2026-07-12T10:05:00+06:30
```

UTC is also accepted:

```text
2026-07-12T03:35:00Z
```

## Minimal API Checklist

Required for first Android rider release:

- `POST /api/android/rider/auth/token`
- `GET /api/android/rider/bootstrap`
- `GET /api/android/rider/jobs?scope=active`
- `GET /api/android/rider/jobs?scope=history`
- `GET /api/android/rider/jobs/{deliveryOrder}`
- `POST /api/android/rider/jobs/{deliveryOrder}/action`
- `POST /api/android/rider/duty/start`
- `POST /api/android/rider/duty/stop`
- `POST /api/android/rider/locations`
- `POST /api/android/rider/gps-events`
- `GET /api/android/rider/notifications`
- `PATCH /api/android/rider/notifications/{notification}/read`
- `POST /api/android/rider/device-token`
- `GET /api/realtime/token`
- Socket.IO connection to `app_config.socket_url`
- `POST /api/auth/logout`
