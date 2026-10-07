import type { Order, OrderFilter } from '@/services/orders';

export const ORDER_FILTER_OPTIONS: { key: OrderFilter | null; label: string; testID: string }[] = [
  { key: null, label: 'All', testID: 'orders-filter-all' },
  { key: 'active', label: 'Active', testID: 'orders-filter-active' },
  { key: 'completed', label: 'Completed', testID: 'orders-filter-completed' },
  { key: 'cancelled', label: 'Cancelled & failed', testID: 'orders-filter-cancelled' },
];

/**
 * Why an unsuccessful order ended, exactly as the backend recorded it (#143); null for orders that
 * didn't end that way, or that ended before reasons were recorded. Never made up by the app.
 */
export function outcomeReason(order: Pick<Order, 'status' | 'cancellationReason'>): string | null {
  if (order.status !== 'CANCELLED' && order.status !== 'FAILED') return null;
  return order.cancellationReason?.trim() || null;
}

/** The payment line of the summary, from the backend's payment status for this order. */
export function paymentStatusLabel(order: Pick<Order, 'status' | 'paymentStatus'>): string {
  switch (order.paymentStatus) {
    case 'COMPLETED':
      return 'Paid';
    case 'PENDING':
      return 'Payment pending';
    case 'FAILED':
      return 'Payment declined · you were not charged';
    default:
      return order.status === 'CREATED' ? 'Not paid yet' : 'Not recorded';
  }
}

/** Joins loaded pages; an order can shift to the next page while new ones arrive, so keep its first copy. */
export function mergeOrderPages(pages: Order[][]): Order[] {
  const seen = new Set<string>();
  return pages.flat().filter((order) => (seen.has(order.id) ? false : (seen.add(order.id), true)));
}
