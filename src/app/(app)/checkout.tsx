import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PhoneVerificationSheet } from '@/components/phone-verification-sheet';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { FormTextInput } from '@/components/ui/form-text-input';
import { Icon } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api';
import { submitCheckout } from '@/services/checkout';
import { isRestaurantUnavailable, unavailableErrorMessage, unavailableMessage } from '@/utils/restaurant-availability';
import { isCartChanged } from '@/utils/cart-changes';
import { reloadCart, useCart } from '@/state/cart';
import { useRestaurant } from '@/state/catalog';
import { invalidateResources } from '@/state/resource-cache';
import { useOrderQuote } from '@/state/orders';
import { useProfile } from '@/state/profile';
import { requestLocationPicker, useDeliveryLocation } from '@/state/delivery-location';
import { locationLabel } from '@/utils/delivery-location';
import { isPhoneNotVerified } from '@/utils/phone-verification';
import { formatMoney } from '@/utils/format';
import { t } from '@/i18n';

function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export default function CheckoutScreen() {
  const cart = useCart();
  const restaurant = useRestaurant(cart.data?.restaurantId ?? undefined);
  // The fee and total come from the backend's quote of this exact cart, never from app math (#145).
  // Prices are part of it: after a 409 CartChanged the cart holds new prices and the quote must follow (#42).
  const cartSignature = cart.data?.items.length
    ? cart.data.items.map((item) => `${item.menuItemId}x${item.quantity}@${item.price}`).join(',')
    : null;
  const quote = useOrderQuote(cartSignature);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedOrderId, setFailedOrderId] = useState<string | null>(null);
  // #153: ordering can require a verified phone; the next step is offered right here.
  const [needsVerifiedPhone, setNeedsVerifiedPhone] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Instructions for the driver (gate code, floor…), sent as deliveryNotes with the order.
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const profile = useProfile();
  // #54: the delivery location chosen on Home; sent with the profile address so the backend checks the area.
  const { location } = useDeliveryLocation();
  const [outOfArea, setOutOfArea] = useState(false);
  // Stable for this checkout attempt so a retry can never create a duplicate order or charge.
  const orderIdempotencyKey = useRef(createIdempotencyKey('order'));
  const paymentIdempotencyKey = useRef(createIdempotencyKey('payment'));

  const handlePlaceOrder = async () => {
    try {
      setPlacingOrder(true);
      setErrorMessage(null);
      setFailedOrderId(null);
      setNeedsVerifiedPhone(false);
      setOutOfArea(false);
      const delivery = location && profile.data?.address ? { address: profile.data.address, latitude: location.latitude, longitude: location.longitude } : undefined;
      const details = { ...(deliveryNotes.trim() ? { deliveryNotes } : {}), ...(delivery ? { delivery } : {}) };
      const { order, payment } = await submitCheckout(
        orderIdempotencyKey.current,
        paymentIdempotencyKey.current,
        Object.keys(details).length ? details : undefined,
      );

      // The order-service empties the cart once the order exists, whatever happens to payment.
      void reloadCart();
      invalidateResources('orders');

      if (payment.status === 'FAILED') {
        setFailedOrderId(order.id);
        setErrorMessage(payment.failureReason ? t(payment.failureReason) : t('Payment could not be completed.'));
        return;
      }

      if (payment.status !== 'COMPLETED') {
        setFailedOrderId(order.id);
        setErrorMessage(t('Payment is still processing. Check the order status before trying again.'));
        return;
      }

      router.replace({ pathname: '/order/[id]', params: { id: order.id, placed: '1' } });
    } catch (error) {
      // #42: the menu changed since these items went into the cart. The backend already updated the
      // cart; reload it (and with it the quote), so the next tap pays the total the customer now sees.
      if (isCartChanged(error)) {
        void reloadCart();
        setErrorMessage(t('Your cart changed: a price, an item or a quantity is different now. Check your order and place it again.'));
        return;
      }
      // #286: the restaurant went BUSY or CLOSED since the customer opened checkout. Refresh it so the
      // banner and the disabled button below explain it; the cart is untouched.
      if (isRestaurantUnavailable(error)) {
        void restaurant.refresh();
        setErrorMessage(unavailableErrorMessage(error));
        return;
      }
      // 409 OutOfDeliveryArea: the delivery location is beyond this restaurant's delivery radius (e.g. it was
      // changed after browsing). Recoverable: change the location, or pick a restaurant that delivers there.
      if (error instanceof ApiError && error.error === 'OutOfDeliveryArea') {
        setOutOfArea(true);
        setErrorMessage(t('This restaurant does not deliver to your delivery location. Choose another location, or a restaurant closer to you. Your cart is saved.'));
        return;
      }
      setNeedsVerifiedPhone(isPhoneNotVerified(error));
      setErrorMessage(error instanceof Error ? error.message : t('We could not place your order. Please try again.'));
    } finally {
      setPlacingOrder(false);
    }
  };

  const header = <ScreenHeader title={t('Checkout')} showBack />;

  if (cart.isLoading) {
    return (
      <Screen>
        {header}
        <SkeletonList count={2} />
      </Screen>
    );
  }

  if (!cart.data && !failedOrderId) {
    return (
      <Screen>
        {header}
        <ErrorState error={cart.error} onRetry={() => void cart.refresh()} />
      </Screen>
    );
  }

  const items = cart.data?.items ?? [];

  if (items.length === 0 && !failedOrderId) {
    return (
      <Screen>
        {header}
        <StateView
          icon="bag"
          title={t('Your cart is empty')}
          message={t('Add items before checking out.')}
          actionLabel={t('Browse restaurants')}
          onAction={() => router.navigate('/home')}
        />
      </Screen>
    );
  }

  // #286: a BUSY or CLOSED restaurant takes no orders, so say so before the customer taps "Place order".
  const unavailable = failedOrderId ? null : unavailableMessage(restaurant.data?.status);

  const footer = failedOrderId ? (
    <AppButton
      testID="checkout-view-order"
      title={t('View order status')}
      variant="secondary"
      onPress={() => router.replace({ pathname: '/order/[id]', params: { id: failedOrderId } })}
    />
  ) : (
    <AppButton
      testID="checkout-place-order"
      title={quote.data ? t('Place order · {total}', { total: formatMoney(quote.data.totalAmount) }) : t('Place order')}
      onPress={() => void handlePlaceOrder()}
      loading={placingOrder}
      disabled={!quote.data || Boolean(unavailable)}
      accessibilityHint={t('Creates your order and charges the total shown')}
    />
  );

  return (
    <Screen footer={footer}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        {unavailable ? (
          <View style={styles.unavailable}>
            <InlineAlert tone="info" message={unavailable} testID="checkout-restaurant-unavailable" />
            <AppButton
              testID="checkout-check-again"
              title={t('Check again')}
              icon="refresh"
              variant="secondary"
              size="sm"
              loading={restaurant.refreshing}
              onPress={() => {
                setErrorMessage(null);
                void restaurant.refresh();
              }}
            />
          </View>
        ) : null}
        {errorMessage && errorMessage !== unavailable ? <InlineAlert message={errorMessage} testID="checkout-error" /> : null}
        {outOfArea ? (
          <AppButton
            testID="checkout-change-location"
            title={t('Change delivery location')}
            icon="location"
            variant="secondary"
            onPress={() => {
              requestLocationPicker();
              router.navigate('/home');
            }}
          />
        ) : null}
        {needsVerifiedPhone ? (
          profile.data?.phone ? (
            <AppButton testID="checkout-verify-phone" title={t('Verify your phone')} icon="phone" variant="secondary" onPress={() => setVerifying(true)} />
          ) : (
            <AppButton testID="checkout-add-phone" title={t('Add your phone number')} icon="phone" variant="secondary" onPress={() => router.navigate('/profile')} />
          )
        ) : null}

        {restaurant.data ? (
          <Card style={styles.row}>
            <View style={styles.iconWrap}>
              <Icon name="store" size={IconSize.md} color={BrandColors.primaryText} />
            </View>
            <View style={styles.flex}>
              <ThemedText type="caption" themeColor="textSecondary">
                {t('ORDERING FROM')}
              </ThemedText>
              <ThemedText type="defaultBold">{restaurant.data.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {restaurant.data.address}
              </ThemedText>
            </View>
          </Card>
        ) : null}

        {/* Figma C-15: the order goes to the profile address (order-service uses it when none is sent). */}
        <Card style={styles.row} testID="checkout-deliver-to">
          <View style={styles.iconWrap}>
            <Icon name="location" size={IconSize.md} color={BrandColors.primary} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textSecondary">
              {t('DELIVER TO')}
            </ThemedText>
            {profile.data?.address ? (
              <>
                <ThemedText type="defaultBold" numberOfLines={2}>
                  {profile.data.address}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" testID="checkout-location-source">
                  {location ? t('From your profile · {place}', { place: locationLabel(location) }) : t('From your profile')}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t('Add a delivery address in your profile.')}
              </ThemedText>
            )}
          </View>
          <AppButton
            testID="checkout-change-address"
            title={profile.data?.address ? t('Change') : t('Add')}
            variant="ghost"
            size="sm"
            onPress={() => router.navigate('/profile')}
          />
        </Card>

        <FormTextInput
          testID="checkout-delivery-notes"
          label={t('Notes for the driver (optional)')}
          placeholder={t('Gate code, floor, landmark…')}
          icon="edit"
          value={deliveryNotes}
          onChangeText={setDeliveryNotes}
          maxLength={500}
          returnKeyType="done"
        />

        {items.length > 0 ? (
          <Card>
            <ThemedText type="heading">{t('Order summary')}</ThemedText>
            {items.map((item) => (
              <View key={item.menuItemId} style={styles.itemRow}>
                <ThemedText type="small" style={styles.flex}>
                  <ThemedText type="smallBold" style={styles.quantity}>{item.quantity}×</ThemedText> {item.name}
                </ThemedText>
                <ThemedText type="small">{formatMoney(item.price * item.quantity)}</ThemedText>
              </View>
            ))}
            <View style={styles.divider} />
            {quote.data ? (
              <>
                <View style={styles.itemRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Subtotal')}
                  </ThemedText>
                  <ThemedText type="small" testID="checkout-subtotal" nativeID="checkout-subtotal">
                    {formatMoney(quote.data.subtotalAmount)}
                  </ThemedText>
                </View>
                <View style={styles.itemRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Delivery fee')}
                  </ThemedText>
                  <ThemedText type="small" testID="checkout-delivery-fee" nativeID="checkout-delivery-fee">
                    {formatMoney(quote.data.deliveryFee)}
                  </ThemedText>
                </View>
                <View style={styles.itemRow}>
                  <ThemedText type="heading">{t('Total')}</ThemedText>
                  <ThemedText type="heading" testID="checkout-total" nativeID="checkout-total">
                    {formatMoney(quote.data.totalAmount)}
                  </ThemedText>
                </View>
              </>
            ) : quote.error ? (
              <InlineAlert
                testID="checkout-quote-error"
                message={t("We couldn't load the delivery fee, so the total isn't known yet.")}
                onDismiss={() => void quote.refresh()}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary" testID="checkout-quote-loading">
                {t('Working out the delivery fee…')}
              </ThemedText>
            )}
          </Card>
        ) : null}

        <Card style={styles.row}>
          <View style={[styles.iconWrap, styles.iconWrapSuccess]}>
            <Icon name="shield" size={IconSize.md} color={BrandColors.success} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="defaultBold">{t('Payment')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Processed securely by Delivery Plus when you place the order.')}
            </ThemedText>
          </View>
        </Card>
      </ScrollView>
      {verifying && profile.data?.phone ? (
        <PhoneVerificationSheet
          phone={profile.data.phone}
          onClose={() => setVerifying(false)}
          onVerified={() => {
            setVerifying(false);
            setNeedsVerifiedPhone(false);
            setErrorMessage(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    gap: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.four - Spacing.one,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSuccess: {
    backgroundColor: BrandColors.successSoft,
  },
  quantity: {
    color: BrandColors.primaryText,
  },
  itemRow: {
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
