import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiGet } from '@/services/api';
import { fetchDeliveryTracking } from '@/services/tracking';

import { shouldTrack } from './tracking';

vi.mock('@/hooks/use-resource', () => ({ useResource: vi.fn() }));
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
