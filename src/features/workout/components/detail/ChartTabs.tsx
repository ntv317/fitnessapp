import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, AppText } from '@/core/ui';
import { Colors, Spacing } from '@/core/theme';
import { usePremium } from '@/core/context/PremiumContext';
import { ProgressChart } from '@/features/history/components/ProgressChart';
import type { WorkoutLog } from '@/core/database/types';

const METRICS_KEYS = [
  { key: 'maxWeight' as const, labelKey: 'workout.weight' },
  { key: 'bestReps' as const, labelKey: 'workout.reps' },
  { key: 'oneRM' as const, labelKey: 'workout.performance' },
] as const;

export function ChartTabs({ logs, accent }: { logs: WorkoutLog[]; accent: string }) {
  const { t } = useTranslation();
  const { isPro } = usePremium();
  const router = useRouter();
  if (logs.length < 2) return null;

  const metrics = isPro ? METRICS_KEYS : METRICS_KEYS.filter((m) => m.key !== 'oneRM');
  const metricsWithLabels = metrics.map((m) => ({ key: m.key, label: t(m.labelKey) }));

  return (
    <Card style={{ marginTop: Spacing.xl }}>
      <AppText variant="headlineMd">{t('workout.progress')}</AppText>
      <AppText variant="bodyMd" color={Colors.textSecondary} style={{ marginBottom: Spacing.sm }}>
        {t('workout.progressDescription')}
      </AppText>
      <ProgressChart logs={logs} color={accent} metrics={metricsWithLabels} />
      {!isPro && (
        <TouchableOpacity
          onPress={() => router.push('/paywall' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm }}
        >
          <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
          <AppText variant="labelMono" color={Colors.textMuted}>
            {t('workout.estOneRM')}
          </AppText>
        </TouchableOpacity>
      )}
    </Card>
  );
}
