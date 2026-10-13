import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { DriverCard } from '@/components/driver-card';
import { DriverLocationCard } from '@/components/driver-location-card';
import { OrderPhaseCard } from '@/components/order-phase-card';
import { OrderStatusBadge } from '@/components/order-status';
import { RateDriverCard } from '@/components/rate-driver-card';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/state-view';
import { BrandColors, Spacing } from '@/constants/theme';
import { CUSTOMER_CANCELLABLE_STATUSES, isActiveOrder } from '@/services/orders';
import { useRestaurant } from '@/state/catalog';
import { useNow } from '@/hooks/use-now';
import { canHaveDelivery, useOrderDelivery } from '@/state/deliveries';
import { cancelMyOrder, useOrder } from '@/state/orders';
import { useDeliveryTracking } from '@/state/tracking';
import { formatDateTime, formatMoney, shortId } from '@/utils/format';
import { describeOrderPhase, searchingFor } from '@/utils/order-phase';
import { outcomeReason, paymentStatusLabel } from '@/utils/order-outcome';
import { t } from '@/i18n';

export default function OrderDetailScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const order = useOrder(id);
  const restaurant = useRestaurant(order.data?.restaurantId);
  const delivery = useOrderDelivery(order.data);
  // One tracking source for the whole screen (one realtime stream), shared by the map and the ETA.
  const tracking = useDeliveryTracking(delivery.data);
  const now = useNow(15_000);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const goToOrders = () => router.navigate('/orders');
  const header = <ScreenHeader title={order.data ? t('Order #{id}', { id: shortId(order.data.id) }) : t('Order')} showBack />;

  if (order.isLoading) {
    return (
      <Screen>
        {header}
        <SkeletonList count={3} />
      </Screen>
    );
  }

  if (!order.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={order.error} onRetry={() => void order.refresh()} />
      </Screen>
    );
  }

  const current = order.data;
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(current.status);
  const live = isActiveOrder(current);
  const phase = describeOrderPhase(current, delivery.data);
  const eta = tracking.data?.eta;
  const etaNote =
    eta?.status === 'ESTIMATED' && now <= Date.parse(eta.validUntil)
      ? t('Arriving in about {minutes} min', { minutes: Math.max(1, Math.round(eta.seconds / 60)) })
      : null;
  const phaseNote = phase.key === 'searching' ? searchingFor(delivery.data?.createdAt, now) : etaNote;
  const driver = delivery.data?.driver;
  const showDriver = !!driver && phase.key !== 'failed' && phase.key !== 'cancelled';
  const deliveryUnavailable = canHaveDelivery(current) && delivery.data === undefined && !!delivery.error;

  // Confirmed in the kit Dialog (#155), so the choice looks the same everywhere and flows can reach it.
  const handleCancel = async () => {
    setConfirmingCancel(false);
    setActionError(null);
    setCancelling(true);
    try {
      await cancelMyOrder(current.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Could not cancel this order.'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen
      footer={
        canCancel ? (
          <AppButton testID="order-cancel" title={t('Cancel order')} variant="danger" loading={cancelling} onPress={() => setConfirmingCancel(true)} />
        ) : placed ? (
          <AppButton title={t('View all orders')} variant="secondary" onPress={goToOrders} />
        ) : undefined
      }
    >
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={order.refreshing}
            onRefresh={() => {
              void order.refresh();
              void delivery.refresh();
            }}
            tintColor={BrandColors.primary}
            colors={[BrandColors.primary]}
          />
        }
      >
        {placed && live ? <InlineAlert testID="order-placed" tone="success" message={t("Order placed! We'll keep this page updated.")} /> : null}
        {actionError ? <InlineAlert message={actionError} onDismiss={() => setActionError(null)} /> : null}

        <OrderPhaseCard phase={phase} note={phaseNote} />

        {outcomeReason(current) ? (
          <InlineAlert testID="order-outcome" tone="info" message={outcomeReason(current) ?? ''} />
        ) : null}

        {deliveryUnavailable ? (
          <InlineAlert
            testID="delivery-unavailable"
            message={t("We couldn't load the delivery status. Pull down to try again.")}
          />
        ) : null}

        {showDriver && driver ? <DriverCard driver={driver} /> : null}

        {delivery.data?.status === 'DELIVERED' && delivery.data.driverId ? (
          <RateDriverCard deliveryId={delivery.data.id} driverName={driver?.displayName} />
        ) : null}

        {live ? <DriverLocationCard tracking={tracking} /> : null}

        {canCancel ? (
          <ThemedText type="caption" themeColor="textSecondary" testID="order-cancel-hint">
            {t('You can cancel until the restaurant starts preparing your order.')}
          </ThemedText>
        ) : null}

        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <ThemedText type="defaultBold" numberOfLines={1}>
                {restaurant.data?.name ?? t('Your order')}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {formatDateTime(current.createdAt)}
              </ThemedText>
            </View>
            <OrderStatusBadge status={current.status} testID="order-status" />
          </View>
        </Card>

        <Card>
          <ThemedText type="heading">{t('Items')}</ThemedText>
          {current.items.map((item) => (
            <View key={item.id ?? item.menuItemId} style={styles.rowBetween}>
              <ThemedText type="small" style={styles.flex}>
                <ThemedText type="smallBold">{item.quantity}×</ThemedText> {item.name}
              </ThemedText>
              <ThemedText type="small">{formatMoney(Number(item.price) * item.quantity)}</ThemedText>
            </View>
          ))}
          <View style={styles.divider} />
          {current.deliveryFee != null && current.subtotalAmount != null ? (
            <>
              <View style={styles.rowBetween}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Subtotal')}
                </ThemedText>
                <ThemedText type="small" testID="order-subtotal">
                  {formatMoney(current.subtotalAmount)}
                </ThemedText>
              </View>
              <View style={styles.rowBetween}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Delivery fee')}
                </ThemedText>
                <ThemedText type="small" testID="order-delivery-fee" nativeID="order-delivery-fee">
                  {formatMoney(current.deliveryFee)}
                </ThemedText>
              </View>
            </>
          ) : null}
          <View style={styles.rowBetween}>
            <ThemedText type="heading">{t('Total')}</ThemedText>
            <ThemedText type="heading" testID="order-total">
              {formatMoney(current.totalAmount)}
            </ThemedText>
          </View>
          <View style={styles.rowBetween}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Payment')}
            </ThemedText>
            <ThemedText type="small" testID="order-payment-status" nativeID="order-payment-status">
              {paymentStatusLabel(current)}
            </ThemedText>
          </View>
        </Card>

        {restaurant.data ? (
          <Card>
            <ThemedText type="caption" themeColor="textSecondary">
              {t('RESTAURANT')}
            </ThemedText>
            <ThemedText type="defaultBold">{restaurant.data.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {restaurant.data.address}
            </ThemedText>
          </Card>
        ) : null}
      </ScrollView>
      <Dialog
        visible={confirmingCancel}
        title={t('Cancel this order?')}
        message={
          current.paymentStatus === 'COMPLETED'
            ? t('The restaurant will be notified and your order will stop. You get a full refund, delivery fee included.')
            : t('The restaurant will be notified and your order will stop.')
        }
        confirmLabel={t('Cancel order')}
        cancelLabel={t('Keep order')}
        destructive
        onConfirm={() => void handleCancel()}
        onCancel={() => setConfirmingCancel(false)}
        testID="cancel-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.border,
    marginVertical: Spacing.one,
  },
});
