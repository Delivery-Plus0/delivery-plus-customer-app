import { describe, expect, it } from 'vitest';

import type { DeliveryTracking } from '@/services/tracking';

import { currentLocationAge, describeConnection, describeTracking, formatLocationAge, mapLink } from './tracking';

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };

const read = (overrides: Partial<DeliveryTracking>): DeliveryTracking => ({
  deliveryId: 'd-1',
  status: 'IN_TRANSIT',
  driverId: 'driver-1',
  location: { ...CAIRO, updatedAt: '2026-10-06T12:00:00.000Z' },
  tracking: 'LIVE',
  locationAgeSeconds: 8,
  ...overrides,
});

/** The pin is drawn if and only if the view carries a position. */
const pinOf = (view: ReturnType<typeof describeTracking>) => (view.kind === 'position' ? view.position : null);

describe('formatLocationAge', () => {
  it('reads naturally across ranges', () => {
    expect(formatLocationAge(0)).toBe('just now');
    expect(formatLocationAge(4)).toBe('just now');
    expect(formatLocationAge(8)).toBe('8 s ago');
    expect(formatLocationAge(59)).toBe('59 s ago');
    expect(formatLocationAge(60)).toBe('1 min ago');
    expect(formatLocationAge(185)).toBe('3 min ago');
    expect(formatLocationAge(7200)).toBe('2 h ago');
  });
});

describe('describeTracking: one view per backend state', () => {
  it('NO_DRIVER: finding a driver, no pin', () => {
    const view = describeTracking({ tracking: read({ tracking: 'NO_DRIVER', driverId: null, location: null, locationAgeSeconds: null }) });
    expect(view).toMatchObject({ kind: 'finding', title: 'Finding a driver' });
    expect(pinOf(view)).toBeNull();
  });

  it('AWAITING_LOCATION: driver assigned, waiting for location, no pin', () => {
    const view = describeTracking({ tracking: read({ tracking: 'AWAITING_LOCATION', location: null, locationAgeSeconds: null }) });
    expect(view).toMatchObject({ kind: 'awaiting', title: 'Driver assigned', detail: 'Waiting for location…' });
    expect(pinOf(view)).toBeNull();
  });

  it('LIVE: map with the driver pin at the returned coordinates, labelled Live', () => {
    const view = describeTracking({ tracking: read({}) });
    expect(view).toMatchObject({ kind: 'position', freshness: 'live', title: 'Live', detail: 'Updated 8 s ago' });
    expect(pinOf(view)).toEqual(CAIRO);
  });

  it('STALE: last-known pin, never labelled Live', () => {
    const view = describeTracking({ tracking: read({ tracking: 'STALE', locationAgeSeconds: 240 }) });
    expect(view).toMatchObject({
      kind: 'position',
      freshness: 'stale',
      title: 'Last known location',
      detail: 'Updated 4 min ago',
    });
    expect(pinOf(view)).toEqual(CAIRO);
  });

  it('ENDED: nothing at all, even if a location were present', () => {
    expect(describeTracking({ tracking: read({ tracking: 'ENDED', status: 'DELIVERED', location: null }) })).toEqual({ kind: 'hidden' });
    expect(describeTracking({ tracking: read({ tracking: 'ENDED', status: 'CANCELLED' }) })).toEqual({ kind: 'hidden' });
  });

  it('no data yet or an unknown future state: nothing, rather than a guess', () => {
    expect(describeTracking({ tracking: undefined })).toEqual({ kind: 'hidden' });
    expect(describeTracking({ tracking: read({ tracking: 'TELEPORTED' as DeliveryTracking['tracking'] }) })).toEqual({ kind: 'hidden' });
  });

  it('decides from `tracking`, not from location: a location on AWAITING_LOCATION draws no pin', () => {
    const view = describeTracking({ tracking: read({ tracking: 'AWAITING_LOCATION' }) });
    expect(view.kind).toBe('awaiting');
    expect(pinOf(view)).toBeNull();
  });
});

describe('describeTracking: reassignment', () => {
  it('renders only the position of the response it is given (the current driver)', () => {
    const before = describeTracking({ tracking: read({ driverId: 'driver-1', location: { latitude: 1, longitude: 1, updatedAt: '' } }) });
    const after = describeTracking({
      tracking: read({ driverId: 'driver-2', location: { latitude: 2, longitude: 2, updatedAt: '' } }),
    });
    expect(pinOf(before)).toEqual({ latitude: 1, longitude: 1 });
    expect(pinOf(after)).toEqual({ latitude: 2, longitude: 2 });
  });

  it("shows waiting, not the previous driver's pin, when the new driver has not reported yet", () => {
    const view = describeTracking({ tracking: read({ driverId: 'driver-2', tracking: 'AWAITING_LOCATION', location: null }) });
    expect(view.kind).toBe('awaiting');
  });
});

describe('describeTracking: malformed locations never produce a pin or "Live"', () => {
  it.each([
    ['null location', null],
    ['missing longitude', { latitude: 30, updatedAt: '' }],
    ['string coordinates', { latitude: '30.04', longitude: '31.23', updatedAt: '' }],
    ['NaN', { latitude: Number.NaN, longitude: 31, updatedAt: '' }],
    ['Infinity', { latitude: 30, longitude: Number.POSITIVE_INFINITY, updatedAt: '' }],
    ['latitude out of range', { latitude: 91, longitude: 31, updatedAt: '' }],
    ['longitude out of range', { latitude: 30, longitude: 181, updatedAt: '' }],
  ])('%s', (_label, location) => {
    for (const state of ['LIVE', 'STALE'] as const) {
      const view = describeTracking({ tracking: read({ tracking: state, location: location as DeliveryTracking['location'] }) });
      expect(view).toMatchObject({ kind: 'unavailable', title: 'Driver assigned' });
      expect(pinOf(view)).toBeNull();
    }
  });
});

describe('describeTracking: refresh failures (offline, timeout, 5xx)', () => {
  it('downgrades a LIVE read to last known while the latest refresh failed', () => {
    const view = describeTracking({ tracking: read({}), refreshFailed: true });
    expect(view).toMatchObject({
      kind: 'position',
      freshness: 'stale',
      title: 'Last known location',
      detail: 'Updated 8 s ago · reconnecting…',
    });
  });

  it('goes back to Live once a refresh succeeds again', () => {
    expect(describeTracking({ tracking: read({}), refreshFailed: false })).toMatchObject({ title: 'Live' });
  });

  it('keeps the server state for non-position states (no invented state)', () => {
    expect(describeTracking({ tracking: read({ tracking: 'AWAITING_LOCATION', location: null }), refreshFailed: true }).kind).toBe('awaiting');
    expect(describeTracking({ tracking: read({ tracking: 'ENDED', location: null }), refreshFailed: true }).kind).toBe('hidden');
  });
});

describe('describeTracking: realtime connection (Phase 7 Step 3)', () => {
  it('Live while the data is fresh (stream open)', () => {
    expect(describeTracking({ tracking: read({}), fresh: true, connection: 'open' })).toMatchObject({ title: 'Live' });
  });

  it('never Live while disconnected without a fresh refresh: last known · reconnecting…', () => {
    expect(describeTracking({ tracking: read({}), fresh: false, connection: 'reconnecting' })).toMatchObject({
      freshness: 'stale',
      title: 'Last known location',
      detail: 'Updated 8 s ago · reconnecting…',
    });
  });

  it('Live again once polling refreshed it during the outage', () => {
    expect(describeTracking({ tracking: read({}), fresh: true, connection: 'reconnecting' })).toMatchObject({ title: 'Live' });
  });

  it('STALE stays last known whatever the connection', () => {
    expect(describeTracking({ tracking: read({ tracking: 'STALE' }), fresh: true, connection: 'open' })).toMatchObject({
      title: 'Last known location',
    });
  });

  it('the position keeps aging locally between pushes', () => {
    const received = read({ locationAgeSeconds: 2, receivedAt: 1_000_000 });
    expect(describeTracking({ tracking: received, now: 1_000_000 })).toMatchObject({ detail: 'Updated just now' });
    expect(describeTracking({ tracking: received, now: 1_018_000 })).toMatchObject({ detail: 'Updated 20 s ago' });
    expect(currentLocationAge(received, 1_000_000 - 5_000)).toBe(2);
  });
});

describe('describeConnection', () => {
  it('says how updates arrive', () => {
    expect(describeConnection('open', true)).toBe('Live updates');
    expect(describeConnection('reconnecting', false)).toBe('Reconnecting…');
    expect(describeConnection('reconnecting', true)).toBe('Updating every 10 s');
    expect(describeConnection('connecting', true)).toBeUndefined();
    expect(describeConnection('closed', true)).toBeUndefined();
    expect(describeConnection(undefined, true)).toBeUndefined();
  });
});

describe('mapLink', () => {
  it('pins the position on OpenStreetMap', () => {
    expect(mapLink(30.0444, 31.2357)).toBe(
      'https://www.openstreetmap.org/?mlat=30.0444&mlon=31.2357#map=16/30.0444/31.2357',
    );
  });
});
