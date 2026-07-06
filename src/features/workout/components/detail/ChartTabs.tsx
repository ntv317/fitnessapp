import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, AppText } from '@/core/ui';
import { Colors, Spacing } from '@/core/theme';
import { usePremium } from '@/core/context/PremiumContext';
import { ProgressChart } from '@/features/history/components/ProgressChart';
import type { WorkoutLog } from '@/core/database/types';

const METRICS = [
  { key: 'maxWeight' as const, label: 'Weight' },
  { key: 'bestReps' as const, label: 'Reps' },
  { key: 'oneRM' as const, label: 'Performance' },
];

export function ChartTabs({ logs, accent }: { logs: WorkoutLog[]; accent: string }) {
  const { isPro } = usePremium();
  const router = useRouter();
  if (logs.length < 2) return null;

  const metrics = isPro ? METRICS : METRICS.filter((m) => m.key !== 'oneRM');

  return (
    <Card style={{ marginTop: Spacing.xl }}>
      <AppText variant="headlineMd">Progress</AppText>
      <AppText variant="bodyMd" color={Colors.textSecondary} style={{ marginBottom: Spacing.sm }}>
        Your progress based on weight and rep changes
      </AppText>
      <ProgressChart logs={logs} color={accent} metrics={metrics} />
      {!isPro && (
        <TouchableOpacity
          onPress={() => router.push('/paywall' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm }}
        >
          <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
          <AppText variant="labelMono" color={Colors.textMuted}>
            Est. 1RM trend — LIFTREPS Pro
          </AppText>
        </TouchableOpacity>
      )}
    </Card>
  );
}
