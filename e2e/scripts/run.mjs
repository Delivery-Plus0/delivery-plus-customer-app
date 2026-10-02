#!/usr/bin/env node
// Runs the Maestro UI suites against the isolated E2E backend (delivery-plus: `npm run e2e:env:up`
// + `npm run seed:e2e`). See e2e/README.md.
//
//   node e2e/scripts/run.mjs --suite smoke|regression|business|all [--build] [--headless]
//
// Env: E2E_API_URL (http://localhost:3100), E2E_WEB_PORT (8083), E2E_CONTROL_PORT (8090),
//      E2E_MANIFEST (../delivery-plus/e2e-seed-manifest.json), MAESTRO_BIN (maestro),
//      E2E_COMPOSE_PROJECT (delivery-plus-e2e)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = resolve(E2E_DIR, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const suite = option('suite', 'smoke');
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3100';
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 8083);
const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT ?? 8090);
const APP_URL = `http://localhost:${WEB_PORT}`;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;
const MANIFEST = resolve(process.env.E2E_MANIFEST ?? join(APP_DIR, '..', 'delivery-plus', 'e2e-seed-manifest.json'));
const MAESTRO = process.env.MAESTRO_BIN ?? 'maestro';
const PROJECT = process.env.E2E_COMPOSE_PROJECT ?? 'delivery-plus-e2e';
const WEB_BUILD = join(E2E_DIR, '.web-build');
const SCREEN_SIZE = process.env.E2E_SCREEN_SIZE ?? '430x1600';
const ARTIFACTS = join(E2E_DIR, '.artifacts', suite);

const SUITES = {
  smoke: ['smoke/01-login.yaml', 'smoke/02-browse.yaml', 'smoke/03-cart.yaml', 'smoke/04-checkout.yaml'],
  regression: [
    'regression/order-awaiting-driver.yaml',
    'regression/order-payment-failed.yaml',
    'regression/unauthorized-order.yaml',
    'regression/offline-recovery.yaml',
  ],
  business: ['business/customer-order-lifecycle.yaml'],
};
SUITES.all = [...SUITES.smoke, ...SUITES.regression, ...SUITES.business];

if (!SUITES[suite]) {
  console.error(`Unknown suite "${suite}". Use one of: ${Object.keys(SUITES).join(', ')}`);
  process.exit(2);
}
if (!existsSync(MANIFEST)) {
  console.error(`No seed manifest at ${MANIFEST}. Run \`npm run seed:e2e\` in delivery-plus first.`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

// ---------------------------------------------------------------------------------------------
// Gateway client used by the control server (restaurant/driver stand-ins).
// ---------------------------------------------------------------------------------------------

async function api(method, path, token, body) {
  const res = await fetch(API_URL + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return data;
}

async function login(email) {
  resetRateLimits();
  return (await api('POST', '/api/auth/login', null, { email, password: manifest.password })).accessToken;
}

// Stand-in state for the restaurant/driver side of one order at a time.
const state = { orderId: null, deliveryId: null };

async function latestKitchenOrder(owner, status) {
  const restaurantId = manifest.restaurants['QA Kitchen'];
  const { items } = await api('GET', `/api/orders/restaurant/${restaurantId}?limit=50`, owner);
  const matching = items.filter((order) => order.status === status);
  matching.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!matching[0]) throw new Error(`No ${status} order at QA Kitchen`);
  return matching[0];
}

/** The QA driver's active delivery (GET /deliveries/me/current answers 204 → null when none). */
async function currentDeliveryId(driver) {
  const current = await api('GET', '/api/deliveries/me/current', driver);
  if (!current) throw new Error('The QA driver has no active delivery');
  if (state.orderId && current.orderId !== state.orderId) {
    throw new Error(`The QA driver is on order ${current.orderId}, expected ${state.orderId}`);
  }
  state.deliveryId = current.id;
  return current.id;
}

async function waitForOrderStatus(orderId, token, status, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const order = await api('GET', `/api/orders/${orderId}`, token);
    if (order.status === status) return order;
    if (Date.now() > deadline) throw new Error(`Order ${orderId} did not reach ${status} (last ${order.status})`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

function container(service) {
  return `${PROJECT}-${service}-1`;
}

function docker(...cmd) {
  return execFileSync('docker', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** E2E stack only: clear per-IP/per-user rate-limit counters so repeated sign-ins across flows don't 429. */
function resetRateLimits() {
  docker(
    'exec',
    container('redis'),
    'redis-cli',
    'EVAL',
    "for _,k in ipairs(redis.call('KEYS','ratelimit:*')) do redis.call('DEL',k) end return 1",
    '0',
  );
}

async function waitForGateway(up, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(`${API_URL}/health`).then((r) => r.ok, () => false);
    if (ok === up) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Gateway did not become ${up ? 'healthy' : 'unreachable'} in time`);
}

const actions = {
  // RESTAURANT stand-in (qa.restaurant): accept/prepare the newest confirmed order, then mark it ready.
  'restaurant/prepare': async () => {
    const owner = await login(manifest.accounts.restaurant.email);
    const order = await latestKitchenOrder(owner, 'CONFIRMED');
    state.orderId = order.id;
    state.deliveryId = null;
    await api('PATCH', `/api/orders/${order.id}/status`, owner, { status: 'PREPARING' });
  },
  'restaurant/ready': async () => {
    const owner = await login(manifest.accounts.restaurant.email);
    await api('PATCH', `/api/orders/${state.orderId}/status`, owner, { status: 'READY_FOR_PICKUP' });
  },
  // There is no dispatch stand-in: delivery-service dispatches on order.ready_for_pickup by itself.

  // A ready order with no driver free: the QA driver must be offline first (driver/offline).
  // Placed through the API as the QA customer, then prepared and marked ready by the restaurant.
  'scenario/order-ready': async () => {
    const customer = await login(manifest.accounts.customer.email);
    const owner = await login(manifest.accounts.restaurant.email);
    await api('DELETE', '/api/cart', customer);
    await api('POST', '/api/cart/items', customer, { menuItemId: manifest.menuItems['QA Pasta'], quantity: 1 });
    const order = await api('POST', '/api/orders', customer, {});
    const payment = await api('POST', '/api/payments', customer, { orderId: order.id });
    await api('POST', `/api/payments/${payment.id}/process`, customer, { simulateFailure: false });
    await waitForOrderStatus(order.id, customer, 'CONFIRMED');
    await api('PATCH', `/api/orders/${order.id}/status`, owner, { status: 'PREPARING' });
    await api('PATCH', `/api/orders/${order.id}/status`, owner, { status: 'READY_FOR_PICKUP' });
    state.orderId = order.id;
    state.deliveryId = null;
  },
  // DRIVER stand-in (qa.driver). It finds its job the way the driver app will: GET /deliveries/me/current.
  'driver/offline': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', '/api/drivers/me/offline', driver, {});
  },
  'driver/online': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', '/api/drivers/me/online', driver, {});
  },
  'driver/pickup': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', '/api/tracking/location', driver, { latitude: 30.0444, longitude: 31.2357 });
    await api('POST', `/api/deliveries/${await currentDeliveryId(driver)}/pickup`, driver, {});
  },
  'driver/start': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', `/api/deliveries/${await currentDeliveryId(driver)}/start`, driver, {});
  },
  'driver/complete': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', `/api/deliveries/${await currentDeliveryId(driver)}/complete`, driver, {});
  },
  // Fault injection for the offline-recovery flow.
  'gateway/stop': async () => {
    docker('stop', container('api-gateway'));
    await waitForGateway(false);
  },
  'gateway/start': async () => {
    docker('start', container('api-gateway'));
    await waitForGateway(true);
  },
};

const control = createServer(async (req, res) => {
  const action = (req.url ?? '').replace(/^\//, '');
  try {
    if (req.method !== 'POST' || !actions[action]) throw Object.assign(new Error(`Unknown action ${action}`), { code: 404 });
    await actions[action]();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ action, ...state }));
  } catch (error) {
    console.error(`[control] ${action} failed:`, error.message);
    res.writeHead(error.code ?? 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message }));
  }
});

// ---------------------------------------------------------------------------------------------

function buildWeb() {
  console.log(`Building web app against ${API_URL} ...`);
  rmSync(WEB_BUILD, { recursive: true, force: true });
  // --clear matters: a warm Metro cache can keep a previously inlined EXPO_PUBLIC_API_BASE_URL.
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', WEB_BUILD, '--clear'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1', EXPO_PUBLIC_API_BASE_URL: API_URL },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * Maestro must run asynchronously: flows call back into this process's control server, so a
 * spawnSync here would block the event loop and deadlock the first runScript step.
 */
function runFlow(flow) {
  const name = flow.replace(/[\\/]/g, '__').replace(/\.yaml$/, '');
  const outDir = join(ARTIFACTS, name);
  mkdirSync(outDir, { recursive: true });
  const env = {
    APP_URL,
    CONTROL_URL,
    EMAIL: manifest.accounts.customer.email,
    PASSWORD: manifest.password,
    FAILED_ORDER_ID: manifest.orders.failed,
    OTHER_ORDER_ID: manifest.orders.otherCustomer,
  };
  const maestroArgs = [
    'test',
    join(E2E_DIR, 'flows', flow),
    '--format',
    'JUNIT',
    '--output',
    join(ARTIFACTS, `${name}.junit.xml`),
    '--test-output-dir',
    outDir,
    '--debug-output',
    outDir,
    '--flatten-debug-output',
    // Headless Chromium with a phone-width, tall viewport. Maestro's web driver cannot scroll
    // react-native-web ScrollViews (it scrolls the window; RN-Web keeps body overflow hidden), so the
    // viewport must fit each screen; scrollUntilVisible steps stay for Android/iOS runs.
    ...(flag('headless') ? ['--headless', '--screen-size', SCREEN_SIZE] : []),
    ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
  ];
  resetRateLimits();
  const started = Date.now();
  return new Promise((resolveFlow) => {
    const child = spawn(MAESTRO, maestroArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => resolveFlow({ flow, ok: code === 0, seconds: Math.round((Date.now() - started) / 1000) }));
  });
}

async function main() {
  if (flag('build') || !existsSync(join(WEB_BUILD, 'index.html'))) buildWeb();
  mkdirSync(ARTIFACTS, { recursive: true });

  await fetch(`${API_URL}/health`).then(
    (r) => { if (!r.ok) throw new Error(); },
    () => { throw new Error(`E2E gateway not reachable at ${API_URL}. Start it with \`npm run e2e:env:up\` in delivery-plus.`); },
  );

  const web = spawn(process.execPath, [join(E2E_DIR, 'scripts', 'serve-web.mjs'), WEB_BUILD, String(WEB_PORT)], { stdio: 'inherit' });
  await new Promise((r) => control.listen(CONTROL_PORT, '127.0.0.1', r));
  await new Promise((r) => setTimeout(r, 500));

  const results = [];
  try {
    for (const flow of SUITES[suite]) {
      console.log(`\n=== ${flow}`);
      results.push(await runFlow(flow));
    }
  } finally {
    // Never leave the gateway stopped if a fault-injection flow failed half-way.
    if (!(await fetch(`${API_URL}/health`).then((r) => r.ok, () => false))) await actions['gateway/start']();
    web.kill();
    control.close();
  }

  console.log(`\nSuite "${suite}" results (artifacts: ${ARTIFACTS})`);
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.flow}  (${r.seconds}s)`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} flows passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
