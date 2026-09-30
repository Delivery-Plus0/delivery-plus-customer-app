import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';

type QuantityStepperProps = {
  quantity: number;
  onChange: (next: number) => void;
  itemName: string;
  disabled?: boolean;
};

/** −/qty/+ control. Going below 1 asks the caller to remove the line (quantity 0). */
export function QuantityStepper({ quantity, onChange, itemName, disabled = false }: QuantityStepperProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={quantity <= 1 ? `Remove ${itemName}` : `Decrease ${itemName}`}
        disabled={disabled}
        hitSlop={6}
        onPress={() => onChange(quantity - 1)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name={quantity <= 1 ? 'trash' : 'minus'} size={IconSize.sm} color={BrandColors.primaryText} />
      </Pressable>
      <Text style={styles.quantity} accessibilityLabel={`${quantity} in cart`}>
        {quantity}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${itemName}`}
        disabled={disabled}
        hitSlop={6}
        onPress={() => onChange(quantity + 1)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="plus" size={IconSize.sm} color={BrandColors.primaryText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: Radius.pill,
    padding: Spacing.half,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: BrandColors.surface,
  },
  quantity: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: BrandColors.text,
  },
});
