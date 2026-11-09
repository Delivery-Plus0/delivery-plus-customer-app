import { describe, expect, it } from 'vitest';

import { formatDistance, locationLabel, parseCoordinate, parseFixedLocation, parseStoredLocation, roundPoint } from './delivery-location';

describe('delivery location (#54)', () => {
  it('reads the E2E fixed location and ignores anything else', () => {
    expect(parseFixedLocation('30.0444,31.2357')).toEqual({ latitude: 30.0444, longitude: 31.2357 });
    expect(parseFixedLocation(' 30.0444 , 31.2357 ')).toEqual({ latitude: 30.0444, longitude: 31.2357 });
    expect(parseFixedLocation('91,31')).toBeNull();
    expect(parseFixedLocation('abc')).toBeNull();
    expect(parseFixedLocation(undefined)).toBeNull();
  });

  it('parses typed coordinates within range', () => {
    expect(parseCoordinate('24,0889', 'latitude')).toBe(24.0889);
    expect(parseCoordinate('-181', 'longitude')).toBeNull();
    expect(parseCoordinate('', 'latitude')).toBeNull();
  });

  it('rounds to six decimals', () => {
    expect(roundPoint({ latitude: 30.04441234, longitude: 31.23571234, source: 'map' as const })).toEqual({ latitude: 30.044412, longitude: 31.235712, source: 'map' });
  });

  it('shows metres under a kilometre and one decimal under ten', () => {
    expect(formatDistance(0.02)).toBe('50 m');
    expect(formatDistance(0.437)).toBe('450 m');
    expect(formatDistance(2.44)).toBe('2.4 km');
    expect(formatDistance(12.6)).toBe('13 km');
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(-1)).toBeNull();
  });

  it('keeps only a valid stored location', () => {
    expect(parseStoredLocation('{"latitude":30,"longitude":31,"source":"device"}')).toEqual({ latitude: 30, longitude: 31, source: 'device' });
    expect(parseStoredLocation('{"latitude":30,"longitude":31,"source":"other"}')).toBeNull();
    expect(parseStoredLocation('{"latitude":300,"longitude":31,"source":"map"}')).toBeNull();
    expect(parseStoredLocation('not json')).toBeNull();
    expect(parseStoredLocation(null)).toBeNull();
  });

  it('labels how the location was chosen', () => {
    expect(locationLabel(null)).toBe('Choose a delivery location');
    expect(locationLabel({ latitude: 1, longitude: 2, source: 'device' })).toBe('Your current location');
    expect(locationLabel({ latitude: 1, longitude: 2, source: 'map' })).toBe('The pin you placed');
  });
});
