import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { OrderStatus } from '@/services/orders';
import { t } from '@/i18n';

// Getters, so labels follow the current language (#151) instead of the one at import time.
export const orderStatusMeta: Record<OrderStatus, { label: string; description: string; tone: BadgeTone }> = {
  CREATED: {
    get label() {
      return t('Order placed');
    },
    get description() {
      return t('We received your order.');
    },
    tone: 'info',
  },
  PAYMENT_PENDING: {
    get label() {
      return t('Awaiting payment');
    },
    get description() {
      return t('Confirming your payment.');
    },
    tone: 'warning',
  },
  CONFIRMED: {
    get label() {
      return t('Confirmed');
    },
    get description() {
      return t('Payment received — sent to the restaurant.');
    },
    tone: 'info',
  },
  PREPARING: {
    get label() {
      return t('Preparing');
    },
    get description() {
      return t('The kitchen is making your food.');
    },
    tone: 'brand',
  },
  READY_FOR_PICKUP: {
    get label() {
      return t('Ready for pickup');
    },
    get description() {
      return t('Waiting for a driver to collect it.');
    },
    tone: 'brand',
  },
  DRIVER_ASSIGNED: {
    get label() {
      return t('Driver assigned');
    },
    get description() {
      return t('A driver is heading to the restaurant.');
    },
    tone: 'brand',
  },
  PICKED_UP: {
    get label() {
      return t('On the way');
    },
    get description() {
      return t('Your order is heading to you.');
    },
    tone: 'brand',
  },
  DELIVERED: {
    get label() {
      return t('Delivered');
    },
    get description() {
      return t('Enjoy your meal!');
    },
    tone: 'success',
  },
  FAILED: {
    get label() {
      return t('Failed');
    },
    get description() {
      return t('This order could not be completed.');
    },
    tone: 'danger',
  },
  CANCELLED: {
    get label() {
      return t('Cancelled');
    },
    get description() {
      return t('This order was cancelled.');
    },
    tone: 'neutral',
  },
};

export function OrderStatusBadge({ status, testID }: { status: OrderStatus; testID?: string }) {
  const meta = orderStatusMeta[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge label={meta.label} tone={meta.tone} testID={testID} />;
}
