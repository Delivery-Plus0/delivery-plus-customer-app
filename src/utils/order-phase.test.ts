import { describe, expect, it } from 'vitest';

import type { Delivery } from '@/services/deliveries';
import type { Order } from '@/services/orders';

import { describeOrderPhase, searchingFor } from './order-phase';

const phase = (order: Order['status'], delivery?: Delivery['status']) =>
  describeOrderPhase({ status: order }, delivery ? { status: delivery } : null).key;

describe('describeOrderPhase', () => {
  it.each([
    ['CREATED', undefined, 'placed'],
    ['PAYMENT_PENDING', undefined, 'placed'],
    ['CONFIRMED', undefined, 'confirmed'],
    ['PREPARING', undefined, 'preparing'],
    ['READY_FOR_PICKUP', undefined, 'searching'],
    ['READY_FOR_PICKUP', 'CREATED', 'searching'],
    ['DRIVER_ASSIGNED', 'DRIVER_ASSIGNED', 'driver_assigned'],
    ['PICKED_UP', 'PICKED_UP', 'picked_up'],
    ['PICKED_UP', 'IN_TRANSIT', 'on_the_way'],
    ['DELIVERED', 'DELIVERED', 'delivered'],
    ['FAILED', undefined, 'failed'],
    ['CANCELLED', undefined, 'cancelled'],
  ] as const)('order %s + delivery %s → %s', (order, delivery, expected) => {
    expect(phase(order, delivery)).toBe(expected);
  });

  it('searching is its own phase between "ready" and "driver assigned"', () => {
    expect(phase('READY_FOR_PICKUP', 'CREATED')).toBe('searching');
    expect(describeOrderPhase({ status: 'READY_FOR_PICKUP' }, { status: 'CREATED' })).toMatchObject({
      title: 'Finding a driver',
      tone: 'searching',
      step: 2,
      active: true,
    });
  });

  it('never steps backwards when the order lags behind the delivery', () => {
    expect(phase('READY_FOR_PICKUP', 'DRIVER_ASSIGNED')).toBe('driver_assigned');
    expect(phase('DRIVER_ASSIGNED', 'IN_TRANSIT')).toBe('on_the_way');
    expect(phase('PICKED_UP', 'DELIVERED')).toBe('delivered');
  });

  it('a delivery that is behind the order does not pull the phase back', () => {
    expect(phase('DELIVERED', 'IN_TRANSIT')).toBe('delivered');
    expect(phase('DRIVER_ASSIGNED', 'CREATED')).toBe('driver_assigned');
  });

  it('failed and cancelled orders are final; a cancelled delivery cancels the phase', () => {
    expect(phase('FAILED', 'DRIVER_ASSIGNED')).toBe('failed');
    expect(phase('CANCELLED', 'IN_TRANSIT')).toBe('cancelled');
    expect(phase('DRIVER_ASSIGNED', 'CANCELLED')).toBe('cancelled');
  });

  it('only finished phases stop being active', () => {
    expect(describeOrderPhase({ status: 'PREPARING' }, null).active).toBe(true);
    expect(describeOrderPhase({ status: 'DELIVERED' }, null).active).toBe(false);
    expect(describeOrderPhase({ status: 'FAILED' }, null).step).toBe(-1);
  });
});

describe('searchingFor', () => {
  const created = '2026-10-06T12:00:00.000Z';
  const at = (seconds: number) => Date.parse(created) + seconds * 1000;

  it('reads naturally', () => {
    expect(searchingFor(created, at(20))).toBe('Searching for less than a minute');
    expect(searchingFor(created, at(150))).toBe('Searching for 2 min');
  });

  it('is null without a delivery or with a bad timestamp', () => {
    expect(searchingFor(undefined, at(0))).toBeNull();
    expect(searchingFor('nope', at(0))).toBeNull();
  });

  it('a clock slightly behind the server never shows a negative time', () => {
    expect(searchingFor(created, at(-5))).toBe('Searching for less than a minute');
  });
});
