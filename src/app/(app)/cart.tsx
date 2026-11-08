import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { cartItemCount, describeCartError, emptyCart, setCartQuantity, useCart } from '@/state/cart';
import { MAX_ITEM_QUANTITY } from '@/services/cart';
import { useRestaurant } from '@/state/catalog';
import { useConfirm } from '@/hooks/use-confirm';
import { formatMoney } from '@/utils/format';
import { t, tn } from '@/i18n';
import { unavailableMessage } from '@/utils/restaurant-availability';

export default function CartScreen() {
  const [confirmDialog, confirm] = useConfirm();
  const cart = useCart();
  const restaurant = useRestaurant(cart.data?.restaurantId ?? undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = cart.data?.items ?? [];
  // #286: tell the customer before checkout when the restaurant is busy or closed; the cart stays.
  const unavailable = unavailableMessage(restaurant.data?.status);
  const count = cartItemCount(cart.data);

  const changeQuantity = (menuItemId: string, quantity: number) => {
    setActionError(null);
    setCartQuantity(menuItemId, quantity).catch((error: unknown) =>
      setActionError(describeCartError(error, t('Could not update your cart.'))),
    );
  };

  const handleClear = async () => {
    const ok = await confirm({
      testID: 'clear-cart-dialog',
      icon: 'trash',
      title: t('Clear cart?'),
      message: t('This removes every item from your cart.'),
      confirmLabel: t('Clear cart'),
      destructive: true,
    });
    if (!ok) return;

    setActionError(null);
    emptyCart().catch((error: unknown) =>
      setActionError(error instanceof Error ? error.message : t('Could not clear your cart.')),
    );
  };

  const header = (
    <ScreenHeader
      title={t('Your cart')}
      subtitle={restaurant.data ? t('From {name}', { name: restaurant.data.name }) : undefined}
      showBack
      right={
        items.length > 0 ? (
          <AppButton title={t('Clear')} onPress={() => void handleClear()} variant="ghost" size="sm" fullWidth={false} />
        ) : null
      }
    />
  );

  if (cart.isLoading) {
    return (
      <Screen>
        {header}
        <SkeletonList count={3} itemHeight={80} />
      </Screen>
    );
  }

  if (!cart.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={cart.error} onRetry={() => void cart.refresh()} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        {header}
        <StateView
          icon="bag"
          title={t('Your cart is empty')}
          message={t('Add dishes from a restaurant to start an order.')}
          actionLabel={t('Browse restaurants')}
          onAction={() => router.navigate('/home')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <ThemedText type="default" themeColor="textSecondary">
              {tn(count, 'Subtotal · {count} item', 'Subtotal · {count} items')}
            </ThemedText>
            <ThemedText type="heading" testID="cart-subtotal">
              {formatMoney(cart.data.total)}
            </ThemedText>
          </View>
          <AppButton testID="cart-checkout" title={t('Go to checkout')} onPress={() => router.push('/checkout')} />
        </View>
      }
    >
      {header}
      <FlatList
        data={items}
        keyExtractor={(item) => item.menuItemId}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          actionError || unavailable ? (
            <View style={styles.alert}>
              {unavailable ? <InlineAlert tone="info" message={unavailable} testID="cart-restaurant-unavailable" /> : null}
              {actionError ? <InlineAlert message={actionError} onDismiss={() => setActionError(null)} /> : null}
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={cart.refreshing}
            onRefresh={() => void cart.refresh()}
            tintColor={BrandColors.primary}
            colors={[BrandColors.primary]}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            {/* Figma C-12: the dish photo, or a food tile when it has none. */}
            <View style={styles.thumb} testID={`cart-thumb-${item.name}`}>
              {item.imageUrl ? (
                <Image source={item.imageUrl} style={styles.thumbImage} contentFit="cover" cachePolicy="memory-disk" accessibilityIgnoresInvertColors />
              ) : (
                <Icon name="food" size={IconSize.md} color={BrandColors.packageTan} />
              )}
            </View>
            <View style={styles.itemInfo}>
              <ThemedText type="defaultBold" numberOfLines={2}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('{price} each', { price: formatMoney(item.price) })}
              </ThemedText>
              <ThemedText type="smallBold">{formatMoney(item.price * item.quantity)}</ThemedText>
            </View>
            <QuantityStepper
              testID={`cart-qty-${item.name}`}
              quantity={item.quantity}
              itemName={item.name}
              max={MAX_ITEM_QUANTITY}
              onChange={(next) => changeQuantity(item.menuItemId, next)}
            />
          </Card>
        )}
        ListFooterComponent={
          <ThemedText type="caption" themeColor="textSecondary" style={styles.note}>
            {t('Your final total is confirmed when the order is placed.')}
          </ThemedText>
        }
      />
      {confirmDialog}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  alert: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.tanSoft,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  separator: {
    height: Spacing.three,
  },
  note: {
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.three,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
