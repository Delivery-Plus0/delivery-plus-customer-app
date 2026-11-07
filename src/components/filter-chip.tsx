import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  /** `tab` when the chips switch between views of one list (order filters). */
  role?: 'button' | 'tab';
};

/** Figma "Chip" (Redesign 2026): ink fill and a check when selected, so selection is not colour-only. */
export function FilterChip({ label, selected, onPress, testID, role = 'button' }: FilterChipProps) {
  return (
    <Pressable
      testID={testID}
      nativeID={testID}
      accessibilityRole={role}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && !selected && styles.pressed]}
    >
      {selected ? <Icon name="checkMark" size={IconSize.sm} color={BrandColors.onInverse} /> : null}
      <ThemedText type="smallBold" style={selected ? styles.labelSelected : styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    height: 36,
    paddingHorizontal: Spacing.three - Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  selected: {
    backgroundColor: BrandColors.inverse,
    borderColor: BrandColors.inverse,
  },
  pressed: {
    backgroundColor: BrandColors.surfaceMuted,
  },
  label: {
    color: BrandColors.text,
    fontSize: 13,
  },
  labelSelected: {
    color: BrandColors.onInverse,
    fontSize: 13,
  },
});
