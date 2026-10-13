import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import { isCartChanged } from './cart-changes';

describe('cart changed at checkout (#42)', () => {
  it('recognises a 409 CartChanged, and nothing else', () => {
    expect(isCartChanged(new ApiError(409, 'CartChanged', 'Some items in your cart changed.'))).toBe(true);
    expect(isCartChanged(new ApiError(409, 'Conflict', 'Order already has an active payment'))).toBe(false);
    expect(isCartChanged(new ApiError(400, 'CartChanged', 'x'))).toBe(false);
    expect(isCartChanged(new Error('offline'))).toBe(false);
  });
});
