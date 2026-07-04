import React from 'react';
import { Card, AppText } from '@/core/ui';
import { Colors, Spacing } from '@/core/theme';
import { ProgressChart } from '@/features/history/components/ProgressChart';
import type { WorkoutLog } from '@/core/database/types';

const METRICS = [
  { key: 'maxWeight' as const, label: 'Weight' },
  { key: 'bestReps' as const, label: 'Reps' },
  { key: 'oneRM' as const, label: 'Performance' },
];

export function ChartTabs({ logs, accent }: { logs: WorkoutLog[]; accent: string }) {
  if (logs.length < 2) return null;

  return (
    <Card style={{ marginTop: Spacing.xl }}>
      <AppText variant="headlineMd">Progress</AppText>
      <AppText variant="bodyMd" color={Colors.textSecondary} style={{ marginBottom: Spacing.sm }}>
        Your progress based on weight and rep changes
      </AppText>
      <ProgressChart logs={logs} color={accent} metrics={METRICS} />
    </Card>
  );
}
