import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { OrderStatus } from '@/services/orders';

export const orderStatusMeta: Record<OrderStatus, { label: string; description: string; tone: BadgeTone }> = {
  CREATED: { label: 'Order placed', description: 'We received your order.', tone: 'info' },
  PAYMENT_PENDING: { label: 'Awaiting payment', description: 'Confirming your payment.', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', description: 'Payment received — sent to the restaurant.', tone: 'info' },
  PREPARING: { label: 'Preparing', description: 'The kitchen is making your food.', tone: 'brand' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', description: 'Waiting for a driver to collect it.', tone: 'brand' },
  DRIVER_ASSIGNED: { label: 'Driver assigned', description: 'A driver is heading to the restaurant.', tone: 'brand' },
  PICKED_UP: { label: 'On the way', description: 'Your order is heading to you.', tone: 'brand' },
  DELIVERED: { label: 'Delivered', description: 'Enjoy your meal!', tone: 'success' },
  FAILED: { label: 'Failed', description: 'This order could not be completed.', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', description: 'This order was cancelled.', tone: 'neutral' },
};

export function OrderStatusBadge({ status, testID }: { status: OrderStatus; testID?: string }) {
  const meta = orderStatusMeta[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge label={meta.label} tone={meta.tone} testID={testID} />;
}
