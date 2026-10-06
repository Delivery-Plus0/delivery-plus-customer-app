import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiGet } from '@/services/api';
import { fetchDeliveryTracking } from '@/services/tracking';

import { isTrackingFresh, pollIntervalFor, shouldTrack, stampReceived, TRACKING_POLL_MS } from './tracking';

vi.mock('@/hooks/use-resource', () => ({ useResource: vi.fn() }));
vi.mock('expo-router', () => ({ useFocusEffect: vi.fn() }));
vi.mock('@/services/stream-fetch', () => ({ streamingFetch: vi.fn() }));
vi.mock('@/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/api')>()),
  apiGet: vi.fn(),
}));

describe('fetchDeliveryTracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the delivery tracking through the authenticated gateway route', async () => {
    vi.mocked(apiGet).mockResolvedValue({ deliveryId: 'd-1', tracking: 'LIVE' });

    await expect(fetchDeliveryTracking('d-1')).resolves.toMatchObject({ tracking: 'LIVE' });
    expect(apiGet).toHaveBeenCalledWith('/api/tracking/delivery/d-1', true);
  });
});

describe('polling fallback rule', () => {
  const live = { deliveryId: 'd-1', status: 'IN_TRANSIT', location: null, tracking: 'LIVE', locationAgeSeconds: 0 } as const;

  it('no polling while the realtime stream is open', () => {
    expect(pollIntervalFor('open', live)).toBe(0);
  });

  it.each(['connecting', 'reconnecting', 'closed'] as const)('polls every 10 s while the stream is %s', (state) => {
    expect(pollIntervalFor(state, live)).toBe(TRACKING_POLL_MS);
    expect(TRACKING_POLL_MS).toBe(10_000);
  });

  it('never polls once tracking ended', () => {
    expect(pollIntervalFor('reconnecting', { ...live, tracking: 'ENDED' })).toBe(0);
  });
});

describe('freshness (may the screen say "Live"?)', () => {
  it('fresh while the stream is open', () => {
    expect(isTrackingFresh('open', 1_000, 0, false)).toBe(true);
  });

  it('not fresh right after the stream dropped, until a refresh succeeds', () => {
    const droppedAt = 10_000;
    expect(isTrackingFresh('reconnecting', droppedAt, 9_000, false)).toBe(false);
    expect(isTrackingFresh('reconnecting', droppedAt, 12_000, false)).toBe(true);
  });

  it('not fresh while the fallback refresh is failing', () => {
    expect(isTrackingFresh('reconnecting', 10_000, 12_000, true)).toBe(false);
  });
});

describe('stampReceived', () => {
  it('records when this device received a snapshot, without changing it otherwise', () => {
    const snapshot = { deliveryId: 'd-1', status: 'IN_TRANSIT', location: null, tracking: 'AWAITING_LOCATION', locationAgeSeconds: null } as const;
    expect(stampReceived(snapshot, 1234)).toEqual({ ...snapshot, receivedAt: 1234 });
  });
});

describe('shouldTrack', () => {
  it('tracks every unfinished delivery the customer can see, with or without a driver', () => {
    // No delivery loaded: nothing to ask for. The delivery only ever comes from the customer's own
    // order, so a 403 on someone else's order (delivery undefined) never reaches the tracking route.
    expect(shouldTrack(undefined)).toBe(false);
    expect(shouldTrack(null)).toBe(false);
    // Without a driver the backend answers NO_DRIVER; the screen does not infer it locally.
    expect(shouldTrack({ id: 'd-1', orderId: 'o-1', status: 'CREATED', driverId: null })).toBe(true);
    expect(shouldTrack({ id: 'd-1', orderId: 'o-1', status: 'DRIVER_ASSIGNED', driverId: 'driver-1' })).toBe(true);
    expect(shouldTrack({ id: 'd-1', orderId: 'o-1', status: 'IN_TRANSIT', driverId: 'driver-1' })).toBe(true);
    expect(shouldTrack({ id: 'd-1', orderId: 'o-1', status: 'DELIVERED', driverId: 'driver-1' })).toBe(false);
    expect(shouldTrack({ id: 'd-1', orderId: 'o-1', status: 'CANCELLED', driverId: 'driver-1' })).toBe(false);
  });
});
