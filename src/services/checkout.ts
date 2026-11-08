import { createOrder, type CreateOrderDetails, type Order } from '@/services/orders';
import { createPayment, processPayment, type Payment } from '@/services/payments';

export type CheckoutResult = {
  order: Order;
  payment: Payment;
};

export async function submitCheckout(
  orderIdempotencyKey: string,
  paymentIdempotencyKey: string,
  details?: CreateOrderDetails,
): Promise<CheckoutResult> {
  const order = details ? await createOrder(orderIdempotencyKey, details) : await createOrder(orderIdempotencyKey);
  const pendingPayment = await createPayment(order.id, paymentIdempotencyKey);
  const payment = await processPayment(pendingPayment.id);

  return { order, payment };
}