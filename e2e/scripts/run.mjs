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
  // Dispatch is a manual owner action today (no auto-dispatch). The QA driver is cycled
  // offline→online so delivery-service (most recently updated AVAILABLE driver) picks it.
  'restaurant/dispatch': async () => {
    const owner = await login(manifest.accounts.restaurant.email);
    const driver = await login(manifest.accounts.driver.email);
    const delivery = await api('POST', '/api/deliveries', owner, { orderId: state.orderId });
    const me = await api('GET', '/api/drivers/me', driver);
    if (me.status === 'AVAILABLE') await api('POST', '/api/drivers/me/offline', driver, {});
    await api('POST', '/api/drivers/me/online', driver, {});
    const assigned = await api('POST', `/api/deliveries/${delivery.id}/assign`, owner, {});
    if (assigned.driverId !== manifest.driverId) throw new Error(`Assigned ${assigned.driverId}, expected the QA driver`);
    state.deliveryId = delivery.id;
  },
  // DRIVER stand-in (qa.driver).
  'driver/pickup': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', '/api/tracking/location', driver, { latitude: 30.0444, longitude: 31.2357 });
    await api('POST', `/api/deliveries/${state.deliveryId}/pickup`, driver, {});
  },
  'driver/start': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', `/api/deliveries/${state.deliveryId}/start`, driver, {});
  },
  'driver/complete': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await api('POST', `/api/deliveries/${state.deliveryId}/complete`, driver, {});
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
    AWAITING_ORDER_ID: manifest.orders.awaitingDriver,
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
