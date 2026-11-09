import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { CartBar } from '@/components/cart-bar';
import { DeliveryLocationPicker } from '@/components/delivery-location-picker';
import { FilterChip } from '@/components/filter-chip';
import { RestaurantCard } from '@/components/restaurant-card';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, FontFamily, IconSize, Layout, Radius, Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { Restaurant, RestaurantStatus } from '@/services/restaurants';
import { useAuthSession } from '@/services/session';
import { cartItemCount, useCart } from '@/state/cart';
import { useRestaurants } from '@/state/catalog';
import { useProfile } from '@/state/profile';
import { dismissLocationPicker, useDeliveryLocation } from '@/state/delivery-location';
import { locationLabel, type DeliveryLocation } from '@/utils/delivery-location';
import { firstName, greetingFor } from '@/utils/format';
import { t } from '@/i18n';

type Filter = { id: string; status?: RestaurantStatus };

// `id` stays English (test ids); the label is translated when shown (#151).
const FILTERS: Filter[] = [{ id: 'All' }, { id: 'Open now', status: 'OPEN' }];
const filterLabel = (filter: Filter) => (filter.status ? t('Open now') : t('All'));

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState<Filter>(FILTERS[0]);
  const debouncedSearch = useDebouncedValue(search);
  // #54: the delivery location comes first; the list shows only restaurants that deliver there.
  const { location, loaded, pickerRequested } = useDeliveryLocation();
  const [changingFrom, setChangingFrom] = useState<DeliveryLocation | null | undefined>(undefined);
  const showPicker = loaded && (!location || pickerRequested || (changingFrom !== undefined && changingFrom === location));

  const restaurants = useRestaurants({
    search: debouncedSearch,
    status: filter.status,
    limit: 50,
    ...(location ? { lat: location.latitude, lng: location.longitude } : {}),
  });
  const { data: cart } = useCart();
  const { data: profile } = useProfile();
  const { session } = useAuthSession();

  const name = firstName(profile?.fullName) ?? session?.user.email.split('@')[0];
  const items = restaurants.data?.items ?? [];
  const isSearching = debouncedSearch.trim().length > 0 || Boolean(filter.status);

  const openRestaurant = (restaurant: Restaurant) => {
    router.push({ pathname: '/restaurant/[id]', params: { id: restaurant.id } });
  };

  const changeLocation = () => setChangingFrom(location);
  const cancelChange = () => {
    setChangingFrom(undefined);
    dismissLocationPicker();
  };

  const renderBody = () => {
    if (!loaded) return <SkeletonList count={3} itemHeight={120} />;
    if (showPicker) {
      return (
        <View style={styles.pickerWrap}>
          <DeliveryLocationPicker current={location} onCancel={location ? cancelChange : undefined} />
        </View>
      );
    }
    if (restaurants.isLoading) return <SkeletonList count={3} itemHeight={120} />;
    if (restaurants.error && !restaurants.data) {
      return <ErrorState error={restaurants.error} onRetry={() => void restaurants.refresh()} />;
    }
    return null;
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="small" themeColor="textSecondary">
            {greetingFor()}
            {name ? `, ${name}` : ''}
          </ThemedText>
          <ThemedText type="subtitle" accessibilityRole="header" testID="home-title">
            {t('What are you craving?')}
          </ThemedText>
        </View>
        <IconButton
          testID="home-cart"
          icon="bag"
          accessibilityLabel={t('Cart')}
          badgeCount={cartItemCount(cart)}
          onPress={() => router.push('/cart')}
        />
      </View>

      {location && !showPicker ? (
        <Pressable
          testID="delivery-location"
          nativeID="delivery-location"
          accessibilityRole="button"
          accessibilityLabel={t('Delivering to {place}. Change the delivery location.', { place: locationLabel(location) })}
          onPress={changeLocation}
          style={styles.locationRow}
        >
          <Icon name="location" size={IconSize.sm} color={BrandColors.primaryText} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('Deliver to')}
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flexShrink} testID="delivery-location-label">
            {locationLabel(location)}
          </ThemedText>
          <ThemedText type="linkPrimary" testID="delivery-location-change" nativeID="delivery-location-change">
            {t('Change')}
          </ThemedText>
        </Pressable>
      ) : null}

      {showPicker ? null : (
      <View style={styles.searchWrap}>
        <View style={[styles.search, searchFocused && styles.searchFocused]}>
          <Icon name="search" size={IconSize.md} color={BrandColors.textMuted} />
          <TextInput
            testID="home-search"
            nativeID="home-search"
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t('Search restaurants')}
            placeholderTextColor={BrandColors.textMuted}
            accessibilityLabel={t('Search restaurants')}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('Clear search')} hitSlop={8} onPress={() => setSearch('')}>
              <Icon name="close" size={IconSize.sm} color={BrandColors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filters}>
          {FILTERS.map((option) => {
            const selected = option.id === filter.id;
            return (
              <FilterChip
                key={option.id}
                testID={`filter-${option.id}`}
                label={filterLabel(option)}
                selected={selected}
                onPress={() => setFilter(option)}
              />
            );
          })}
        </View>
      </View>
      )}

      {renderBody() ?? (
        <FlatList
          data={items}
          keyExtractor={(restaurant) => restaurant.id}
          renderItem={({ item }) => <RestaurantCard restaurant={item} onPress={openRestaurant} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            isSearching && items.length > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.count} testID="home-result-count">
                {t('{count} restaurants', { count: restaurants.data?.total ?? items.length })}
              </ThemedText>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={4}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={restaurants.refreshing}
              onRefresh={() => void restaurants.refresh()}
              tintColor={BrandColors.primary}
              colors={[BrandColors.primary]}
            />
          }
          ListEmptyComponent={
            <StateView
              testID="home-empty"
              icon={isSearching ? 'search' : 'location'}
              actionLabel={isSearching ? t('Clear search') : t('Change location')}
              onAction={
                isSearching
                  ? () => {
                      setSearch('');
                      setFilter(FILTERS[0]);
                    }
                  : changeLocation
              }
              title={isSearching ? t('No matches') : t('No restaurants deliver here yet')}
              message={
                isSearching
                  ? t('Try a different name or clear the filters.')
                  : t('We are adding restaurants area by area. Try a delivery location closer to the city centre, or check back soon.')
              }
            />
          }
        />
      )}

      <CartBar />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  count: {
    paddingBottom: Spacing.two,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  flexShrink: {
    flexShrink: 1,
  },
  pickerWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 96,
  },
  searchWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: Layout.inputHeight - 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  searchFocused: {
    borderWidth: 2,
    borderColor: BrandColors.text,
    paddingHorizontal: Spacing.three - 1,
  },
  searchInput: {
    flex: 1,
    outlineWidth: 0,
    height: '100%',
    fontSize: 16,
    fontFamily: FontFamily.regular,
    color: BrandColors.text,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  chipSelected: {
    backgroundColor: BrandColors.text,
    borderColor: BrandColors.text,
  },
  chipText: {
    color: BrandColors.text,
  },
  chipTextSelected: {
    color: BrandColors.surface,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 96,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.three,
  },
});
