import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartBar } from '@/components/cart-bar';
import { FilterChip } from '@/components/filter-chip';
import { MenuItemRow } from '@/components/menu-item-row';
import { restaurantStatusMeta } from '@/components/restaurant-card';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen } from '@/components/ui/screen';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, IconSize, Spacing } from '@/constants/theme';
import type { MenuItem } from '@/services/menus';
import { addToCart, describeCartError, isCartRestaurantConflict, replaceCartWith, setCartQuantity, useCart } from '@/state/cart';
import { groupMenu, type MenuSection, useMenu, useRestaurant } from '@/state/catalog';
import { useConfirm } from '@/hooks/use-confirm';
import { t } from '@/i18n';
import { unavailableMessage } from '@/utils/restaurant-availability';

export default function RestaurantScreen() {
  const [confirmDialog, confirm] = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const restaurant = useRestaurant(id);
  const menu = useMenu(id);
  const { data: cart } = useCart();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const listRef = useRef<SectionList<MenuItem, MenuSection>>(null);

  const sections = groupMenu(menu.data);
  const quantities = new Map(
    cart?.restaurantId === id ? cart.items.map((item) => [item.menuItemId, item.quantity] as const) : [],
  );

  const handleAdd = async (item: MenuItem) => {
    setActionError(null);
    setPendingId(item.id);
    try {
      await addToCart(item.id);
    } catch (error) {
      if (isCartRestaurantConflict(error)) {
        const startNew = await confirm({
          testID: 'new-cart-dialog',
          icon: 'bag',
          title: t('Start a new cart?'),
          message: t('Your cart has items from another restaurant. Clear it and add {name}?', { name: item.name }),
          confirmLabel: t('Start new cart'),
          destructive: true,
        });
        if (startNew) {
          await replaceCartWith(item.id).catch((replaceError: unknown) => setActionError(messageOf(replaceError)));
        }
      } else {
        setActionError(messageOf(error));
      }
    } finally {
      setPendingId(null);
    }
  };

  const handleQuantity = (item: MenuItem, quantity: number) => {
    setActionError(null);
    setCartQuantity(item.id, quantity).catch((error: unknown) => setActionError(messageOf(error)));
  };

  const refresh = () => {
    void restaurant.refresh();
    void menu.refresh();
  };

  const backButton = (
    <View style={[styles.floatingBack, { top: insets.top + Spacing.two }]}>
      <IconButton icon="back" accessibilityLabel={t('Go back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
    </View>
  );

  if (restaurant.isLoading) {
    return (
      <Screen edges={[]}>
        <Skeleton height={220 + insets.top} radius={0} />
        <View style={styles.loadingBody}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" />
        </View>
        <SkeletonList count={3} />
        {backButton}
      </Screen>
    );
  }

  if (!restaurant.data) {
    return (
      <Screen>
        <ErrorState error={restaurant.error} onRetry={refresh} />
        {backButton}
      </Screen>
    );
  }

  const info = restaurant.data;
  const status = restaurantStatusMeta[info.status] ?? restaurantStatusMeta.CLOSED;
  // #286: BUSY restaurants take no orders either; the menu stays browsable and the cart is kept.
  const notice = unavailableMessage(info.status);

  const header = (
    <View>
      <View style={[styles.hero, { height: 200 + insets.top }]}>
        {info.coverImageUrl ? (
          <Image source={info.coverImageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.heroFallback}>
            <Icon name="food" size={48} color={BrandColors.packageTan} />
          </View>
        )}
      </View>
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={styles.flex} accessibilityRole="header">
            {info.name}
          </ThemedText>
          <Badge label={status.label} tone={status.tone} />
        </View>
        {info.description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {info.description}
          </ThemedText>
        ) : null}
        <View style={styles.addressRow}>
          <Icon name="location" size={IconSize.sm} color={BrandColors.textMuted} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {info.address}
          </ThemedText>
        </View>
        {notice ? <InlineAlert tone="info" message={notice} testID="restaurant-unavailable" /> : null}
        {actionError ? <InlineAlert message={actionError} onDismiss={() => setActionError(null)} /> : null}
      </View>
      {sections.length > 1 ? (
        // Figma C-10: a chip per menu section that jumps to it.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} testID="menu-sections" nativeID="menu-sections">
          {sections.map((section, index) => (
            <FilterChip
              key={section.title}
              testID={`menu-section-${section.title}`}
              label={section.title}
              selected={(activeSection ?? sections[0].title) === section.title}
              onPress={() => {
                setActiveSection(section.title);
                listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: 0, animated: true });
              }}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]}>
      <SectionList
        ref={listRef}
        sections={sections}
        onScrollToIndexFailed={() => undefined}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="heading">{section.title}</ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <MenuItemRow
            item={item}
            quantityInCart={quantities.get(item.id) ?? 0}
            pending={pendingId === item.id}
            onAdd={handleAdd}
            onChangeQuantity={handleQuantity}
          />
        )}
        ItemSeparatorComponent={Divider}
        stickySectionHeadersEnabled
        initialNumToRender={10}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={menu.refreshing} onRefresh={refresh} tintColor={BrandColors.primary} colors={[BrandColors.primary]} />
        }
        ListEmptyComponent={
          menu.isLoading ? (
            <SkeletonList count={4} />
          ) : menu.error ? (
            <ErrorState error={menu.error} onRetry={() => void menu.refresh()} />
          ) : (
            <StateView icon="food" title={t('No menu yet')} message={t("This restaurant hasn't published any dishes.")} />
          )
        }
      />
      {backButton}
      <CartBar bottomInset={insets.bottom} />
      {confirmDialog}
    </Screen>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function messageOf(error: unknown): string {
  return describeCartError(error, t('Something went wrong. Please try again.'));
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  floatingBack: {
    position: 'absolute',
    start: Spacing.three,
  },
  loadingBody: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  hero: {
    backgroundColor: BrandColors.tanSoft,
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    paddingHorizontal: Spacing.four - Spacing.one,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four - Spacing.one,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.four - Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: BrandColors.background,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.border,
    marginHorizontal: Spacing.four - Spacing.one,
  },
  listContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },
});
