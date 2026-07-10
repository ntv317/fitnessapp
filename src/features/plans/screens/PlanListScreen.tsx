import React, { useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius } from '@/core/theme';
import { AppText, Button } from '@/core/ui';
import { usePlans, useCreatePlan, useSetActivePlan } from '@/features/workout/hooks/usePlans';
import { usePremium } from '@/core/context/PremiumContext';
import type { Plan } from '@/core/database/types';

const MARGIN = 20;

export default function PlanListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: plans = [] } = usePlans();
  const createPlan = useCreatePlan();
  const setActivePlan = useSetActivePlan();
  const { isPro } = usePremium();

  const handleCreate = useCallback(() => {
    if (!isPro && plans.length >= 1) {
      router.push('/paywall' as never);
      return;
    }
    Alert.prompt(
      t('plans.newPlanTitle'),
      t('plans.newPlanSubtitle'),
      async (name) => {
        if (!name?.trim()) return;
        try {
          const plan = await createPlan.mutateAsync(name.trim());
          router.push(`/plan/${plan.id}` as never);
        } catch {
          Alert.alert(t('plans.createError'), t('plans.alreadyExists'));
        }
      },
    );
  }, [createPlan, router, isPro, plans.length, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <AppText variant="headlineLg">{t('tabs.plans')}</AppText>
      </View>

      <FlatList<Plan>
        data={plans}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
            <AppText variant="headlineMd" center>{t('plans.noPlanYet')}</AppText>
            <AppText variant="bodyMd" color={Colors.textSecondary} center>
              {t('plans.noPlanBody')}
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => router.push(`/plan/${item.id}` as never)}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLg">{item.name}</AppText>
              {item.isActive && (
                <View style={styles.activeBadge}>
                  <AppText variant="labelMono" upper color={Colors.white}>{t('plans.active')}</AppText>
                </View>
              )}
            </View>
            {!item.isActive && (
              <TouchableOpacity
                onPress={() => setActivePlan.mutate(item.id)}
                hitSlop={10}
                style={styles.setActiveBtn}
              >
                <AppText variant="labelMono" upper color={Colors.primary}>{t('plans.setActive')}</AppText>
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <Button label={t('plans.newPlan')} icon="add" onPress={handleCreate} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: { paddingHorizontal: MARGIN, paddingVertical: Spacing.md },
  list: { paddingHorizontal: MARGIN, paddingBottom: 100, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.tertiary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  setActiveBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  footer: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    bottom: Spacing.lg,
  },
});
