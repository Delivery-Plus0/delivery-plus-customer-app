import { t } from '@/i18n/core';
import type { AppNotification } from '@/services/notifications';
import { formatMoney, shortId } from '@/utils/format';

type Localizable = Pick<AppNotification, 'title' | 'message' | 'messageKey' | 'params'>;

/**
 * A notification's title in the current language (#151), from its message key when the backend sent one.
 * Older notifications (no key) show their stored English title, translated when the app knows it.
 */
export function notificationTitle(notification: Localizable): string {
  switch (notification.messageKey) {
    case 'order.confirmed':
      return t('Order confirmed');
    case 'payment.completed':
      return t('Payment received');
    case 'delivery.driver_assigned':
      return t('Driver assigned');
    case 'delivery.picked_up':
      return t('Order picked up');
    case 'delivery.delivered':
      return t('Order delivered');
    case 'order.cancelled':
      return t('Order cancelled');
    case 'payment.failed':
      return t('Payment declined');
    case 'payment.refunded':
      return t('Refund issued');
    default:
      return notification.title;
  }
}

/** The body, with the order's short id and, for a cancellation, the canceller's own words. */
export function notificationMessage(notification: Localizable): string {
  const params = notification.params ?? {};
  const id = params.orderId ? shortId(params.orderId) : '';
  switch (notification.messageKey) {
    case 'order.confirmed':
      return t('Your order {id} has been confirmed.', { id });
    case 'payment.completed':
      return t('We received your payment for order {id}.', { id });
    case 'delivery.driver_assigned':
      return t('A driver is on the way to pick up your order {id}.', { id });
    case 'delivery.picked_up':
      return t('Your order {id} has been picked up and is on its way.', { id });
    case 'delivery.delivered':
      return t('Your order {id} has been delivered. Enjoy!', { id });
    case 'order.cancelled':
      if (params.cancelledBy === 'SYSTEM') {
        return params.note ? t('Delivery Plus cancelled your order {id}: {note}', { id, note: params.note }) : t('Delivery Plus cancelled your order {id}.', { id });
      }
      return params.note ? t('The restaurant cancelled your order {id}: {note}', { id, note: params.note }) : t('The restaurant cancelled your order {id}.', { id });
    case 'payment.failed':
      return t('Your payment for order {id} was declined, so the order was not placed.', { id });
    case 'payment.refunded':
      // #56: the whole payment, items and delivery fee, back to the customer.
      return t('We refunded {amount} for your order {id}.', { id, amount: formatMoney(params.amount) });
    default:
      return notification.message;
  }
}
