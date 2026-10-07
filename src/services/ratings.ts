import { apiGet, apiPost } from '@/services/api';

/** delivery-service `RatingDto` (#144). */
export type DriverRating = { score: number; comment: string | null; createdAt: string };

/** GET /api/deliveries/:id/rating: the stored rating, or whether the backend accepts one now. */
export type DeliveryRatingStatus = {
  rating: DriverRating | null;
  canRate: boolean;
  /** Why rating is not possible, as the backend words it; null when canRate. */
  reason: string | null;
  closesAt: string | null;
};

export function fetchDeliveryRating(deliveryId: string): Promise<DeliveryRatingStatus> {
  return apiGet<DeliveryRatingStatus>(`/api/deliveries/${deliveryId}/rating`, true);
}

/** Every eligibility rule is checked by the backend (owner, delivered, 14 days, once). */
export function submitDeliveryRating(deliveryId: string, score: number, comment: string): Promise<DriverRating> {
  const trimmed = comment.trim();
  return apiPost<DriverRating>(`/api/deliveries/${deliveryId}/rating`, trimmed ? { score, comment: trimmed } : { score }, true);
}
