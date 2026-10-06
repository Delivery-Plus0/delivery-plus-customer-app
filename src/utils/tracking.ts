import type { DeliveryTracking } from '@/services/tracking';
import { isValidPosition, type LatLng } from '@/utils/map-tiles';

/** "just now", "8 s ago", "3 min ago", "2 h ago". */
export function formatLocationAge(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ago`;
}

/**
 * What the order screen shows for the driver's position. The backend's `tracking` state decides
 * the kind; the location is only ever used to place the pin, never to infer the state.
 */
export type TrackingView =
  | { kind: 'hidden' }
  | { kind: 'finding'; title: string; detail: string }
  | { kind: 'awaiting'; title: string; detail: string }
  | { kind: 'unavailable'; title: string; detail: string }
  | {
      kind: 'position';
      /** `live` only for a LIVE read whose refresh succeeded; otherwise the position is last known. */
      freshness: 'live' | 'stale';
      title: string;
      detail: string;
      position: LatLng;
    };

export type TrackingViewInput = {
  tracking: DeliveryTracking | undefined;
  /** The latest refresh failed: the data on screen may be outdated, so nothing is called "Live". */
  refreshFailed?: boolean;
};

const HIDDEN: TrackingView = { kind: 'hidden' };

/**
 * The single mapping from tracking-service state to UI (Phase 7 Step 2):
 * - NO_DRIVER → "Finding a driver", no map
 * - AWAITING_LOCATION → "Driver assigned · Waiting for location…", no map
 * - LIVE → "Live · Updated <age>", map + driver pin
 * - STALE → "Last known location · Updated <age>", map + muted pin
 * - ENDED, no data, or an unknown state → nothing (a finished delivery never shows a position)
 * A LIVE/STALE read without usable coordinates shows "location unavailable" without a pin.
 */
export function describeTracking({ tracking, refreshFailed = false }: TrackingViewInput): TrackingView {
  if (!tracking) return HIDDEN;

  switch (tracking.tracking) {
    case 'NO_DRIVER':
      return { kind: 'finding', title: 'Finding a driver', detail: "Your driver's location appears here once one is assigned." };
    case 'AWAITING_LOCATION':
      return { kind: 'awaiting', title: 'Driver assigned', detail: 'Waiting for location…' };
    case 'LIVE':
    case 'STALE': {
      if (!isValidPosition(tracking.location)) {
        return { kind: 'unavailable', title: 'Driver assigned', detail: "Your driver's location is unavailable right now." };
      }
      const position = { latitude: tracking.location.latitude, longitude: tracking.location.longitude };
      const updated = `Updated ${formatLocationAge(tracking.locationAgeSeconds ?? 0)}`;
      if (tracking.tracking === 'LIVE' && !refreshFailed) {
        return { kind: 'position', freshness: 'live', title: 'Live', detail: updated, position };
      }
      return {
        kind: 'position',
        freshness: 'stale',
        title: 'Last known location',
        detail: refreshFailed ? `${updated} · reconnecting…` : updated,
        position,
      };
    }
    default:
      return HIDDEN;
  }
}

/** A map link for a position (OpenStreetMap: no API key, opens in the browser or a maps app). */
export function mapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}
