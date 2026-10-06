import type { DeliveryTracking } from '@/services/tracking';

/** "just now", "8 s ago", "3 min ago", "2 h ago". */
export function formatLocationAge(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ago`;
}

export type TrackingView = {
  /** Short status line, e.g. "Live · updated 8 s ago". */
  label: string;
  detail: string;
  /** True when a position can be shown (LIVE or STALE). */
  hasPosition: boolean;
  tone: 'live' | 'muted';
};

/**
 * What the order screen says about the driver's position. `null` when there is nothing to show:
 * no driver yet (the delivery card already says "Finding a driver") or tracking has ended.
 */
export function describeTracking(tracking: DeliveryTracking | undefined): TrackingView | null {
  if (!tracking) return null;
  switch (tracking.tracking) {
    case 'AWAITING_LOCATION':
      return {
        label: "Waiting for your driver's location",
        detail: 'It appears here as soon as their app shares it.',
        hasPosition: false,
        tone: 'muted',
      };
    case 'LIVE':
      return {
        label: `Live · updated ${formatLocationAge(tracking.locationAgeSeconds ?? 0)}`,
        detail: "Your driver's position updates every few seconds.",
        hasPosition: tracking.location !== null,
        tone: 'live',
      };
    case 'STALE':
      return {
        label: `Last seen ${formatLocationAge(tracking.locationAgeSeconds ?? 0)}`,
        detail: "Your driver's position hasn't updated recently.",
        hasPosition: tracking.location !== null,
        tone: 'muted',
      };
    default:
      return null;
  }
}

/** A map link for a position (OpenStreetMap: no API key, opens in the browser or a maps app). */
export function mapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}
