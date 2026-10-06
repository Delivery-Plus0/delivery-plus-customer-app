import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrackingMap } from '@/components/tracking-map';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import type { Delivery } from '@/services/deliveries';
import { useDeliveryTracking } from '@/state/tracking';
import { describeTracking, mapLink, type TrackingView } from '@/utils/tracking';

const ICONS: Record<Exclude<TrackingView['kind'], 'hidden'>, IconName> = {
  finding: 'clock',
  awaiting: 'person',
  unavailable: 'location',
  position: 'location',
};

/**
 * Where the driver is, for an unfinished delivery: status line plus, when the backend returns a
 * usable position, a map with the driver pin. Data comes from useDeliveryTracking; what to show
 * comes from describeTracking (the single state → UI mapping). Renders nothing once tracking ended.
 */
export function DriverLocationCard({ delivery }: { delivery: Delivery | null | undefined }) {
  const tracking = useDeliveryTracking(delivery);
  const view = describeTracking({ tracking: tracking.data, refreshFailed: tracking.error !== undefined });

  if (!tracking.data && tracking.error) {
    return (
      <Card testID="driver-location-error" style={styles.row}>
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

  if (view.kind === 'hidden') return null;

  const live = view.kind === 'position' && view.freshness === 'live';

  return (
    <Card testID="driver-location">
      <View style={styles.row} accessible accessibilityLabel={`Driver location: ${view.title}. ${view.detail}`}>
        <View style={[styles.iconWrap, live ? styles.iconWrapLive : styles.iconWrapMuted]}>
          <Icon
            name={ICONS[view.kind]}
            size={IconSize.md}
            color={live ? BrandColors.primaryText : BrandColors.textSecondary}
          />
        </View>
        <View style={styles.flex}>
          <ThemedText type="caption" themeColor="textSecondary">
            DRIVER LOCATION
          </ThemedText>
          <View style={styles.titleRow}>
            {live ? <View style={styles.liveDot} /> : null}
            <ThemedText type="defaultBold" testID="driver-location-status">
              {view.title}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" testID="driver-location-detail">
            {view.detail}
          </ThemedText>
        </View>
      </View>

      {view.kind === 'position' ? (
        <>
          <TrackingMap position={view.position} freshness={view.freshness} />
          <Pressable
            testID="driver-location-map"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(mapLink(view.position.latitude, view.position.longitude))}
            hitSlop={8}>
            <ThemedText type="linkPrimary">Open in maps</ThemedText>
          </Pressable>
        </>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.primary,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLive: {
    backgroundColor: BrandColors.primarySoft,
  },
  iconWrapMuted: {
    backgroundColor: BrandColors.surfaceMuted,
  },
});
