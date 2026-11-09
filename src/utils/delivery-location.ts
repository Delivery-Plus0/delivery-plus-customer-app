import { t } from '@/i18n/core';

/** Where the customer wants the order delivered (#54): a point, and how it was chosen. */
export type DeliveryLocation = { latitude: number; longitude: number; source: 'device' | 'map' };

/**
 * The coordinate fields' input style (#78):
 * - `minWidth: 0` lets the input shrink to its half-width field. Without it a web `<input>` keeps its
 *   intrinsic width (~20 characters) and overflows the field: to the right in English (the text still
 *   shows), but to the left in Arabic, where the placeholder and the typed value end up outside the card.
 * - Coordinates are numbers, so they read left-to-right even in an Arabic (RTL) form.
 */
export const COORDINATE_INPUT_STYLE = { minWidth: 0, textAlign: 'left', writingDirection: 'ltr' } as const;

/** A finite coordinate pair within range, or false. */
export function isValidPoint(point: unknown): point is { latitude: number; longitude: number } {
  if (!point || typeof point !== 'object') return false;
  const { latitude, longitude } = point as Record<string, unknown>;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** Development and E2E builds only: `EXPO_PUBLIC_FIXED_LOCATION="lat,lng"`, as in the driver app. */
export function parseFixedLocation(value: string | undefined): { latitude: number; longitude: number } | null {
  if (!value) return null;
  const [latitude, longitude] = value.split(',').map((part) => Number(part.trim()));
  const point = { latitude, longitude };
  return isValidPoint(point) ? point : null;
}

/** A coordinate typed by hand: a finite number within range, or null. Accepts a comma as decimal separator. */
export function parseCoordinate(value: string, kind: 'latitude' | 'longitude'): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^-?\d{1,3}(\.\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Math.abs(number) <= (kind === 'latitude' ? 90 : 180) ? number : null;
}

/** About 10 cm: more is noise from a GPS fix or a tap. */
export function roundPoint<T extends { latitude: number; longitude: number }>(point: T): T {
  return { ...point, latitude: Math.round(point.latitude * 1e6) / 1e6, longitude: Math.round(point.longitude * 1e6) / 1e6 };
}

/** "450 m" under a kilometre, then "2.4 km". */
export function formatDistance(km: number | null | undefined): string | null {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) return t('{meters} m', { meters: Math.max(50, Math.round((km * 1000) / 50) * 50) });
  return t('{km} km', { km: km < 10 ? km.toFixed(1) : String(Math.round(km)) });
}

export function locationLabel(location: DeliveryLocation | null): string {
  if (!location) return t('Choose a delivery location');
  return location.source === 'device' ? t('Your current location') : t('The pin you placed');
}

/** The stored value, when it is still a usable location; anything else is dropped. */
export function parseStoredLocation(raw: string | null): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DeliveryLocation>;
    const source = value?.source;
    if (!isValidPoint(value) || (source !== 'device' && source !== 'map')) return null;
    return { latitude: value.latitude, longitude: value.longitude, source };
  } catch {
    return null;
  }
}
