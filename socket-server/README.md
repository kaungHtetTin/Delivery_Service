# FlowDrop Socket Server

Standalone Node.js websocket service for FlowDrop Delivery. It is intentionally separate from the Laravel app so it can run, scale, and deploy independently.

## What It Provides

- Socket.IO server for browser/mobile realtime updates
- Office, rider, client, user, and order rooms
- HTTP publish endpoint for Laravel/server-to-server events
- HMAC-signed socket auth token support
- Development-only unsigned socket auth option
- Structured JSON logs for connections, auth failures, publish results, and shutdown
- Basic publish endpoint rate limiting

## Install

```powershell
cd socket-server
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Update `.env` before using it outside local development:

```dotenv
PORT=3000
CORS_ORIGIN=http://localhost,http://127.0.0.1,http://localhost:80,http://127.0.0.1:80,http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173
INTERNAL_API_KEY=change-this-in-production
SOCKET_AUTH_SECRET=change-this-signing-secret
ALLOW_UNSIGNED_AUTH=true
PUBLISH_RATE_LIMIT=120
PUBLISH_RATE_WINDOW_MS=60000
```

## Run

```powershell
npm run dev
```

Production-style:

```powershell
npm start
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Test:

```powershell
npm test
```

## Production Environment

Use strong, different secrets for the internal publish key and socket token signing secret:

```dotenv
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.example
INTERNAL_API_KEY=long-random-server-to-server-key
SOCKET_AUTH_SECRET=long-random-token-signing-secret
ALLOW_UNSIGNED_AUTH=false
PUBLISH_RATE_LIMIT=120
PUBLISH_RATE_WINDOW_MS=60000
```

When `NODE_ENV=production`, the status page shows a configuration warning if unsigned auth is enabled or required secrets are missing.

For Hostinger Node.js hosting, set the entry file to:

```text
app.js
```

`src/server.js` exports the server for tests and local tooling. `app.js` calls `start()` directly so Hostinger can detect `listen()` during startup.

## CORS

`CORS_ORIGIN` is a comma-separated allowlist of browser origins. Use only the origin part, not the full page path:

```dotenv
# Good for XAMPP pages served at http://localhost/delivery/public
CORS_ORIGIN=http://localhost,http://127.0.0.1

# Good for Laravel dev server and Vite dev server
CORS_ORIGIN=http://127.0.0.1:8000,http://localhost:8000,http://localhost:5173
```

For local debugging only, an empty value or `*` allows any origin. In production, set exact HTTPS origins and keep `ALLOW_UNSIGNED_AUTH=false`.

## Process Manager Examples

PM2:

```powershell
cd socket-server
pm2 start app.js --name flowdrop-socket
pm2 save
```

systemd example:

```ini
[Unit]
Description=FlowDrop Socket Server
After=network.target

[Service]
WorkingDirectory=/var/www/delivery/socket-server
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Publish Events From Laravel

Laravel can call the socket server after an order, rider location, notification, or cash collection changes.

```http
POST http://127.0.0.1:3000/events
X-Socket-Server-Key: change-this-in-production
Content-Type: application/json
```

Example body:

```json
{
  "type": "order.status.updated",
  "data": {
    "id": 12,
    "order_id": 12,
    "code": "FD-260623-2EN9",
    "status": "picked_up",
    "client_user_id": 4,
    "rider_id": 2
  }
}
```

The server emits to:

- `office`
- `order:{order_id}`
- `client:{client_user_id}`
- `rider:{rider_id}`

Shortcut endpoints are also available:

- `POST /events/order-updated`
- `POST /events/payment`
- `POST /events/cash-collection`
- `POST /events/rider-location`
- `POST /events/notification`

All require `X-Socket-Server-Key`.

## Browser Connection

Install the client in the Laravel frontend later:

```powershell
npm install socket.io-client
```

Development unsigned auth example:

```js
import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:3000", {
  auth: {
    role: "office"
  }
});

socket.on("socket:ready", console.log);
socket.on("order:status-updated", (event) => {
  console.log("Order status changed", event);
});
```

For rider/client views:

```js
const socket = io("http://127.0.0.1:3000", {
  auth: {
    role: "rider",
    userId: "8",
    riderId: "2",
    orderIds: ["12"]
  }
});
```

## Signed Auth Tokens

For staging/production, set:

```dotenv
ALLOW_UNSIGNED_AUTH=false
SOCKET_AUTH_SECRET=long-random-secret
```

Laravel should generate a short-lived token with this payload shape:

```json
{
  "role": "client",
  "userId": "4",
  "orderIds": ["12"],
  "exp": 1782222000
}
```

Token format:

```text
base64url(json_payload).base64url(hmac_sha256(encoded_payload, SOCKET_AUTH_SECRET))
```

The socket server includes `POST /tokens/development` for local token testing only. It is disabled when `NODE_ENV=production`.

## Event Names

Known domain event mappings:

| Publish type | Socket event |
| --- | --- |
| `order.created` | `order:created` |
| `order.updated` | `order:updated` |
| `order.assigned` | `order:assigned` |
| `order.status.updated` | `order:status-updated` |
| `payment.updated` | `payment:updated` |
| `cash.collection.updated` | `cash-collection:updated` |
| `rider.location.updated` | `rider:location-updated` |
| `notification.created` | `notification:created` |

Unknown publish types are emitted as-is.

## Notes

- This service does not read the Laravel database.
- This service does not replace Laravel notifications; it only broadcasts fresh events.
- Laravel remains the source of truth for orders, riders, payments, and cash collections.
- Clients should still refetch the API after receiving important events if exact state matters.
- The server handles `SIGINT` and `SIGTERM` by closing Socket.IO and HTTP connections gracefully.
