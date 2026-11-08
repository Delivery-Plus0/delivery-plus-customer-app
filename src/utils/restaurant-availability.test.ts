import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/services/api';

import { isRestaurantUnavailable, takesOrders, unavailableErrorMessage, unavailableMessage } from './restaurant-availability';

vi.mock('react-native', () => ({ Platform: { OS: 'web' }, I18nManager: { isRTL: false, allowRTL: vi.fn(), forceRTL: vi.fn() } }));

describe('restaurant availability (#286)', () => {
  it('only an OPEN restaurant takes orders; BUSY does not', () => {
    expect(takesOrders('OPEN')).toBe(true);
    expect(takesOrders('BUSY')).toBe(false);
    expect(takesOrders('CLOSED')).toBe(false);
    expect(takesOrders('SUSPENDED')).toBe(false);
    // Unknown yet (still loading): don't block; the backend still refuses at checkout.
    expect(takesOrders(undefined)).toBe(true);
  });

  it('tells a busy restaurant apart from a closed one', () => {
    expect(unavailableMessage('OPEN')).toBeNull();
    expect(unavailableMessage('BUSY')).toMatch(/busy right now.*few minutes/);
    expect(unavailableMessage('CLOSED')).toMatch(/isn't taking orders right now/);
    expect(unavailableMessage('SUSPENDED')).toBe(unavailableMessage('CLOSED'));
  });

  it('recognises the checkout refusals and explains each', () => {
    const busy = new ApiError(409, 'RestaurantBusy', 'The restaurant is busy right now.');
    const closed = new ApiError(409, 'RestaurantClosed', 'The restaurant is closed right now.');
    expect(isRestaurantUnavailable(busy)).toBe(true);
    expect(isRestaurantUnavailable(closed)).toBe(true);
    expect(isRestaurantUnavailable(new ApiError(409, 'OutOfDeliveryArea', 'x'))).toBe(false);
    expect(isRestaurantUnavailable(new Error('offline'))).toBe(false);
    expect(unavailableErrorMessage(busy)).toBe(unavailableMessage('BUSY'));
    expect(unavailableErrorMessage(closed)).toBe(unavailableMessage('CLOSED'));
  });
});
