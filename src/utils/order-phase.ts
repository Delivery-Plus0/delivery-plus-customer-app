import type { Delivery } from '@/services/deliveries';
import type { Order } from '@/services/orders';
import { t } from '@/i18n/core';

/**
 * The single, customer-facing phase of an order (#140), derived only from backend state: the order
 * status (order-service) and the delivery status (delivery-service). No state of its own.
 *
 * The two services move at slightly different moments (the order converges from delivery events), so
 * when they disagree the phase follows whichever is further along: the screen never steps backwards.
 */
export type OrderPhaseKey =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'searching'
  | 'driver_assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type OrderPhase = {
  key: OrderPhaseKey;
  title: string;
  detail: string;
  /** Index into ORDER_PHASE_STEPS (0–4) for the progress bar; -1 for failed/cancelled. */
  step: number;
  tone: 'progress' | 'searching' | 'success' | 'danger' | 'neutral';
  /** The order is still moving: the screen keeps itself updated. */
  active: boolean;
};

export const ORDER_PHASE_STEPS = ['Placed', 'Preparing', 'Driver', 'On the way', 'Delivered'] as const;

/** A progress step's label in the current language (#151); the constants above stay English keys. */
export function phaseStepLabel(step: (typeof ORDER_PHASE_STEPS)[number]): string {
  switch (step) {
    case 'Placed':
      return t('Placed');
    case 'Preparing':
      return t('Preparing');
    case 'Driver':
      return t('Driver');
    case 'On the way':
      return t('On the way');
    default:
      return t('Delivered');
  }
}

// Getters: the text is read when a phase is described, in the current language (#151).
const PHASES: Record<OrderPhaseKey, Omit<OrderPhase, 'key'>> = {
  placed: { get title() {
      return t('Order placed');
    }, get detail() {
      return t('Confirming your payment…');
    }, step: 0, tone: 'progress', active: true },
  confirmed: { get title() {
      return t('Order confirmed');
    }, get detail() {
      return t('The restaurant will start on it shortly.');
    }, step: 0, tone: 'progress', active: true },
  preparing: { get title() {
      return t('Preparing your order');
    }, get detail() {
      return t('The kitchen is making your food.');
    }, step: 1, tone: 'progress', active: true },
  searching: {
    get title() {
      return t('Finding a driver');
    },
    get detail() {
      return t('Your order is ready. We are matching it with a nearby driver.');
    },
    step: 2,
    tone: 'searching',
    active: true,
  },
  driver_assigned: {
    get title() {
      return t('Driver assigned');
    },
    get detail() {
      return t('Your driver is heading to the restaurant to collect your order.');
    },
    step: 2,
    tone: 'progress',
    active: true,
  },
  picked_up: { get title() {
      return t('Picked up');
    }, get detail() {
      return t('Your driver has your order.');
    }, step: 3, tone: 'progress', active: true },
  on_the_way: { get title() {
      return t('On the way');
    }, get detail() {
      return t('Your order is on its way to you.');
    }, step: 3, tone: 'progress', active: true },
  delivered: { get title() {
      return t('Delivered');
    }, get detail() {
      return t('Your order was delivered. Enjoy!');
    }, step: 4, tone: 'success', active: false },
  failed: { get title() {
      return t('Payment failed');
    }, get detail() {
      return t('This order could not be completed and you were not charged.');
    }, step: -1, tone: 'danger', active: false },
  cancelled: { get title() {
      return t('Order cancelled');
    }, get detail() {
      return t('This order was cancelled.');
    }, step: -1, tone: 'neutral', active: false },
};

/** Progress rank, so order and delivery can be compared. Terminal states are handled separately. */
const RANK: Record<Exclude<OrderPhaseKey, 'failed' | 'cancelled'>, number> = {
  placed: 0,
  confirmed: 1,
  preparing: 2,
  searching: 3,
  driver_assigned: 4,
  picked_up: 5,
  on_the_way: 6,
  delivered: 7,
};

type Ranked = keyof typeof RANK;

function fromOrder(status: Order['status']): OrderPhaseKey {
  switch (status) {
    case 'CREATED':
    case 'PAYMENT_PENDING':
      return 'placed';
    case 'CONFIRMED':
      return 'confirmed';
    case 'PREPARING':
      return 'preparing';
    case 'READY_FOR_PICKUP':
      return 'searching';
    case 'DRIVER_ASSIGNED':
      return 'driver_assigned';
    case 'PICKED_UP':
      return 'picked_up';
    case 'DELIVERED':
      return 'delivered';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'placed';
  }
}

function fromDelivery(status: Delivery['status']): OrderPhaseKey {
  switch (status) {
    case 'CREATED':
      return 'searching';
    case 'DRIVER_ASSIGNED':
      return 'driver_assigned';
    case 'PICKED_UP':
      return 'picked_up';
    case 'IN_TRANSIT':
      return 'on_the_way';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'searching';
  }
}

export function describeOrderPhase(
  order: Pick<Order, 'status'>,
  delivery: Pick<Delivery, 'status'> | null | undefined,
): OrderPhase {
  const byOrder = fromOrder(order.status);
  // A failed or cancelled order is final, whatever the delivery says.
  if (byOrder === 'failed' || byOrder === 'cancelled') return { key: byOrder, ...PHASES[byOrder] };

  let key: OrderPhaseKey = byOrder;
  if (delivery) {
    const byDelivery = fromDelivery(delivery.status);
    if (byDelivery === 'cancelled') key = 'cancelled';
    else if (RANK[byDelivery as Ranked] > RANK[byOrder as Ranked]) key = byDelivery;
  }
  return { key, ...PHASES[key] };
}

/** "Searching for 2 min" from when the delivery was created; null before a delivery exists. */
export function searchingFor(deliveryCreatedAt: string | undefined, now: number): string | null {
  if (!deliveryCreatedAt) return null;
  const started = Date.parse(deliveryCreatedAt);
  if (Number.isNaN(started)) return null;
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  if (seconds < 60) return t('Searching for less than a minute');
  const minutes = Math.floor(seconds / 60);
  return t('Searching for {minutes} min', { minutes });
}
