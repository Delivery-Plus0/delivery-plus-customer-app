import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrderStatusBadge } from '@/components/order-status';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import type { Order } from '@/services/orders';
import { useRestaurant } from '@/state/catalog';
import { formatDateTime, formatMoney, shortId } from '@/utils/format';
import { t } from '@/i18n';

function summarizeItems(order: Order): string {
  const [first, ...rest] = order.items;
  if (!first) return t('No items');
  const lead = `${first.quantity}× ${first.name}`;
  return rest.length ? t('{first} +{count} more', { first: lead, count: rest.length }) : lead;
}

export const OrderCard = memo(function OrderCard({ order }: { order: Order }) {
  const { data: restaurant } = useRestaurant(order.restaurantId);
  const restaurantName = restaurant?.name ?? t('Restaurant');

  return (
    <Card
      testID={`order-card-${order.id}`}
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      accessibilityLabel={t('Order from {name}, {total}', { name: restaurantName, total: formatMoney(order.totalAmount) })}
    >
      {/* Figma C-25: store tile, name and meta, status; a divider; items and total. */}
      <View style={styles.topRow}>
        <View style={styles.tile}>
          <Icon name="store" size={IconSize.md} color={BrandColors.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="defaultBold" numberOfLines={1}>
            {restaurantName}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            #{shortId(order.id)} · {formatDateTime(order.createdAt)}
          </ThemedText>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>
      <View style={styles.divider} />
      <View style={styles.bottomRow}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
          {summarizeItems(order)}
        </ThemedText>
        <ThemedText type="defaultBold">{formatMoney(order.totalAmount)}</ThemedText>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.border,
    marginVertical: Spacing.one,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
