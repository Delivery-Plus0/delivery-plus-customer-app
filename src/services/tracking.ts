import { apiGet } from '@/services/api';
import type { DeliveryStatus } from '@/services/deliveries';

/**
 * tracking-service lifecycle state for one delivery (backend #32): exactly one per read.
 * - NO_DRIVER: no driver assigned yet
 * - AWAITING_LOCATION: assigned, no position reported yet (or it expired)
 * - LIVE / STALE: a position, recent or older than the backend threshold ("last seen")
 * - ENDED: delivered or cancelled; no position is returned any more
 */
export type TrackingState = 'NO_DRIVER' | 'AWAITING_LOCATION' | 'LIVE' | 'STALE' | 'ENDED';

/** ETA as tracking-service derives it (#46). Anything but ESTIMATED means "no ETA". */
export type DeliveryEta =
  | { status: 'UNAVAILABLE'; reason: string }
  | {
      status: 'ESTIMATED';
      seconds: number;
      driverId: string;
      assignedAt: string | null;
      basedOnLocationAt: string;
      computedAt: string;
      validUntil: string;
    };

export type DriverPosition = {
  latitude: number;
  longitude: number;
  updatedAt: string;
};

/** `GET /api/tracking/delivery/:id` as returned by the Gateway. */
export type DeliveryTracking = {
  deliveryId: string;
  status: DeliveryStatus;
  driverId?: string | null;
  location: DriverPosition | null;
  tracking: TrackingState;
  locationAgeSeconds: number | null;
  /** Assignment contract (backend #46): who is assigned and when; null without a driver. */
  assignment?: { driverId: string; assignedAt: string | null } | null;
  /** ETA contract (backend #46): only ESTIMATED may be shown, and only until validUntil. */
  eta?: DeliveryEta;
  /** Client-only: when this device received the snapshot (ms epoch), to age the position locally. */
  receivedAt?: number;
};

/** The customer's view of the driver's position; delivery-service checks they own the order. */
export async function fetchDeliveryTracking(deliveryId: string): Promise<DeliveryTracking> {
  return apiGet<DeliveryTracking>(`/api/tracking/delivery/${deliveryId}`, true);
}
