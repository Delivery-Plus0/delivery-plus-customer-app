# Customer app — UI / E2E tests (Maestro)

Real UI automation: Maestro drives the app's own screens; nothing is mocked. The backend is the
isolated E2E stack from the `delivery-plus` repo with deterministic seed data.

```text
seed:e2e (deterministic data) → E2E stack (gateway :3100, own DB/Redis/Kafka/S3 volumes)
  → app web build (EXPO_PUBLIC_API_BASE_URL=http://localhost:3100) served on :8083
  → Maestro (Chromium) → UI actions + assertions → JUnit + screenshots in e2e/.artifacts/
```

## Run locally

Prerequisites: Docker, Node 20.19+/22, Java 17+, and the Maestro CLI (`maestro --version`, 2.11+).

```bash
# 1. Backend E2E environment (in ../delivery-plus)
npm run e2e:env:up        # docker compose -p delivery-plus-e2e … (fresh, isolated volumes)
npm run seed:e2e          # writes ../delivery-plus/e2e-seed-manifest.json
# or all three steps from scratch: npm run e2e:env:reset

# 2. UI tests (in this repo)
npm run e2e:smoke -- --build            # --build re-exports the web app against :3100
npm run e2e:all -- --headless           # smoke + regression + business
```

`--build` always exports with `--clear`: a warm Metro cache can keep a previously inlined
`EXPO_PUBLIC_API_BASE_URL` and silently point the build at the dev gateway.

Tear down with `npm run e2e:env:down` (in `delivery-plus`; removes the E2E volumes).

## Suites

| Suite | Flows | Runs in CI |
| --- | --- | --- |
| `smoke` | login → Home · search → restaurant → menu · add → change quantity → total · cart → checkout → order | every PR |
| `regression` | ready order shows "Finding a driver" · declined payment shows Failed · another customer's order is refused · gateway outage shows offline state and recovers without losing the session | nightly / manual |
| `business` | full cycle: customer orders in the UI → restaurant prepares/readies → dispatch → driver picks up/starts/delivers → customer sees Delivered + the confirmation notification | nightly / manual |

## Test data (from `npm run seed:e2e`)

| Account | Role | Use |
| --- | --- | --- |
| `qa.customer@delivery-plus.test` | CUSTOMER | signs in to the app in every flow |
| `qa.customer2@delivery-plus.test` | CUSTOMER | owns the order the QA customer must not see |
| `qa.restaurant@delivery-plus.test` | RESTAURANT_OWNER | owns QA Kitchen (OPEN) and QA Night Cafe (CLOSED) |
| `qa.driver@delivery-plus.test` | DRIVER | delivers in the business flow |

Password: `E2E_PASSWORD` (test-only default `Qa-Only-Passw0rd!`; the seed refuses non-localhost
targets unless `E2E_ALLOW_REMOTE=1`). Menu (QA Kitchen): QA Burger $10.00, QA Pasta $12.50, QA Fries
$4.00, QA Soup (sold out), QA Lemonade $3.00. Seeded orders: S1 delivered, S2 payment declined,
S3 ready for pickup without a delivery, S4 confirmed for the other customer. Payments always succeed
in the E2E stack (`PAYMENT_SUCCESS_RATE=1`) so UI checkout is deterministic.

## How flows interact with things the app can't do

`e2e/scripts/run.mjs` hosts a small control server on `:8090`. Flows call it with
`runScript: ../../scripts/control.js` to:

- act as the **restaurant** (prepare, ready, dispatch) and **driver** (pickup, start, complete)
  through the real gateway. These are **stand-ins** because no restaurant or driver client exists
  yet; replace each with a Maestro flow in that client once it exists.
- stop/start the E2E gateway container (offline-recovery flow).

Between flows the runner clears `ratelimit:*` keys in the E2E Redis only, so repeated sign-ins
don't hit the 5/min login limit.

## Selectors

Controls carry `testID` and `nativeID` with the same value (see the shared UI components). Maestro's
`id:` matches `testID` on Android/iOS and the HTML `id` on web (react-native-web renders
`nativeID` as `id`; `testID` becomes `data-testid`, which Maestro's web driver ranks below
`aria-label`). Text selectors are regular expressions: escape `$`, `.`, `?`.

## Adding a flow

1. Put it under `flows/<suite>/`, start with `runFlow: ../_shared/login.yaml`.
2. Prefer `id:` selectors; add a `testID` (+ `nativeID`) to the component if needed.
3. Scroll with `scrollUntilVisible` before asserting on anything below the fold (the test viewport is
   ~1000×616), especially before `assertNotVisible`.
4. Register it in `SUITES` in `scripts/run.mjs`.

## Not covered yet

- Android emulator / iOS simulator runs: the flows use platform-neutral `id:` selectors, but the
  runner, CI job and deep-link handling (`openLink` to `customermobile://…`) are web-only today.
- Restaurant and driver UI tests: those clients don't exist.
