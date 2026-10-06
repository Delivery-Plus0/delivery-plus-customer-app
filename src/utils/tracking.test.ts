import { describe, expect, it } from 'vitest';

import type { DeliveryTracking } from '@/services/tracking';

import { describeTracking, formatLocationAge, mapLink } from './tracking';

const base: DeliveryTracking = {
  deliveryId: 'd-1',
  status: 'IN_TRANSIT',
  driverId: 'driver-1',
  location: { latitude: 30.0444, longitude: 31.2357, updatedAt: '2026-10-06T12:00:00.000Z' },
  tracking: 'LIVE',
  locationAgeSeconds: 8,
};

describe('formatLocationAge', () => {
  it('reads naturally across ranges', () => {
    expect(formatLocationAge(0)).toBe('just now');
    expect(formatLocationAge(4)).toBe('just now');
    expect(formatLocationAge(8)).toBe('8 s ago');
    expect(formatLocationAge(59)).toBe('59 s ago');
    expect(formatLocationAge(60)).toBe('1 min ago');
    expect(formatLocationAge(185)).toBe('3 min ago');
    expect(formatLocationAge(7200)).toBe('2 h ago');
  });
});

describe('describeTracking', () => {
  it('shows nothing before a driver is assigned, after tracking ended, or without data', () => {
    expect(describeTracking({ ...base, tracking: 'NO_DRIVER', location: null, locationAgeSeconds: null })).toBeNull();
    expect(describeTracking({ ...base, tracking: 'ENDED', location: null, locationAgeSeconds: null })).toBeNull();
    expect(describeTracking(undefined)).toBeNull();
  });

  it('waits for the first position without offering a map', () => {
    const view = describeTracking({ ...base, tracking: 'AWAITING_LOCATION', location: null, locationAgeSeconds: null });
    expect(view).toMatchObject({ label: "Waiting for your driver's location", hasPosition: false, tone: 'muted' });
  });

  it('labels a recent position as live with its age', () => {
    expect(describeTracking(base)).toMatchObject({ label: 'Live · updated 8 s ago', hasPosition: true, tone: 'live' });
  });

  it('labels an old position as last seen, still with a position', () => {
    const view = describeTracking({ ...base, tracking: 'STALE', locationAgeSeconds: 240 });
    expect(view).toMatchObject({ label: 'Last seen 4 min ago', hasPosition: true, tone: 'muted' });
  });
});

describe('mapLink', () => {
  it('pins the position on OpenStreetMap', () => {
    expect(mapLink(30.0444, 31.2357)).toBe(
      'https://www.openstreetmap.org/?mlat=30.0444&mlon=31.2357#map=16/30.0444/31.2357',
    );
  });
});
