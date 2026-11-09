import { Image } from 'expo-image';
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { BrandColors, Radius, Spacing } from '@/constants/theme';
import type { DriverCard as DriverCardData } from '@/services/deliveries';
import { t } from '@/i18n';

/**
 * Who is delivering (#140): photo (or initial), first name, vehicle and plate, exactly as the backend
 * shares them with the order's customer. Nothing here is computed or guessed on the device.
 */
export function DriverCard({ driver, phone }: { driver: DriverCardData; phone?: string | null }) {
  const vehicle = [driver.vehicleType, driver.licensePlate].filter(Boolean).join(' · ');
  return (
    <Card testID="driver-card">
      <View style={styles.row} accessible accessibilityLabel={t('Your driver: {name}', { name: vehicle ? `${driver.displayName}, ${vehicle}` : driver.displayName })}>
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
            {t('YOUR DRIVER')}
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
        {/* #54: the backend sends the phone only while the delivery is active, so the button goes with it. */}
        {phone ? (
          <AppButton
            testID="driver-card-call"
            title={t('Call')}
            icon="phone"
            variant="secondary"
            size="sm"
            fullWidth={false}
            accessibilityHint={t('Calls your driver')}
            onPress={() => void Linking.openURL(`tel:${phone}`)}
          />
        ) : null}
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
