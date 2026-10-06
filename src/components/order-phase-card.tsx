import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { ORDER_PHASE_STEPS, type OrderPhase, type OrderPhaseKey } from '@/utils/order-phase';

const ICONS: Record<OrderPhaseKey, IconName> = {
  placed: 'orders',
  confirmed: 'check',
  preparing: 'food',
  searching: 'search',
  driver_assigned: 'person',
  picked_up: 'bag',
  on_the_way: 'delivery',
  delivered: 'check',
  failed: 'error',
  cancelled: 'cancel',
};

type OrderPhaseCardProps = {
  phase: OrderPhase;
  /** Extra line under the detail, e.g. "Searching for 2 min" or an ETA. */
  note?: string | null;
};

/**
 * The hero of the order screen (#140): what is happening now, in one sentence, plus where the order is
 * on its way from placed to delivered. Driven only by describeOrderPhase (backend state).
 */
export function OrderPhaseCard({ phase, note }: OrderPhaseCardProps) {
  const searching = phase.tone === 'searching';
  const color =
    phase.tone === 'danger' ? BrandColors.danger : phase.tone === 'success' ? BrandColors.success : BrandColors.primaryText;
  const soft =
    phase.tone === 'danger' ? BrandColors.dangerSoft : phase.tone === 'success' ? BrandColors.successSoft : BrandColors.primarySoft;

  return (
    <Card testID="order-phase-card">
      <View style={styles.row} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${phase.title}. ${phase.detail}`}>
        <View style={[styles.iconWrap, { backgroundColor: soft }]}>
          {searching ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Icon name={ICONS[phase.key]} size={IconSize.lg} color={color} />
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText type="heading" testID="order-phase">
            {phase.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {phase.detail}
          </ThemedText>
          {note ? (
            <ThemedText type="caption" themeColor="textSecondary" testID="order-phase-note">
              {note}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {phase.step >= 0 ? (
        <View style={styles.steps} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {ORDER_PHASE_STEPS.map((label, index) => {
            const done = index < phase.step || (index === phase.step && phase.tone === 'success');
            const current = index === phase.step && phase.tone !== 'success';
            return (
              <View key={label} style={styles.step}>
                <View style={[styles.bar, done && styles.barDone, current && styles.barCurrent]} />
                <ThemedText type="caption" themeColor={done || current ? 'text' : 'textSecondary'} numberOfLines={1}>
                  {label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  step: {
    flex: 1,
    gap: Spacing.one,
  },
  bar: {
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: BrandColors.border,
  },
  barDone: {
    backgroundColor: BrandColors.primary,
  },
  barCurrent: {
    backgroundColor: BrandColors.primary,
    opacity: 0.45,
  },
});
