import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { OrderCard } from '@/components/order-card';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, Radius, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api';
import { fetchOrdersPage, isActiveOrder, type Order, type OrderFilter } from '@/services/orders';
import { useOrdersPage } from '@/state/orders';
import { ORDER_FILTER_OPTIONS, mergeOrderPages } from '@/utils/order-outcome';
import { t } from '@/i18n';

// A function, so the titles follow the current language (#151).
const emptyTitle = (filter: string): string =>
  filter === 'active'
    ? t('Nothing on the way')
    : filter === 'completed'
      ? t('No delivered orders yet')
      : filter === 'cancelled'
        ? t('No cancelled or failed orders')
        : t('No orders yet');

function buildSections(orders: Order[], filter: OrderFilter | null) {
  // The backend already returns newest first; "All" groups what is still going above the rest.
  if (filter) return orders.length ? [{ title: '', data: orders }] : [];
  const active = orders.filter(isActiveOrder);
  const past = orders.filter((order) => !isActiveOrder(order));
  return [
    ...(active.length ? [{ title: t('In progress'), data: active }] : []),
    ...(past.length ? [{ title: t('Past orders'), data: past }] : []),
  ];
}

export default function OrdersScreen() {
  const [filter, setFilter] = useState<OrderFilter | null>(null);

  return (
    <Screen>
      <ScreenHeader title={t('Orders')} />
      <View style={styles.filters} accessibilityRole="tablist">
        {ORDER_FILTER_OPTIONS.map((option) => {
          const selected = option.key === filter;
          return (
            <Pressable
              key={option.testID}
              testID={option.testID}
              nativeID={option.testID}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option.key)}
              style={[styles.chip, selected && styles.chipSelected]}>
              <ThemedText type="smallBold" style={selected ? styles.chipTextSelected : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {/* Keyed by filter: switching filters starts again from page 1. */}
      <OrdersList key={filter ?? 'all'} filter={filter} />
    </Screen>
  );
}

function OrdersList({ filter }: { filter: OrderFilter | null }) {
  const first = useOrdersPage(filter);
  const [more, setMore] = useState<Order[][]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  if (first.isLoading) return <SkeletonList count={4} itemHeight={80} />;
  if (!first.data) return <ErrorState error={first.error} onRetry={() => void first.refresh()} />;

  const orders = mergeOrderPages([first.data.items ?? [], ...more]);
  const total = first.data.total ?? orders.length;

  async function refresh() {
    setMore([]);
    setMoreError(null);
    await first.refresh();
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await fetchOrdersPage(filter, more.length + 2);
      setMore((pages) => [...pages, next.items ?? []]);
    } catch (caught) {
      setMoreError(caught instanceof ApiError ? caught.message : t('Could not load more orders.'));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <SectionList
      sections={buildSections(orders, filter)}
      keyExtractor={(order) => order.id}
      renderItem={({ item }) => <OrderCard order={item} />}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionTitle}>
            {section.title.toUpperCase()}
          </ThemedText>
        ) : null
      }
      ItemSeparatorComponent={Separator}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={first.refreshing}
          onRefresh={() => void refresh()}
          tintColor={BrandColors.primary}
          colors={[BrandColors.primary]}
        />
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {moreError ? <InlineAlert message={moreError} testID="orders-more-error" /> : null}
          {orders.length < total ? (
            <AppButton testID="orders-load-more" title={t('Load more')} variant="secondary" loading={loadingMore} onPress={() => void loadMore()} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        filter ? (
          <StateView icon="orders" title={emptyTitle(filter)} testID="orders-empty" />
        ) : (
          <StateView
            icon="orders"
            title={emptyTitle('all')}
            message={t('When you place an order, you can follow it here.')}
            actionLabel={t('Find something to eat')}
            onAction={() => router.navigate('/home')}
            testID="orders-empty"
          />
        )
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  chipSelected: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.primarySoft,
  },
  chipTextSelected: {
    color: BrandColors.primaryText,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    flexGrow: 1,
  },
  sectionTitle: {
    letterSpacing: 0.6,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  separator: {
    height: Spacing.three,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
});
