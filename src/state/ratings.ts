import { useResource } from '@/hooks/use-resource';
import { fetchDeliveryRating, submitDeliveryRating, type DeliveryRatingStatus } from '@/services/ratings';
import { setResourceData } from '@/state/resource-cache';

const ratingKey = (deliveryId: string) => `rating:${deliveryId}`;

/** The rating status of a delivered order's delivery; pass null until the delivery is DELIVERED. */
export function useDeliveryRating(deliveryId: string | null) {
  return useResource<DeliveryRatingStatus>(deliveryId ? ratingKey(deliveryId) : null, () => fetchDeliveryRating(deliveryId!), {
    staleTimeMs: 60_000,
  });
}

/** Stores the rating, then shows it as done without another round trip. */
export async function rateDelivery(deliveryId: string, score: number, comment: string): Promise<void> {
  const rating = await submitDeliveryRating(deliveryId, score, comment);
  setResourceData<DeliveryRatingStatus>(ratingKey(deliveryId), (previous) => ({
    rating,
    canRate: false,
    reason: 'You already rated this delivery.',
    closesAt: previous?.closesAt ?? null,
  }));
}
