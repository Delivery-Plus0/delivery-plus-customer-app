import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '@/config/map';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { isValidPosition, tilesForViewport, TILE_SIZE, type LatLng } from '@/utils/map-tiles';
import { t } from '@/i18n';

/** Street level: a few blocks around the driver. */
const ZOOM = 15;
const HEIGHT = 200;

type TrackingMapProps = {
  position: LatLng;
  /** `stale` dims the map and greys the pin so an old position never looks current. */
  freshness: 'live' | 'stale';
};

/**
 * A static street map centred on the driver, built from raster tiles (no native map SDK, so it
 * renders the same on iOS, Android and web). Purely presentational: it draws the position it is
 * given and nothing else: no interpolation, no route. If tiles fail to load, the pin still shows.
 */
export function TrackingMap({ position, freshness }: TrackingMapProps) {
  const [width, setWidth] = useState(0);
  const [failedTiles, setFailedTiles] = useState(0);

  if (!isValidPosition(position)) return null;

  const tiles = tilesForViewport(position, ZOOM, width, HEIGHT, MAP_TILE_URL);
  const stale = freshness === 'stale';
  const tilesUnavailable = tiles.length > 0 && failedTiles >= tiles.length;

  return (
    <View
      testID="tracking-map"
      // On web the accessibility label becomes aria-label, which Maestro would take as this
      // element's id; nativeID renders as the HTML id, which it prefers.
      nativeID="tracking-map"
      style={styles.map}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={stale ? "Map showing your driver's last known location" : "Map showing your driver's location"}>
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={tile.url}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
          cachePolicy="memory-disk"
          onError={() => setFailedTiles((count) => count + 1)}
        />
      ))}
      {stale ? <View style={styles.staleVeil} /> : null}
      {tilesUnavailable ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.unavailable}>
          {t('Map unavailable')}
        </ThemedText>
      ) : null}

      <View pointerEvents="none" style={styles.pinAnchor}>
        <View
          testID="driver-marker"
          style={[styles.pinLabel, stale ? styles.pinLabelStale : styles.pinLabelLive]}>
          <Icon name="location" size={IconSize.sm} color={BrandColors.onPrimary} />
          <ThemedText type="caption" style={styles.pinText}>
            {t('Driver')}
          </ThemedText>
        </View>
        <View style={[styles.pinDot, stale ? styles.pinDotStale : styles.pinDotLive]} />
      </View>

      <ThemedText type="caption" themeColor="textSecondary" style={styles.attribution}>
        {MAP_ATTRIBUTION}
      </ThemedText>
    </View>
  );
}

const DOT = 14;

const styles = StyleSheet.create({
  map: {
    height: HEIGHT,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: BrandColors.surfaceMuted,
  },
  tile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  staleVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  unavailable: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
  },
  // The dot's centre sits exactly on the map centre (the driver's position); the label floats above.
  pinAnchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    transform: [{ translateX: -40 }, { translateY: -(DOT / 2) - 30 }],
    width: 80,
  },
  pinLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginBottom: 4,
  },
  pinLabelLive: {
    backgroundColor: BrandColors.primary,
  },
  pinLabelStale: {
    backgroundColor: BrandColors.textMuted,
  },
  pinText: {
    color: BrandColors.onPrimary,
  },
  pinDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 3,
    borderColor: BrandColors.surface,
  },
  pinDotLive: {
    backgroundColor: BrandColors.primary,
  },
  pinDotStale: {
    backgroundColor: BrandColors.textMuted,
  },
  attribution: {
    position: 'absolute',
    right: Spacing.one,
    bottom: 2,
    fontSize: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 4,
  },
});
