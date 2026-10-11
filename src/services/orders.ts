import { apiGet, apiPatch, apiPost } from '@/services/api';

export type OrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED';

export type OrderItem = {
  id?: string;
  menuItemId: string;
  name: string;
  /** Decimal snapshot — the order-service serializes it as a string. */
  price: string | number;
  quantity: number;
};

export type Order = {
  id: string;
  customerId: string;
  restaurantId: string;
  status: OrderStatus;
  totalAmount: string | number;
  items: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
  /** Who ended an unsuccessful order (#143); null while it is going, after delivery, or for old orders. */
  cancelledBy?: 'CUSTOMER' | 'RESTAURANT' | 'SYSTEM' | 'PAYMENT' | null;
  /** The backend's own sentence for why it ended; shown as-is, never written by the app. */
  cancellationReason?: string | null;
  /** #151: the restaurant's or platform's own words, without the English lead-in, for localized reasons. */
  cancellationNote?: string | null;
  /** From the backend's payment events; null when not known (e.g. orders from before #143). */
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | null;
  /** The items as priced at checkout (#145); totalAmount = subtotalAmount + deliveryFee. */
  subtotalAmount?: string | null;
  /** The delivery fee applied at checkout (#145); 0 for orders from before fees. */
  deliveryFee?: string | null;
};

/** GET /api/orders/quote (#145): what checking out the current cart costs, priced by the backend. */
export type OrderQuote = { subtotalAmount: string; deliveryFee: string; totalAmount: string; currency: 'EGP' };

/** GET /api/orders?status= groups (#143): cancelled covers CANCELLED and FAILED. */
export type OrderFilter = 'active' | 'completed' | 'cancelled';

export const ORDERS_PAGE_SIZE = 20;

export type OrderListResponse = {
  items: Order[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Happy-path lifecycle in the order the backend moves through it (shared `ORDER_TRANSITIONS`). */
export const ORDER_PROGRESS: OrderStatus[] = [
  'CREATED',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DRIVER_ASSIGNED',
  'PICKED_UP',
  'DELIVERED',
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'FAILED'];

/**
 * Customers may cancel at any non-terminal status per the backend, but the app only offers it
 * before the kitchen starts preparing so we don't cancel food that is already being made.
 */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ['CREATED', 'PAYMENT_PENDING', 'CONFIRMED'];

export function isActiveOrder(order: Pick<Order, 'status'>): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(order.status);
}

export async function createOrder(idempotencyKey?: string): Promise<Order> {
  return apiPost<Order>('/api/orders', {}, true, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined);
}

export async function fetchMyOrders(): Promise<Order[]> {
  const response = await apiGet<OrderListResponse>('/api/orders', true);
  return response.items ?? [];
}

/** One page of the customer's orders, newest first, optionally filtered. */
export async function fetchOrdersPage(filter: OrderFilter | null, page = 1, limit = ORDERS_PAGE_SIZE): Promise<OrderListResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter) query.set('status', filter);
  return apiGet<OrderListResponse>(`/api/orders?${query.toString()}`, true);
}

export async function fetchOrderQuote(): Promise<OrderQuote> {
  return apiGet<OrderQuote>('/api/orders/quote', true);
}

export async function fetchOrderById(orderId: string): Promise<Order> {
  return apiGet<Order>(`/api/orders/${orderId}`, true);
}

export async function cancelOrder(orderId: string): Promise<Order> {
  return apiPatch<Order>(`/api/orders/${orderId}/status`, { status: 'CANCELLED' }, true);
}
