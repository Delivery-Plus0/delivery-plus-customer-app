import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useResource } from '@/hooks/use-resource';
import { TERMINAL_DELIVERY_STATUSES, type Delivery } from '@/services/deliveries';
import { fetchDeliveryTracking, type DeliveryTracking } from '@/services/tracking';
import { openTrackingStream } from '@/services/tracking-stream';
import { getResource, setResourceData } from '@/state/resource-cache';
import { TrackingRealtime, mergeTracking, type ConnectionState } from '@/state/tracking-realtime';

/** Fallback polling interval, only while the realtime stream is not open. */
export const TRACKING_POLL_MS = 10_000;

/**
 * Track every unfinished delivery the customer can see, with or without a driver: the backend's
 * `tracking` state (NO_DRIVER included) is the source of truth, not the delivery's `driverId`.
 * The delivery itself comes from the customer's own order (ownership checked by the backend), so
 * there is no way to ask for an arbitrary delivery from this screen.
 */
export function shouldTrack(delivery: Delivery | null | undefined): boolean {
  return !!delivery && !TERMINAL_DELIVERY_STATUSES.includes(delivery.status);
}

/** When this device received a snapshot, so the position's age can keep counting locally. */
export function stampReceived(snapshot: DeliveryTracking, now = Date.now()): DeliveryTracking {
  return { ...snapshot, receivedAt: now };
}

/**
 * Polling only while the stream can't deliver: off while it is open and once tracking ended.
 * A closed stream that never ended (refused, screen re-focused later) keeps polling as before.
 */
export function pollIntervalFor(connection: ConnectionState, tracking: DeliveryTracking | undefined): number {
  if (tracking?.tracking === 'ENDED') return 0;
  return connection === 'open' ? 0 : TRACKING_POLL_MS;
}

/**
 * Whether what is on screen is known to be current: the stream is open, or a refresh succeeded since
 * the stream went down. Otherwise the screen must not call a position "Live".
 */
export function isTrackingFresh(
  connection: ConnectionState,
  connectionSince: number,
  lastSuccessAt: number,
  refreshFailed: boolean,
): boolean {
  if (connection === 'open') return true;
  return !refreshFailed && lastSuccessAt >= connectionSince;
}

/**
 * Tracking data source for the order screen (Phase 7 Step 3, #136):
 * - primary: the realtime stream (Server-Sent Events) while the screen is focused; every snapshot
 *   it pushes is merged into the same resource-cache entry the UI already reads;
 * - fallback: the existing 10 s polling of GET /tracking/delivery/:id, only while the stream is not
 *   open (connecting, reconnecting with capped backoff, or refused);
 * - both paths go through mergeTracking, so duplicates and out-of-order snapshots can't move the pin
 *   backwards, and ENDED stays final.
 * Callers get the data plus the connection state and whether the data is fresh; they never see the
 * transport.
 */
export function useDeliveryTracking(delivery: Delivery | null | undefined) {
  // Read the id up front (React Compiler: no `delivery!.id` inside the fetcher).
  const deliveryId = shouldTrack(delivery) ? delivery?.id : undefined;
  const key = deliveryId ? `tracking:delivery:${deliveryId}` : null;
  const [connection, setConnection] = useState<{ state: ConnectionState; since: number }>({
    state: 'closed',
    since: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (!deliveryId || !key) return undefined;
      const realtime = new TrackingRealtime(deliveryId, openTrackingStream, {
        onSnapshot: (snapshot) =>
          setResourceData<DeliveryTracking>(key, (current) => mergeTracking(current, stampReceived(snapshot))),
        onState: (state, since) => setConnection({ state, since }),
      });
      realtime.start();
      return () => realtime.stop();
    }, [deliveryId, key]),
  );

  const resource = useResource<DeliveryTracking>(
    key,
    async () => {
      const polled = stampReceived(await fetchDeliveryTracking(deliveryId as string));
      return key ? mergeTracking(getResource<DeliveryTracking>(key).data, polled) : polled;
    },
    {
      staleTimeMs: 3_000,
      pollIntervalMs: (tracking) => pollIntervalFor(connection.state, tracking),
    },
  );

  const lastSuccessAt = key ? getResource<DeliveryTracking>(key).updatedAt : 0;

  return {
    ...resource,
    connection: connection.state,
    fresh: isTrackingFresh(connection.state, connection.since, lastSuccessAt, resource.error !== undefined),
  };
}
