import { ApiError } from '@/services/api';

/**
 * A 409 CartChanged from checkout (#42): the menu changed since these items went into the cart (a price,
 * a sold-out or removed item, a quantity over the cap). The backend has already updated the cart, so the
 * app reloads it and the quote; the customer sees the new lines and total before placing the order again.
 * The backend also lists the changes in `details.changes` for clients that show them one by one.
 */
export function isCartChanged(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 409 && error.error === 'CartChanged';
}
