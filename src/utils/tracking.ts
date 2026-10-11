import type { DeliveryTracking } from '@/services/tracking';
import { isValidPosition, type LatLng } from '@/utils/map-tiles';
import { t } from '@/i18n/core';

/** "just now", "8 s ago", "3 min ago", "2 h ago". */
export function formatLocationAge(seconds: number): string {
  if (seconds < 5) return t('just now');
  if (seconds < 60) return t('{n} s ago', { n: seconds });
  if (seconds < 3600) return t('{n} min ago', { n: Math.floor(seconds / 60) });
  return t('{n} h ago', { n: Math.floor(seconds / 3600) });
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
  /**
   * Whether the data is known to be current (realtime stream open, or a refresh succeeded since it
   * dropped). Defaults to `!refreshFailed`. When false, a position is shown as last known.
   */
  fresh?: boolean;
  /** Realtime connection state, for the caption under the status (Phase 7 Step 3). */
  connection?: 'connecting' | 'open' | 'reconnecting' | 'closed';
  /** Now (ms epoch): ages a position received at `tracking.receivedAt` locally. */
  now?: number;
};

/**
 * Caption under the status: how the screen is getting updates. Undefined when there's nothing worth
 * saying (still connecting, or no realtime at all).
 * - open → "Live updates"
 * - not open and data not fresh → "Reconnecting…"
 * - not open but polling keeps data fresh → "Updating every 10 s"
 */
export function describeConnection(connection: TrackingViewInput['connection'], fresh: boolean): string | undefined {
  if (connection === 'open') return t('Live updates');
  if (connection === 'reconnecting') return fresh ? t('Updating every 10 s') : t('Reconnecting…');
  return undefined;
}

/** Server age at receipt, plus the time since this device received it. */
export function currentLocationAge(tracking: DeliveryTracking, now?: number): number {
  const base = tracking.locationAgeSeconds ?? 0;
  if (now === undefined || tracking.receivedAt === undefined) return base;
  return base + Math.max(0, Math.floor((now - tracking.receivedAt) / 1000));
}

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
export function describeTracking({ tracking, refreshFailed = false, fresh, now }: TrackingViewInput): TrackingView {
  if (!tracking) return HIDDEN;
  const current = (fresh ?? true) && !refreshFailed;

  switch (tracking.tracking) {
    case 'NO_DRIVER':
      return { kind: 'finding', title: t('Finding a driver'), detail: t("Your driver's location appears here once one is assigned.") };
    case 'AWAITING_LOCATION':
      return { kind: 'awaiting', title: t('Driver assigned'), detail: t('Waiting for location…') };
    case 'LIVE':
    case 'STALE': {
      if (!isValidPosition(tracking.location)) {
        return { kind: 'unavailable', title: t('Driver assigned'), detail: t("Your driver's location is unavailable right now.") };
      }
      const position = { latitude: tracking.location.latitude, longitude: tracking.location.longitude };
      const updated = t('Updated {age}', { age: formatLocationAge(currentLocationAge(tracking, now)) });
      if (tracking.tracking === 'LIVE' && current) {
        return { kind: 'position', freshness: 'live', title: t('Live'), detail: updated, position };
      }
      return {
        kind: 'position',
        freshness: 'stale',
        title: t('Last known location'),
        detail: current ? updated : t('{updated} · reconnecting…', { updated }),
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
