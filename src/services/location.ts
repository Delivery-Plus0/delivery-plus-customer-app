import * as Location from 'expo-location';

import { parseFixedLocation, roundPoint } from '@/utils/delivery-location';

/**
 * Development and E2E builds only: `EXPO_PUBLIC_FIXED_LOCATION="lat,lng"` reports that position instead
 * of the device's, because a browser under automation can neither grant nor fake geolocation. Release
 * builds don't set it, so they always use the device.
 */
const FIXED_LOCATION = parseFixedLocation(process.env.EXPO_PUBLIC_FIXED_LOCATION);

/**
 * The device's position for the delivery location (#54), or null when the customer refuses access or
 * the device can't tell. Asks for "while using the app" permission the first time.
 */
export async function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (FIXED_LOCATION) return FIXED_LOCATION;
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  try {
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return roundPoint({ latitude: coords.latitude, longitude: coords.longitude });
  } catch {
    return null;
  }
}
