import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiGet, apiPost } from './api';
import { createOrder, fetchMyOrders } from './orders';

vi.mock('./api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

describe('order service gateway mappings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an order from the authenticated cart using the retry key', async () => {
    vi.mocked(apiPost).mockResolvedValue({ id: 'order-1' });

    await createOrder('order-key-1');

    expect(apiPost).toHaveBeenCalledWith(
      '/api/orders',
      {},
      true,
      { 'Idempotency-Key': 'order-key-1' },
    );
  });

  it('sends the delivery location with the address and the notes (#54)', async () => {
    vi.mocked(apiPost).mockResolvedValue({ id: 'order-1' });

    await createOrder('order-key-2', { deliveryNotes: ' Ring twice ', delivery: { address: '5 Nile St', latitude: 30.0444, longitude: 31.2357 } });

    expect(apiPost).toHaveBeenCalledWith(
      '/api/orders',
      { deliveryNotes: 'Ring twice', deliveryAddress: '5 Nile St', deliveryLatitude: 30.0444, deliveryLongitude: 31.2357 },
      true,
      { 'Idempotency-Key': 'order-key-2' },
    );
  });

  it('fetches the current customer order list through the authenticated gateway', async () => {
    vi.mocked(apiGet).mockResolvedValue({ items: [] });

    await expect(fetchMyOrders()).resolves.toEqual([]);
    expect(apiGet).toHaveBeenCalledWith('/api/orders', true);
  });
});