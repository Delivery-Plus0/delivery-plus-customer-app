import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LocationMap, MAP_AVAILABLE } from '@/components/location-map';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { FormTextInput } from '@/components/ui/form-text-input';
import { Icon } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { currentPosition } from '@/services/location';
import { setDeliveryLocation } from '@/state/delivery-location';
import { parseCoordinate, type DeliveryLocation } from '@/utils/delivery-location';

/**
 * "Where should we deliver?" (#54), before the restaurant list: the device's location, or a pin on the
 * map (with the coordinates as text, for keyboards and tests). Only restaurants that deliver to the
 * chosen point are listed afterwards.
 */
export function DeliveryLocationPicker({ current, onCancel }: { current: DeliveryLocation | null; onCancel?: () => void }) {
  const [latitude, setLatitude] = useState(current?.source === 'map' ? String(current.latitude) : '');
  const [longitude, setLongitude] = useState(current?.source === 'map' ? String(current.longitude) : '');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const lat = parseCoordinate(latitude, 'latitude');
  const lng = parseCoordinate(longitude, 'longitude');
  const pinError = lat === null || lng === null ? t('Tap the map, or enter both coordinates as numbers') : undefined;

  async function confirmDeviceLocation() {
    setLocating(true);
    setError(null);
    const position = await currentPosition();
    setLocating(false);
    if (!position) {
      setError(t('Your location is not available. Allow location access, or place a pin on the map instead.'));
      return;
    }
    await setDeliveryLocation({ ...position, source: 'device' });
  }

  async function confirmPin() {
    setTouched(true);
    if (lat === null || lng === null) return;
    await setDeliveryLocation({ latitude: lat, longitude: lng, source: 'map' });
  }

  return (
    <Card testID="delivery-location-picker">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="location" size={IconSize.md} color={BrandColors.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="defaultBold" accessibilityRole="header">
            {t('Where should we deliver?')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('We show the restaurants that deliver to you, nearest first.')}
          </ThemedText>
        </View>
      </View>

      <AppButton testID="location-use-current" title={t('Use my current location')} icon="location" loading={locating} onPress={() => void confirmDeviceLocation()} />
      {error ? <InlineAlert message={error} testID="location-error" /> : null}

      <ThemedText type="smallBold" style={styles.or}>
        {t('Or place a pin')}
      </ThemedText>
      {MAP_AVAILABLE ? (
        <LocationMap
          testID="location-map"
          latitude={lat}
          longitude={lng}
          onPick={(pickedLat, pickedLng) => {
            setLatitude(String(pickedLat));
            setLongitude(String(pickedLng));
          }}
        />
      ) : null}
      <View style={styles.coordinates}>
        <View style={styles.flex}>
          <FormTextInput testID="location-latitude" label={t('Latitude')} keyboardType="numbers-and-punctuation" value={latitude} onChangeText={setLatitude} placeholder="30.0444" />
        </View>
        <View style={styles.flex}>
          <FormTextInput testID="location-longitude" label={t('Longitude')} keyboardType="numbers-and-punctuation" value={longitude} onChangeText={setLongitude} placeholder="31.2357" />
        </View>
      </View>
      {touched && pinError ? <InlineAlert message={pinError} testID="location-pin-error" /> : null}
      <View style={styles.actions}>
        {onCancel ? <AppButton testID="location-cancel" title={t('Cancel')} variant="secondary" fullWidth={false} onPress={onCancel} /> : <View />}
        <AppButton testID="location-confirm" title={t('Deliver here')} variant="secondary" fullWidth={false} onPress={() => void confirmPin()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primarySoft,
  },
  or: { marginTop: Spacing.three, marginBottom: Spacing.two },
  coordinates: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
});
