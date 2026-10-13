import { describe, expect, it } from 'vitest';

import { notificationMessage, notificationTitle } from './notification-text';

const base = { title: 'Order Confirmed', message: 'Your order abc has been confirmed.' };

describe('notification text (#151)', () => {
  it('renders from the message key and params', () => {
    const confirmed = { ...base, messageKey: 'order.confirmed', params: { orderId: 'abcdef12-3456' } };
    expect(notificationTitle(confirmed)).toBe('Order confirmed');
    expect(notificationMessage(confirmed)).toBe('Your order ABCDEF12 has been confirmed.');
  });

  it("names who cancelled and keeps the canceller's own words", () => {
    const byRestaurant = { ...base, messageKey: 'order.cancelled', params: { orderId: 'abcdef12', cancelledBy: 'RESTAURANT', note: 'Out of falafel' } };
    expect(notificationMessage(byRestaurant)).toBe('The restaurant cancelled your order ABCDEF12: Out of falafel');
    const bySystem = { ...base, messageKey: 'order.cancelled', params: { orderId: 'abcdef12', cancelledBy: 'SYSTEM' } };
    expect(notificationMessage(bySystem)).toBe('Delivery Plus cancelled your order ABCDEF12.');
  });

  it('tells the customer about a declined payment and a refund with its amount (#56)', () => {
    const declined = { ...base, messageKey: 'payment.failed', params: { orderId: 'abcdef12' } };
    expect(notificationTitle(declined)).toBe('Payment declined');
    expect(notificationMessage(declined)).toBe('Your payment for order ABCDEF12 was declined, so the order was not placed.');
    const refunded = { ...base, messageKey: 'payment.refunded', params: { orderId: 'abcdef12', amount: '225.00', currency: 'EGP' } };
    expect(notificationTitle(refunded)).toBe('Refund issued');
    expect(notificationMessage(refunded)).toBe('We refunded EGP\u00a0225.00 for your order ABCDEF12.');
  });

  it('shows older notifications as stored', () => {
    expect(notificationTitle(base)).toBe('Order Confirmed');
    expect(notificationMessage({ ...base, messageKey: null })).toBe(base.message);
  });
});
