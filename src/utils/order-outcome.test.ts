import { describe, expect, it } from 'vitest';

import type { Order } from '@/services/orders';

import { mergeOrderPages, outcomeReason, paymentStatusLabel } from './order-outcome';

const order = (overrides: Partial<Order>): Order => ({
  id: 'o-1',
  customerId: 'c-1',
  restaurantId: 'r-1',
  status: 'DELIVERED',
  totalAmount: '9.99',
  items: [],
  ...overrides,
});

describe('outcomeReason', () => {
  it("shows the backend's reason for failed and cancelled orders", () => {
    expect(outcomeReason(order({ status: 'FAILED', cancellationReason: 'Your payment was declined, so the order was not placed.' }))).toBe(
      'Your payment was declined, so the order was not placed.',
    );
    expect(outcomeReason(order({ status: 'CANCELLED', cancellationReason: 'You cancelled this order.' }))).toBe('You cancelled this order.');
  });

  it('shows nothing for other statuses or when no reason was recorded', () => {
    expect(outcomeReason(order({ status: 'DELIVERED', cancellationReason: 'stale' }))).toBeNull();
    expect(outcomeReason(order({ status: 'CANCELLED', cancellationReason: null }))).toBeNull();
    expect(outcomeReason(order({ status: 'CANCELLED', cancellationReason: '  ' }))).toBeNull();
  });
});

describe('paymentStatusLabel', () => {
  it('names each payment status the backend reports', () => {
    expect(paymentStatusLabel(order({ paymentStatus: 'COMPLETED' }))).toBe('Paid');
    expect(paymentStatusLabel(order({ paymentStatus: 'PENDING' }))).toBe('Payment pending');
    expect(paymentStatusLabel(order({ paymentStatus: 'FAILED' }))).toBe('Payment declined · you were not charged');
  });

  it('does not guess when the status is unknown', () => {
    expect(paymentStatusLabel(order({ status: 'CREATED', paymentStatus: null }))).toBe('Not paid yet');
    expect(paymentStatusLabel(order({ status: 'CANCELLED', paymentStatus: null }))).toBe('Not recorded');
  });
});

describe('mergeOrderPages', () => {
  it('joins pages without repeating an order', () => {
    const merged = mergeOrderPages([[order({ id: 'a' }), order({ id: 'b' })], [order({ id: 'b' }), order({ id: 'c' })]]);
    expect(merged.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });
});
