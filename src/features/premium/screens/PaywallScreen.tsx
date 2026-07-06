import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

const BENEFITS: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { icon: 'cloud-upload-outline', label: 'iCloud Backup — never lose a PR' },
  { icon: 'watch-outline', label: 'Apple Watch logging' },
  { icon: 'trending-up-outline', label: 'Smart training: 1RM trends, PRs, progression hints' },
  { icon: 'shield-checkmark-outline', label: 'Indie-built, private, no ads' },
];

const FALLBACK_PRICES: Record<PlanKey, string> = {
  monthly: '$2.99',
  yearly: '$19.99',
  lifetime: '$49.99',
};

export default function PaywallScreen() {
  const router = useRouter();
  const { isPro, offerings, purchase, restore } = usePremium();
  const [selected, setSelected] = useState<PlanKey>('yearly');
  const [busy, setBusy] = useState(false);

  const packages: Partial<Record<PlanKey, PurchasesPackage>> = {};
  for (const pkg of offerings?.current?.availablePackages ?? []) {
    if (pkg.packageType === 'MONTHLY') packages.monthly = pkg;
    if (pkg.packageType === 'ANNUAL') packages.yearly = pkg;
    if (pkg.packageType === 'LIFETIME') packages.lifetime = pkg;
  }

  const priceFor = (plan: PlanKey) => packages[plan]?.product.priceString ?? FALLBACK_PRICES[plan];

  const handlePurchase = async () => {
    const pkg = packages[selected];
    if (!pkg) {
      Alert.alert('Store unavailable', 'Purchases are not available right now. Please try again later.');
      return;
    }
    setBusy(true);
    try {
      await purchase(pkg);
      router.back();
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) Alert.alert('Purchase failed', err.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const restored = await restore();
      if (restored) {
        Alert.alert('Restored', 'Your Pro access is back.');
        router.back();
      } else {
        Alert.alert('Nothing to restore', 'No previous purchase was found for this Apple ID.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
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
          Your training,{'\n'}everywhere. Forever.
        </AppText>
        <AppText variant="bodyMd" center color={Dark.muted}>
          Unlock the full power of your training data.
        </AppText>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.label} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={20} color={Colors.primary} />
              <AppText variant="bodyMd" color={Dark.text} style={styles.benefitLabel}>
                {b.label}
              </AppText>
            </View>
          ))}
        </View>

        <PlanCard
          label="Monthly"
          price={priceFor('monthly')}
          suffix="/mo"
          selected={selected === 'monthly'}
          onPress={() => setSelected('monthly')}
        />
        <PlanCard
          label="Yearly"
          price={priceFor('yearly')}
          suffix="/yr"
          badge="SAVE 44%"
          note="7-day free trial"
          selected={selected === 'yearly'}
          onPress={() => setSelected('yearly')}
        />
        <PlanCard
          label="Lifetime"
          price={priceFor('lifetime')}
          note="Pay once"
          selected={selected === 'lifetime'}
          onPress={() => setSelected('lifetime')}
        />

        <Button
          label={isPro ? 'You already have Pro' : selected === 'yearly' ? 'Start 7-day free trial' : 'Continue'}
          onPress={handlePurchase}
          disabled={busy || isPro}
          fullWidth
          style={styles.cta}
        />

        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={busy}>
            <AppText variant="labelMono" color={Dark.muted}>Restore Purchases</AppText>
          </TouchableOpacity>
          <AppText variant="labelMono" color={Dark.muted}>·</AppText>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <AppText variant="labelMono" color={Dark.muted}>Terms</AppText>
          </TouchableOpacity>
          <AppText variant="labelMono" color={Dark.muted}>·</AppText>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <AppText variant="labelMono" color={Dark.muted}>Privacy</AppText>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
