import { useResource } from '@/hooks/use-resource';
import { TERMINAL_DELIVERY_STATUSES, fetchDeliveryForOrder, type Delivery } from '@/services/deliveries';
import type { Order, OrderStatus } from '@/services/orders';

/** Poll an in-flight delivery this often while the order screen is focused. */
const ACTIVE_DELIVERY_POLL_MS = 10_000;

/** delivery-service only creates a delivery once the order is READY_FOR_PICKUP. */
const STATUSES_WITH_POSSIBLE_DELIVERY: OrderStatus[] = [
  'READY_FOR_PICKUP',
  'DRIVER_ASSIGNED',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED',
];

export function canHaveDelivery(order: Pick<Order, 'status'> | undefined): boolean {
  return order ? STATUSES_WITH_POSSIBLE_DELIVERY.includes(order.status) : false;
}

export function isDeliveryActive(delivery: Delivery | null | undefined): boolean {
  return !delivery || !TERMINAL_DELIVERY_STATUSES.includes(delivery.status);
}

/**
 * Delivery state for an order. Polling for now; Phase 2 can back this hook with a WebSocket
 * subscription without changing the screens that use it.
 */
export function useOrderDelivery(order: Order | undefined) {
  const enabled = canHaveDelivery(order);
  const orderActive = order ? !['DELIVERED', 'CANCELLED', 'FAILED'].includes(order.status) : false;

  return useResource<Delivery | null>(
    enabled && order ? `delivery:order:${order.id}` : null,
    () => fetchDeliveryForOrder(order!.id),
    {
      staleTimeMs: 3_000,
      pollIntervalMs: (delivery) => (orderActive && isDeliveryActive(delivery) ? ACTIVE_DELIVERY_POLL_MS : 0),
    },
  );
}
