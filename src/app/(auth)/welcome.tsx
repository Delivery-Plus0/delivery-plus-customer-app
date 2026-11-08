import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AuthLanguageToggle } from '@/components/auth-form-shell';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';

const FEATURES: { icon: IconName; title: string; subtitle: string }[] = [
  { icon: 'store', title: t('Local favorites'), subtitle: t('Browse restaurants and full menus') },
  { icon: 'bag', title: t('Quick checkout'), subtitle: t('Build your cart and pay in seconds') },
  { icon: 'delivery', title: t('Follow every step'), subtitle: t('Live order status from kitchen to door') },
];

export default function WelcomeScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <AuthLanguageToggle />
      </View>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={t('Delivery Plus')}
          />
          <ThemedText type="title" accessibilityRole="header">
            {t('Fast meals, delivered your way.')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {t('Discover local favorites, build your cart in seconds, and track your order from kitchen to door.')}
          </ThemedText>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={IconSize.md} color={BrandColors.primary} />
              </View>
              <View style={styles.featureText}>
                <ThemedText type="smallBold">{feature.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {feature.subtitle}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <AppButton testID="welcome-get-started" title={t('Get started')} onPress={() => router.push('/register')} />
          <AppButton testID="welcome-sign-in" title={t('I already have an account')} variant="secondary" onPress={() => router.push('/login')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four - Spacing.one,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.five,
  },
  hero: {
    gap: Spacing.three,
  },
  logo: {
    width: 180,
    height: 44,
    alignSelf: 'flex-start',
    marginBottom: Spacing.four,
  },
  features: {
    flex: 1,
    gap: Spacing.four - Spacing.one,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.tanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two + Spacing.one,
  },
});
