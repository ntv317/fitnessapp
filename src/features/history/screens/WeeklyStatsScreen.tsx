import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { usePremium } from '@/core/context/PremiumContext';
import { useAllDays } from '@/features/workout/hooks/useExercises';
import { useWeeklyProgress, useWeeklyStats } from '@/features/workout/hooks/useWorkoutLogs';
import { useMuscleVolume } from '@/features/workout/hooks/useProAnalytics';
import { dayProgress } from '@/features/workout/utils/progress';
import { dayColorForTag } from '@/features/workout/utils/dayColor';
import { weekStartOf, dateFnsLocale } from '@/core/utils/date';
import { formatWeight } from '@/core/utils/format';

import { format } from 'date-fns';

const MARGIN = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function rangeLabel(weekStart: number): string {
  const fmt = (ms: number) => format(new Date(ms), 'MMM d', { locale: dateFnsLocale() });
  return `${fmt(weekStart)} – ${fmt(weekStart + 6 * 24 * 60 * 60 * 1000)}`;
}

function DeltaChip({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <View style={[styles.deltaChip, { backgroundColor: up ? Colors.tertiary : Colors.surfaceAlt }]}>
      <AppText variant="labelMono" color={up ? Colors.white : Colors.textSecondary}>
        {up ? '+' : ''}{pct}%
      </AppText>
    </View>
  );
}

export default function WeeklyStatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { unit, fromKg } = useUnit();

  const thisWeekStart = useMemo(() => weekStartOf(Date.now()), []);
  const lastWeekStart = thisWeekStart - WEEK_MS;

  const { isPro } = usePremium();
  const { data: stats } = useWeeklyStats(thisWeekStart);
  const { data: lastStats } = useWeeklyStats(lastWeekStart);
  const { data: muscleVolume = [] } = useMuscleVolume(thisWeekStart, isPro);
  const { data: allDays = [] } = useAllDays();
  const { data: weeklyMap = new Map<string, number>() } = useWeeklyProgress(thisWeekStart);

  const planProgress = allDays.map(({ dayTag, exercises }) => ({
    dayTag,
    progress: dayProgress(exercises, weeklyMap, dayTag),
  }));
  const planDone = planProgress.reduce((s, d) => s + d.progress.done, 0);
  const planTotal = planProgress.reduce((s, d) => s + d.progress.total, 0);

  const volume = stats?.volumeKg ?? 0;
  const lastVolume = lastStats?.volumeKg ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <AppText variant="headlineMd" style={{ flex: 1, marginLeft: Spacing.sm }}>{t('history.thisWeek')}</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: Spacing.md }}>
          {rangeLabel(thisWeekStart)}
        </AppText>

        {/* Total volume */}
        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: Colors.primary }]} />
          <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('stats.totalVolume')}</AppText>
          <View style={styles.volumeRow}>
            <AppText variant="headlineLg" style={{ fontSize: 32, lineHeight: 38 }}>
              {formatWeight(fromKg(volume))} {unit}
            </AppText>
            <DeltaChip current={volume} previous={lastVolume} />
          </View>
        </View>

        {/* Sets done vs plan */}
        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: Colors.secondary ?? Colors.primary }]} />
          <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('stats.setsDone')}</AppText>
          <AppText variant="headlineLg" style={{ fontSize: 26, lineHeight: 32, marginTop: 2 }}>
            {planTotal > 0
              ? t('stats.setsOfPlanned', { done: stats?.totalSets ?? 0, total: planTotal })
              : t('history.sets', { count: stats?.totalSets ?? 0 })}
          </AppText>
          {planTotal > 0 && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(1, planDone / planTotal) * 100}%`, backgroundColor: Colors.primary }]} />
            </View>
          )}
        </View>

        {/* Days trained */}
        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: Colors.tertiary }]} />
          <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('stats.daysTrained')}</AppText>
          <AppText variant="headlineLg" style={{ fontSize: 26, lineHeight: 32, marginTop: 2 }}>
            {allDays.length > 0
              ? t('stats.daysOfTotal', { done: stats?.daysTrained ?? 0, total: allDays.length })
              : t('stats.days', { count: stats?.daysTrained ?? 0 })}
          </AppText>
        </View>

        {/* Per-day breakdown */}
        {planProgress.length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: Spacing.sm }}>
              {t('stats.byDay')}
            </AppText>
            {planProgress.map(({ dayTag, progress }) => {
              const color = dayColorForTag(dayTag);
              return (
                <View key={dayTag} style={styles.dayRow}>
                  <View style={[styles.dayDot, { backgroundColor: color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.dayLabelRow}>
                      <AppText variant="bodyLg" style={{ fontFamily: Fonts.sansBold }}>{dayTag}</AppText>
                      <AppText variant="labelMono" upper color={progress.complete ? color : Colors.textMuted}>
                        {t('stats.setsProgress', { done: progress.done, total: progress.total })}
                      </AppText>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${progress.pct * 100}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Muscle group balance (Pro) */}
        <View style={styles.section}>
          <AppText variant="labelMono" upper color={Colors.textMuted} style={{ marginBottom: Spacing.sm }}>
            {t('stats.byMuscleGroup')}
          </AppText>
          {!isPro ? (
            <TouchableOpacity style={styles.lockRow} onPress={() => router.push('/paywall' as never)}>
              <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
              <AppText variant="bodyMd" color={Colors.textMuted}>
                {t('stats.muscleBalancePro')}
              </AppText>
            </TouchableOpacity>
          ) : muscleVolume.length === 0 ? (
            <AppText variant="bodyMd" color={Colors.textMuted}>{t('stats.noSetsThisWeek')}</AppText>
          ) : (
            muscleVolume.map((m) => {
              const maxVol = muscleVolume[0].volumeKg || 1;
              return (
                <View key={m.muscleGroup} style={styles.muscleRow}>
                  <View style={styles.dayLabelRow}>
                    <AppText variant="bodyMd">{t(`muscleGroups.${m.muscleGroup}`, { defaultValue: m.muscleGroup })}</AppText>
                    <AppText variant="labelMono" color={Colors.textMuted}>
                      {formatWeight(fromKg(m.volumeKg))} {unit}
                    </AppText>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(m.volumeKg / maxVol) * 100}%`, backgroundColor: Colors.primary }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {lastVolume > 0 && (
          <AppText variant="labelMono" upper color={Colors.textMuted} center style={{ marginTop: Spacing.xl }}>
            {t('stats.lastWeekSummary', { volume: formatWeight(fromKg(lastVolume)), unit, sets: lastStats?.totalSets ?? 0 })}
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
    paddingVertical: Spacing.md,
  },
  scroll: { paddingHorizontal: MARGIN, paddingBottom: 64 },
  card: {
    position: 'relative',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    paddingLeft: Spacing.lg + 4,
    marginBottom: Spacing.md,
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  deltaChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  track: {
    height: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  fill: { height: '100%' },
  section: { marginTop: Spacing.lg },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  muscleRow: { paddingVertical: Spacing.sm },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  dayLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
});
