import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { BrandColors, Radius, Spacing } from '@/constants/theme';
import type { DriverCard as DriverCardData } from '@/services/deliveries';

/**
 * Who is delivering (#140): photo (or initial), first name, vehicle and plate, exactly as the backend
 * shares them with the order's customer. Nothing here is computed or guessed on the device.
 */
export function DriverCard({ driver }: { driver: DriverCardData }) {
  const vehicle = [driver.vehicleType, driver.licensePlate].filter(Boolean).join(' · ');
  return (
    <Card testID="driver-card">
      <View style={styles.row} accessible accessibilityLabel={`Your driver: ${driver.displayName}${vehicle ? `, ${vehicle}` : ''}`}>
        <View style={styles.avatar}>
          {driver.avatarUrl ? (
            <Image source={driver.avatarUrl} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <ThemedText type="heading" style={styles.initial}>
              {driver.displayName.charAt(0).toUpperCase()}
            </ThemedText>
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText type="caption" themeColor="textSecondary">
            YOUR DRIVER
          </ThemedText>
          <ThemedText type="defaultBold" testID="driver-card-name">
            {driver.displayName}
          </ThemedText>
          {vehicle ? (
            <ThemedText type="small" themeColor="textSecondary" testID="driver-card-vehicle">
              {vehicle}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const AVATAR = 52;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: Radius.pill,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
  },
  initial: {
    color: BrandColors.primaryText,
  },
});
