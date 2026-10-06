# Delivery Plus — Customer App

The customer-facing client of **Delivery Plus**, a food-delivery platform. Customers browse restaurants, build a cart, check out, pay and follow their order until it's delivered.

Built with **Expo 57 / React Native 0.86 / Expo Router / TypeScript**, and runs on Android, iOS and the web. The app talks only to the Delivery Plus API gateway. The backend (12 NestJS services, PostgreSQL, Redis, Kafka) lives in [Yousefa7medmaher/delivery-plus](https://github.com/Yousefa7medmaher/delivery-plus).

## Features

| Area | What works |
| --- | --- |
| Account | Sign up, sign in (one request per submit, actionable errors), profile with avatar and delivery address |
| Browse | Restaurant list and search, restaurant page with menu |
| Cart and checkout | One-restaurant cart, quantity changes, checkout with order + payment (idempotency keys, so retries never double-charge) |
| Orders | Order history and detail, live status and delivery stages (polling every 10 s while active), cancel while allowed |
| Driver on the map | While a delivery is in progress the order screen shows a street map with the driver's pin, labelled **Live** or **Last known location** (see below) |
| Notifications | In-app notifications with an unread badge, one per order stage |

The drop-off address comes from the customer's profile at checkout (the backend copies it onto the order). Dispatch is automatic on the backend, so the delivery card goes from "Finding a driver" to "Driver assigned" by itself.

### Driver tracking on the order screen

The "Driver location" card follows the backend's tracking state (`GET /api/tracking/delivery/:id`, see the backend's `docs/services/tracking-service.md`). The state is the only input; the app never guesses it from a missing location:

| Backend `tracking` | The card shows |
| --- | --- |
| `NO_DRIVER` | "Finding a driver", no map |
| `AWAITING_LOCATION` | "Driver assigned · Waiting for location…", no map |
| `LIVE` | "Live · Updated 8 s ago", map with a red **Driver** pin at the reported position |
| `STALE` (no report for over 60 s) | "Last known location · Updated 4 min ago", dimmed map with a grey pin |
| `ENDED` (delivered or cancelled) | nothing: the card and the driver's position are gone |

- **Bad data:** invalid or missing coordinates show "location unavailable" and no pin.
- **Failed refresh** (offline, timeout or server error): the last position stays on screen as **Last known location · reconnecting…**, never as "Live".
- **The map:** OpenStreetMap raster tiles drawn with `expo-image`, centred on the driver, so there is no native map SDK, no API key and the same behaviour on every platform.
  - If tiles fail to load, the pin and the status still show.
  - Set `EXPO_PUBLIC_MAP_TILE_URL` to a proper tile provider in production.
  - There is no route, ETA or animated movement: the pin is exactly where the driver last reported.
- **Polling:** the order screen polls tracking every 10 s while focused, through the shared resource cache, and stops once the backend says `ENDED`. Real-time push (SSE/WebSocket, with this polling as fallback) is Phase 7 Step 3 and will replace the transport inside `useDeliveryTracking` only.

## Getting started

Requirements: Node.js 22, and the backend dev stack running locally (see the backend README; the gateway listens on `http://localhost:3000`).

```bash
cp .env.example .env.local     # EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
npm ci
npm run web                    # or: npm start  (Expo Go / emulator)
```

On an Android emulator use `http://10.0.2.2:3000`; on a physical device use your machine's LAN IP. Development builds show the API URL on the sign-in screen.

Demo account (after `npm run seed:demo` in the backend): `demo.customer@example.com` / `password123`.

## Project structure

```text
src/
├── app/            Expo Router screens: (auth) welcome·sign-in·sign-up, (app)/(tabs) home·orders·notifications·profile, checkout, order/[id], restaurant/[id]
├── components/     UI building blocks (cards, delivery card, form inputs, alerts)
├── services/       API client (api.ts: timeouts, auth header, error mapping) and one module per backend resource
├── state/          Data hooks on top of useResource (cart, orders, deliveries, notifications, catalog, profile)
├── hooks/          useResource (cache, polling, in-flight dedupe), theme and debounce hooks
├── config/         API base URL
├── utils/          Formatting and small pure helpers (unit-tested)
└── test/           Test setup
e2e/                Maestro flows (smoke, regression, business) and the runner
.project-context/   Architecture and contract notes for contributors and AI agents
planning.md         Status, current sprint and roadmap for the app and the backend it depends on
```

## Testing

| Level | Command |
| --- | --- |
| Typecheck | `npm run typecheck` |
| Lint (zero warnings) | `npm run lint` |
| Unit tests (vitest) | `npm test` |
| UI / E2E (Maestro, web) | `node e2e/scripts/run.mjs --suite smoke --build --headless` against the backend's isolated E2E stack (`npm run e2e:env:reset` in the backend repo) |

The E2E suites cover the customer journey (smoke), failure paths, authorization and offline recovery (regression), and the full order → delivery cycle (business). See [e2e/README.md](e2e/README.md).

## CI

| Workflow | What it proves |
| --- | --- |
| CI | `npm ci`, typecheck, lint, unit tests, web export (catches broken imports and render-time errors) |
| E2E (Maestro) | Pull requests: smoke suite against the backend E2E stack. Nightly and manual: every suite |
| Security | `npm audit` (blocks on critical) and a Trivy filesystem/secret scan |

## Branches and contributing

`dev` is the default branch; `testing` is protected; `main` holds releases. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

See [LICENSE](LICENSE).
