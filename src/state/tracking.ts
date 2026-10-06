import { useResource } from '@/hooks/use-resource';
import { TERMINAL_DELIVERY_STATUSES, type Delivery } from '@/services/deliveries';
import { fetchDeliveryTracking, type DeliveryTracking } from '@/services/tracking';

/** Same cadence as the driver app's location reports. */
const TRACKING_POLL_MS = 10_000;

/** Only an assigned, unfinished delivery has a driver position worth asking for. */
export function shouldTrack(delivery: Delivery | null | undefined): boolean {
  return !!delivery && !!delivery.driverId && !TERMINAL_DELIVERY_STATUSES.includes(delivery.status);
}

/**
 * The driver's position for an in-flight delivery. Polling for now; a later step backs this hook
 * with server push without changing the screen that uses it.
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
