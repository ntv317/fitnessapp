import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { PurchasesPackage } from 'react-native-purchases';
import { AppText, Button } from '@/core/ui';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { usePremium } from '@/core/context/PremiumContext';
import { TERMS_URL, PRIVACY_URL } from '@/core/config/revenuecat';

// Dark premium modal — deliberately inverts the light app theme (Stitch design).
const Dark = {
  background: Colors.textPrimary,
  card: '#2a2624',
  border: '#3d3835',
  text: Colors.white,
  muted: '#b0a49e',
} as const;

type PlanKey = 'monthly' | 'yearly' | 'lifetime';

const getBenefits = (t: (key: string) => string) => [
  { icon: 'cloud-upload-outline' as const, label: t('premium.benefitBackup') },
  { icon: 'watch-outline' as const, label: t('premium.benefitWatch') },
  { icon: 'trending-up-outline' as const, label: t('premium.benefitTraining') },
  { icon: 'shield-checkmark-outline' as const, label: t('premium.benefitPrivate') },
];

const TRIAL_UNIT_KEYS: Record<string, string> = {
  DAY: 'premium.periodDay',
  WEEK: 'premium.periodWeek',
  MONTH: 'premium.periodMonth',
  YEAR: 'premium.periodYear',
};

// A free intro offer configured in App Store Connect, e.g. "7-day free trial".
// Derived from the store so the screen can never claim a trial that no longer
// exists (App Store rejection / refund-dispute risk).
function trialLabel(pkg: PurchasesPackage | undefined, t: TFunction): string | null {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = t(TRIAL_UNIT_KEYS[intro.periodUnit] ?? 'premium.periodDay');
  return t('premium.freeTrial', { count: intro.periodNumberOfUnits, unit });
}

export default function PaywallScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro, offerings, purchase, restore } = usePremium();
  const [selected, setSelected] = useState<PlanKey>('yearly');
  const [busy, setBusy] = useState(false);

  const packages: Partial<Record<PlanKey, PurchasesPackage>> = {};
  for (const pkg of offerings?.current?.availablePackages ?? []) {
    if (pkg.packageType === 'MONTHLY') packages.monthly = pkg;
    if (pkg.packageType === 'ANNUAL') packages.yearly = pkg;
    if (pkg.packageType === 'LIFETIME') packages.lifetime = pkg;
  }

  // No fallback prices: showing hardcoded USD amounts to another storefront
  // (or when offerings fail to load) misstates the real charge.
  const priceFor = (plan: PlanKey) => packages[plan]?.product.priceString ?? '—';

  const trial = trialLabel(packages.yearly, t);
  const monthlyPrice = packages.monthly?.product.price;
  const yearlyPrice = packages.yearly?.product.price;
  const savePct =
    monthlyPrice && yearlyPrice ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100) : null;

  const handlePurchase = async () => {
    const pkg = packages[selected];
    if (!pkg) {
      Alert.alert(t('premium.storeUnavailable'), t('premium.storeMessage'));
      return;
    }
    setBusy(true);
    try {
      await purchase(pkg);
      router.back();
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) Alert.alert(t('premium.purchaseFailed'), err.message ?? t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const restored = await restore();
      if (restored) {
        Alert.alert(t('premium.restored'), t('premium.restoredMessage'));
        router.back();
      } else {
        Alert.alert(t('premium.nothingToRestore'), t('premium.noRestoreMessage'));
      }
    } catch {
      Alert.alert(t('premium.restoreFailed'), t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.close} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="close" size={24} color={Dark.muted} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppText variant="headlineLg" center color={Dark.text} style={styles.headline}>
          {t('premium.headline')}
        </AppText>
        <AppText variant="bodyMd" center color={Dark.muted}>
          {t('premium.tagline')}
        </AppText>

        <View style={styles.benefits}>
          {getBenefits(t).map((b) => (
            <View key={b.label} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={20} color={Colors.primary} />
              <AppText variant="bodyMd" color={Dark.text} style={styles.benefitLabel}>
                {b.label}
              </AppText>
            </View>
          ))}
        </View>

        <PlanCard
          label={t('premium.monthly')}
          price={priceFor('monthly')}
          suffix={t('premium.monthlyPrice')}
          selected={selected === 'monthly'}
          onPress={() => setSelected('monthly')}
        />
        <PlanCard
          label={t('premium.yearly')}
          price={priceFor('yearly')}
          suffix={t('premium.yearlyPrice')}
          badge={savePct != null && savePct > 0 ? t('premium.save', { savePct }) : undefined}
          note={trial ?? undefined}
          selected={selected === 'yearly'}
          onPress={() => setSelected('yearly')}
        />
        <PlanCard
          label={t('premium.lifetime')}
          price={priceFor('lifetime')}
          note={t('premium.payOnce')}
          selected={selected === 'lifetime'}
          onPress={() => setSelected('lifetime')}
        />

        {!offerings?.current && (
          <AppText variant="labelMono" center color={Dark.muted} style={styles.storeNote}>
            {t('premium.storeLoading')}
          </AppText>
        )}

        <Button
          label={
            isPro
              ? t('premium.alreadyPro')
              : selected === 'yearly' && trial
                ? t('premium.startTrial', { trial })
                : t('premium.continue')
          }
          onPress={handlePurchase}
          disabled={busy || isPro || !packages[selected]}
          fullWidth
          style={styles.cta}
        />

        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={busy}>
            <AppText variant="labelMono" color={Dark.muted}>{t('premium.restorePurchases')}</AppText>
          </TouchableOpacity>
          <AppText variant="labelMono" color={Dark.muted}>·</AppText>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <AppText variant="labelMono" color={Dark.muted}>{t('premium.terms')}</AppText>
          </TouchableOpacity>
          <AppText variant="labelMono" color={Dark.muted}>·</AppText>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <AppText variant="labelMono" color={Dark.muted}>{t('premium.privacy')}</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  label,
  price,
  suffix,
  badge,
  note,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  suffix?: string;
  badge?: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.plan, selected && styles.planSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.planLeft}>
        <View style={styles.planLabelRow}>
          <AppText variant="labelMono" upper color={selected ? Colors.primary : Dark.muted}>
            {label}
          </AppText>
          {badge && (
            <View style={styles.badge}>
              <AppText style={styles.badgeText}>{badge}</AppText>
            </View>
          )}
        </View>
        <View style={styles.priceRow}>
          <AppText variant="dataInput" color={Dark.text}>{price}</AppText>
          {suffix && <AppText variant="bodySm" color={Dark.muted}>{suffix}</AppText>}
        </View>
        {note && (
          <AppText variant="labelMono" color={selected ? Colors.primary : Dark.muted}>
            {note}
          </AppText>
        )}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Dark.background },
  close: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, alignSelf: 'flex-start' },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  headline: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  benefits: { marginVertical: Spacing.lg, gap: Spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + Spacing.xs },
  benefitLabel: { flex: 1 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Dark.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Dark.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm + Spacing.xs,
  },
  planSelected: { borderWidth: 2, borderColor: Colors.primary },
  planLeft: { gap: Spacing.xs },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.white, fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 0.5 },
  cta: { marginTop: Spacing.sm },
  storeNote: { marginTop: Spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
