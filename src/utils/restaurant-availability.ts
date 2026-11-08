import { t } from '@/i18n';
import { ApiError } from '@/services/api';
import type { RestaurantStatus } from '@/services/restaurants';

/**
 * #286 (owner decision): only an OPEN restaurant takes new orders. A BUSY one is temporary, so the
 * customer can keep browsing and filling the cart and is told to try again shortly; CLOSED and
 * SUSPENDED read as closed. The backend enforces it at checkout (409 RestaurantBusy / RestaurantClosed);
 * this only explains it before the customer taps "Place order".
 */
export function takesOrders(status: RestaurantStatus | undefined): boolean {
  return status === undefined || status === 'OPEN';
}

/** What to tell the customer about a restaurant that isn't taking orders, or null when it is. */
export function unavailableMessage(status: RestaurantStatus | undefined): string | null {
  if (takesOrders(status)) return null;
  if (status === 'BUSY') {
    return t("The restaurant is busy right now and isn't taking new orders. Try again in a few minutes. Your cart is saved.");
  }
  return t("This restaurant isn't taking orders right now. You can still browse the menu.");
}

/** True when checkout was refused because the restaurant stopped taking orders (409 RestaurantBusy / RestaurantClosed). */
export function isRestaurantUnavailable(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.error === 'RestaurantBusy' || error.error === 'RestaurantClosed');
}

/** The message for a refused checkout, from the error code the backend sent. */
export function unavailableErrorMessage(error: ApiError): string {
  return unavailableMessage(error.error === 'RestaurantBusy' ? 'BUSY' : 'CLOSED') ?? '';
}
