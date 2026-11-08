import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import type { MenuItem } from '@/services/menus';
import { MAX_ITEM_QUANTITY } from '@/services/cart';
import { formatMoney } from '@/utils/format';
import { t } from '@/i18n';

type MenuItemRowProps = {
  item: MenuItem;
  quantityInCart: number;
  pending: boolean;
  onAdd: (item: MenuItem) => void;
  onChangeQuantity: (item: MenuItem, quantity: number) => void;
};

export const MenuItemRow = memo(function MenuItemRow({
  item,
  quantityInCart,
  pending,
  onAdd,
  onChangeQuantity,
}: MenuItemRowProps) {
  const control = !item.available ? (
    <Badge label={t('Sold out')} tone="neutral" dot={false} />
  ) : quantityInCart > 0 ? (
    <QuantityStepper
      testID={`qty-${item.name}`}
      quantity={quantityInCart}
      itemName={item.name}
      max={MAX_ITEM_QUANTITY}
      onChange={(next) => onChangeQuantity(item, next)}
    />
  ) : (
    <Pressable
      testID={`add-${item.name}`}
      nativeID={`add-${item.name}`}
      accessibilityRole="button"
      accessibilityLabel={t('Add {name} to cart', { name: item.name })}
      accessibilityState={{ busy: pending, disabled: pending }}
      disabled={pending}
      onPress={() => onAdd(item)}
      style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={BrandColors.primaryText} />
      ) : (
        <>
          <Icon name="plus" size={IconSize.sm} color={BrandColors.primaryText} />
          <ThemedText type="smallBold" style={styles.addLabel}>
            {t('Add')}
          </ThemedText>
        </>
      )}
    </Pressable>
  );

  // Figma C-10: name, description, then the price with its control at the end; the photo sits at the side.
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <ThemedText type="defaultBold" numberOfLines={2} themeColor={item.available ? 'text' : 'textSecondary'}>
          {item.name}
        </ThemedText>
        {item.description ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {item.description}
          </ThemedText>
        ) : null}
        <View style={styles.priceRow}>
          <ThemedText type="defaultBold" themeColor={item.available ? 'text' : 'textSecondary'}>
            {formatMoney(item.price)}
          </ThemedText>
          {control}
        </View>
      </View>

      <View style={[styles.imageWrap, !item.available && styles.dimmed]}>
        {item.imageUrl ? (
          <Image
            source={item.imageUrl}
            style={styles.image}
            contentFit="cover"
            transition={150}
            recyclingKey={item.id}
            cachePolicy="memory-disk"
          />
        ) : (
          <Icon name="food" size={IconSize.lg} color={BrandColors.packageTan} />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four - Spacing.one,
    backgroundColor: BrandColors.background,
  },
  info: {
    flex: 1,
    gap: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  imageWrap: {
    width: 88,
    height: 88,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.tanSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dimmed: {
    opacity: 0.55,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 36,
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.primarySoft,
  },
  addPressed: {
    backgroundColor: BrandColors.primarySoftStrong,
  },
  addLabel: {
    color: BrandColors.primaryText,
    fontSize: 13,
  },
});
