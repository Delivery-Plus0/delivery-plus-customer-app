import type { Order, OrderFilter } from '@/services/orders';
import { t } from '@/i18n/core';
import { formatMoney } from '@/utils/format';

// Getters, so the labels follow the current language (#151).
export const ORDER_FILTER_OPTIONS: { key: OrderFilter | null; label: string; testID: string }[] = [
  {
    key: null,
    get label() {
      return t('All');
    },
    testID: 'orders-filter-all',
  },
  {
    key: 'active',
    get label() {
      return t('Active');
    },
    testID: 'orders-filter-active',
  },
  {
    key: 'completed',
    get label() {
      return t('Completed');
    },
    testID: 'orders-filter-completed',
  },
  {
    key: 'cancelled',
    get label() {
      return t('Cancelled & failed');
    },
    testID: 'orders-filter-cancelled',
  },
];

/**
 * Why an unsuccessful order ended, from what the backend recorded (#143): who ended it and, for a
 * restaurant or the platform, their own words (`cancellationNote`, #151), in the current language. Older
 * orders without a note keep the backend's English sentence. Null for orders that didn't end that way.
 * Never made up by the app.
 */
export function outcomeReason(order: Pick<Order, 'status' | 'cancellationReason' | 'cancelledBy' | 'cancellationNote'>): string | null {
  if (order.status !== 'CANCELLED' && order.status !== 'FAILED') return null;
  const recorded = order.cancellationReason?.trim() || null;
  const note = order.cancellationNote?.trim();
  switch (order.cancelledBy) {
    case 'PAYMENT':
      return t('Your payment was declined, so the order was not placed.');
    case 'CUSTOMER':
      return t('You cancelled this order.');
    case 'RESTAURANT':
      if (note) return t('The restaurant cancelled this order: {note}', { note });
      return recorded && recorded !== 'The restaurant cancelled this order.' ? recorded : t('The restaurant cancelled this order.');
    case 'SYSTEM':
      if (note) return t('Delivery Plus cancelled this order: {note}', { note });
      return recorded && recorded !== 'Delivery Plus cancelled this order.' ? recorded : t('Delivery Plus cancelled this order.');
    default:
      return recorded;
  }
}

/** The payment line of the summary, from the backend's payment status for this order. */
export function paymentStatusLabel(order: Pick<Order, 'status' | 'paymentStatus' | 'totalAmount'>): string {
  switch (order.paymentStatus) {
    case 'REFUNDED':
      // #56: always the whole payment, items and delivery fee.
      return t('Refunded in full · {amount}', { amount: formatMoney(order.totalAmount) });
    case 'COMPLETED':
      return t('Paid');
    case 'PENDING':
      return t('Payment pending');
    case 'FAILED':
      return t('Payment declined · you were not charged');
    default:
      return order.status === 'CREATED' ? t('Not paid yet') : t('Not recorded');
  }
}

/** Joins loaded pages; an order can shift to the next page while new ones arrive, so keep its first copy. */
export function mergeOrderPages(pages: Order[][]): Order[] {
  const seen = new Set<string>();
  return pages.flat().filter((order) => (seen.has(order.id) ? false : (seen.add(order.id), true)));
}
