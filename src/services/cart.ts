import { apiDelete, apiGet, apiPatch, apiPost } from '@/services/api';

/** The most of one item a cart may hold; the backend enforces the same cap (#42). */
export const MAX_ITEM_QUANTITY = 20;

export type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

export type Cart = {
  userId: string;
  restaurantId: string | null;
  items: CartItem[];
  updatedAt: string;
  /** Server-computed subtotal (cart-service `CartWithTotal`). */
  total: number;
};

export async function fetchCart(): Promise<Cart> {
  return apiGet<Cart>('/api/cart', true);
}

export async function addCartItem(payload: { menuItemId: string; quantity: number }): Promise<Cart> {
  return apiPost<Cart>('/api/cart/items', payload, true);
}

export async function updateCartItem(menuItemId: string, quantity: number): Promise<Cart> {
  return apiPatch<Cart>(`/api/cart/items/${menuItemId}`, { quantity }, true);
}

export async function removeCartItem(menuItemId: string): Promise<Cart> {
  return apiDelete<Cart>(`/api/cart/items/${menuItemId}`, true);
}

export async function clearCart(): Promise<void> {
  await apiDelete('/api/cart', true);
}
