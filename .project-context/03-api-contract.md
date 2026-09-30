# API contract summary for the customer app

## Base API

- base URL: `http://localhost:3000`
- all customer-facing routes begin with `/api`
- bearer JWT is sent for protected routes
- errors are NestJS-style payloads with `statusCode`, `error`, and `message`

## Auth routes

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | Body: `{ email, password, fullName, phone?, role? }` |
| POST | `/api/auth/login` | none | Body: `{ email, password }` |
| GET | `/api/auth/me` | Bearer JWT | Returns JWT payload `{ sub, email, role }` |

Successful auth response:

```json
{
  "accessToken": "<jwt>",
  "userId": "<uuid>",
  "email": "customer@example.com",
  "role": "CUSTOMER"
}
```

## Restaurants and menu

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/restaurants` | none | list restaurants |
| GET | `/api/restaurants/:id` | none | restaurant detail |
| GET | `/api/menus/restaurants/:id/menu` | none | restaurant menu |
| GET | `/api/menus/menu-items/:id` | none | menu item detail |

## Cart and order

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/cart` | Bearer JWT | current cart |
| POST | `/api/cart/items` | Bearer JWT | add item to cart |
| PATCH | `/api/cart/items/:id` | Bearer JWT | update item quantity |
| DELETE | `/api/cart/items/:id` | Bearer JWT | remove item |
| POST | `/api/orders` | Bearer JWT | create order from current cart |
| GET | `/api/orders` | Bearer JWT | customer orders |
| GET | `/api/orders/:id` | Bearer JWT | order detail |
| PATCH | `/api/orders/:id/status` | Bearer JWT | customer may send `{ status: "CANCELLED" }` on their own order (role + ownership checked) |

## Payment and delivery

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/payments` | Bearer JWT | create payment |
| POST | `/api/payments/:id/process` | Bearer JWT | simulate processing |
| GET | `/api/payments/:id` | Bearer JWT | payment detail |
| GET | `/api/deliveries/:id` | Bearer JWT | delivery detail |
| GET | `/api/tracking/delivery/:id` | Bearer JWT | tracking detail for a delivery |

**Gap — delivery tracking is not reachable from the customer app yet.** Both delivery routes take a
*delivery* id, but `Order` has no `deliveryId` and there is no public "delivery by order" lookup, so the
app cannot find the delivery for an order. Needs a backend route (e.g. `GET /api/deliveries/by-order/:orderId`)
or a `deliveryId` on the order payload before tracking UI can be built.

## Notifications and profile

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/notifications?page&limit` | Bearer JWT | paginated list `{ items, page, limit, total, totalPages }`, newest first |
| PATCH | `/api/notifications/:id/read` | Bearer JWT | mark one as read |
| PATCH | `/api/notifications/read-all` | Bearer JWT | mark all as read |
| GET | `/api/users/me` | Bearer JWT | profile `{ id, email, fullName, phone?, address?, avatarUrl? }` |
| PATCH | `/api/users/me` | Bearer JWT | update `{ fullName?, phone?, address? }` |
| GET | `/api/auth/me` | Bearer JWT | current JWT payload `{ sub, email, role }` |

There is no `GET /api/notifications/:id` and no unread-count endpoint; the app counts unread items on the loaded pages.

## API conventions the app should enforce

- use the Gateway at `http://localhost:3000` only
- attach `Authorization: Bearer <token>` to protected routes
- normalize backend errors into app-friendly texts
- treat `401` on an authenticated request as a session-expired problem and clear the client session (a `401` from login just means bad credentials)
- NestJS validation errors return `message` as a `string[]`; join them rather than discarding them
- keep feature service modules typed to the backend’s real response shapes
- never assume direct service responses or undocumented fields

## Current service mapping for the product

- restaurant discovery -> restaurant-service
- menu browsing -> menu-service
- cart -> cart-service
- orders -> order-service
- payment -> payment-service
- delivery/tracking -> delivery-service + tracking-service
- notifications -> notification-service
- identity -> auth-service + user-service
