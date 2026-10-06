import { useResource } from '@/hooks/use-resource';
import { TERMINAL_DELIVERY_STATUSES, type Delivery } from '@/services/deliveries';
import { fetchDeliveryTracking, type DeliveryTracking } from '@/services/tracking';

/** Same cadence as the driver app's location reports. */
const TRACKING_POLL_MS = 10_000;

/**
 * Track every unfinished delivery the customer can see, with or without a driver: the backend's
 * `tracking` state (NO_DRIVER included) is the source of truth, not the delivery's `driverId`.
 * The delivery itself comes from the customer's own order (ownership checked by the backend), so
 * there is no way to ask for an arbitrary delivery from this screen.
 */
export function shouldTrack(delivery: Delivery | null | undefined): boolean {
  return !!delivery && !TERMINAL_DELIVERY_STATUSES.includes(delivery.status);
}

/**
 * Tracking data source for the order screen. Transport (Phase 7 Step 2): polling through the shared
 * resource cache every 10 s while the screen is focused, stopping once the backend says ENDED; a
 * failed refresh keeps the last data and sets `error`. Step 3 replaces the transport behind this
 * hook (SSE/WebSocket with polling as fallback) without changing its callers.
 */
export function useDeliveryTracking(delivery: Delivery | null | undefined) {
  // Read the id up front (React Compiler: no `delivery!.id` inside the fetcher).
  const deliveryId = shouldTrack(delivery) ? delivery?.id : undefined;

  return useResource<DeliveryTracking>(
    deliveryId ? `tracking:delivery:${deliveryId}` : null,
    () => fetchDeliveryTracking(deliveryId as string),
    {
      staleTimeMs: 3_000,
      pollIntervalMs: (tracking) => (tracking?.tracking === 'ENDED' ? 0 : TRACKING_POLL_MS),
    },
  );
}
