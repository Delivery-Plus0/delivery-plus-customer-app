import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import type { Delivery } from '@/services/deliveries';
import { useDeliveryTracking } from '@/state/tracking';
import { describeTracking, mapLink } from '@/utils/tracking';

/**
 * Where the driver is, for an assigned and unfinished delivery. Renders nothing when there's no
 * driver yet or tracking has ended; the delivery card above already covers those stages.
 */
export function DriverLocationCard({ delivery }: { delivery: Delivery | null | undefined }) {
  const tracking = useDeliveryTracking(delivery);
  const view = describeTracking(tracking.data);

  if (!tracking.data && tracking.error) {
    return (
      <Card style={styles.row}>
        <Icon name="error" size={IconSize.md} color={BrandColors.danger} />
        <ThemedText type="small" style={styles.flex}>
          {"We couldn't load your driver's location."}
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={() => void tracking.refresh()} hitSlop={8}>
          <ThemedText type="linkPrimary">Retry</ThemedText>
        </Pressable>
      </Card>
    );
  }

  if (!view) return null;

  const position = view.hasPosition ? tracking.data?.location : null;
  const live = view.tone === 'live';

  return (
    <Card testID="driver-location">
      <View style={styles.row} accessible accessibilityLabel={`Driver location: ${view.label}. ${view.detail}`}>
        <View style={[styles.iconWrap, live ? styles.iconWrapLive : styles.iconWrapMuted]}>
          <Icon
            name="location"
            size={IconSize.md}
            color={live ? BrandColors.success : BrandColors.textSecondary}
          />
        </View>
        <View style={styles.flex}>
          <ThemedText type="caption" themeColor="textSecondary">
            DRIVER LOCATION
          </ThemedText>
          <ThemedText type="defaultBold" testID="driver-location-status">
            {view.label}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {view.detail}
      </ThemedText>
      {position ? (
        <Pressable
          testID="driver-location-map"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(mapLink(position.latitude, position.longitude))}
          hitSlop={8}>
          <ThemedText type="linkPrimary">Open in map</ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLive: {
    backgroundColor: BrandColors.successSoft,
  },
  iconWrapMuted: {
    backgroundColor: BrandColors.surfaceMuted,
  },
});
