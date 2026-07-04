import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Fonts } from '@/core/theme';
import { dayColorForTag } from '../utils/dayColor';
import { useAllDays } from '../hooks/useExercises';
import { useWeeklyProgress } from '../hooks/useWorkoutLogs';
import { dayProgress, weeklyKey, DEFAULT_TARGET_SETS, type SetProgress } from '../utils/progress';
import { formatRepRange } from '../utils/repRange';
import { weekStartOf } from '@/core/utils/date';
import { AppText } from '@/core/ui';
import type { Exercise } from '@/core/database/types';

const MARGIN = 20; // margin-mobile

// ── Plan lookups ─────────────────────────────────────────────────────────────

function musclesForExercises(exercises: Exercise[]): string {
  const withCatalog = exercises.filter((ex) => ex.catalogId);
  if (withCatalog.length === 0) return 'Custom';
  // Deferred require: a top-level import here would pull in the ~0.8MB
  // catalog JSON on every Log tab render, even for a plan with no
  // catalog-linked exercises (or no plan at all yet). Only load it once a
  // day actually has one to label.
  const { getById } = require('@/features/library/services/ExerciseCatalog') as typeof import('@/features/library/services/ExerciseCatalog');
  const { groupOf } = require('@/features/library/utils/muscleGroups') as typeof import('@/features/library/utils/muscleGroups');
  const groups = new Set<string>();
  for (const ex of withCatalog) {
    const cat = getById(ex.catalogId!);
    if (!cat) continue;
    const group = groupOf(cat.primaryMuscles);
    if (group) groups.add(group);
  }
  return groups.size > 0 ? Array.from(groups).join(' / ') : 'Custom';
}

function estMinutes(exerciseCount: number): number {
  return Math.max(15, Math.round((exerciseCount * 9) / 5) * 5);
}

// ── Exercise row (shown when a day is expanded) ──────────────────────────────

function ExerciseRow({
  exercise,
  color,
  done,
  target,
  onPress,
}: {
  exercise: Exercise;
  color: string;
  done: number;
  target: number;
  onPress: () => void;
}) {
  const pct = target > 0 ? done / target : 0;
  const complete = target > 0 && done >= target;
  const range = formatRepRange(exercise.repMin, exercise.repMax);
  return (
    <TouchableOpacity style={styles.exRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.exDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLg">{exercise.name}</AppText>
        <View style={styles.exMetaRow}>
          <AppText variant="labelMono" upper color={Colors.textMuted}>
            {exercise.isCompound ? 'Compound' : 'Isolation'}{range ? ` · ${range}` : ''}
          </AppText>
          <AppText variant="labelMono" upper color={complete ? color : Colors.textMuted}>
            {complete ? 'Done' : `${done}/${target} Sets`}
          </AppText>
        </View>
        <View style={styles.exTrack}>
          <View style={[styles.exFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  dayTag,
  exercises,
  expanded,
  onToggle,
  progress,
  lastWeekProgress,
  loggedMap,
  onOpenExercise,
}: {
  dayTag: string;
  exercises: Exercise[];
  expanded: boolean;
  onToggle: () => void;
  progress: SetProgress;
  lastWeekProgress: SetProgress;
  loggedMap: Map<string, number>;
  onOpenExercise: (ex: Exercise) => void;
}) {
  const color = dayColorForTag(dayTag);
  const exCount = exercises.length;
  const { done, total, pct, complete } = progress;

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <TouchableOpacity style={styles.cardHead} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <AppText variant="labelMono" upper color={color}>{musclesForExercises(exercises)}</AppText>
          <View style={styles.nameRow}>
            <AppText variant="headlineMd">{dayTag}</AppText>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Meta */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="barbell-outline" size={16} color={Colors.textSecondary} />
          <AppText variant="bodyMd" color={Colors.textSecondary}>{exCount} Exercises</AppText>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <AppText variant="bodyMd" color={Colors.textSecondary}>{estMinutes(exCount)} Min</AppText>
        </View>
      </View>

      {/* This week's progress */}
      <View style={styles.progressBlock}>
        <View style={styles.progressLabelRow}>
          <AppText variant="labelMono" upper color={Colors.textSecondary}>This Week</AppText>
          <AppText variant="labelMono" upper color={color}>
            {complete ? 'Complete' : `${done}/${total} Sets`}
          </AppText>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>

        {/* Last week indicator — only shown if the user trained that day last week */}
        {lastWeekProgress.total > 0 && (
          <View style={styles.lastWeekRow}>
            <AppText variant="labelMono" upper color={Colors.textMuted}>Last Week</AppText>
            <AppText
              variant="labelMono"
              upper
              color={lastWeekProgress.complete ? color : Colors.textMuted}
            >
              {lastWeekProgress.complete
                ? '✓ Complete'
                : `${lastWeekProgress.done}/${lastWeekProgress.total} Sets`}
            </AppText>
          </View>
        )}
      </View>

      {/* Expanded exercise list */}
      {expanded && (
        <View style={styles.exList}>
          {exercises.map((ex) => {
            const exTarget = ex.targetSets > 0 ? ex.targetSets : DEFAULT_TARGET_SETS;
            const exDone = Math.min(loggedMap.get(weeklyKey(ex.id, dayTag)) ?? 0, exTarget);
            return (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                color={color}
                done={exDone}
                target={exTarget}
                onPress={() => onOpenExercise(ex)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutLogScreen() {
  const router = useRouter();
  const { data: allDays = [] } = useAllDays();
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // empty = all collapsed

  const thisWeekStart = useMemo(() => weekStartOf(Date.now()), []);
  const lastWeekStart = useMemo(() => thisWeekStart - 7 * 24 * 60 * 60 * 1000, [thisWeekStart]);

  const { data: thisWeekMap = new Map(), refetch: refetchThisWeek } = useWeeklyProgress(thisWeekStart);
  const { data: lastWeekMap = new Map() } = useWeeklyProgress(lastWeekStart);

  // Refresh this week's counts whenever the screen regains focus (e.g. after
  // logging sets on the exercise detail screen and navigating back).
  useFocusEffect(
    useCallback(() => {
      refetchThisWeek();
    }, [refetchThisWeek]),
  );

  const loggedMap = thisWeekMap;

  const toggle = useCallback((tag: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const openExercise = useCallback(
    (ex: Exercise, color: string, day: string) => {
      // Cast: typed-routes regenerates the union once Metro indexes the new route file.
      router.push({ pathname: '/exercise/[id]', params: { id: String(ex.id), color, day } } as never);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top app bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Ionicons name="barbell" size={22} color={Colors.primary} />
          <AppText variant="headlineMd" color={Colors.primary} style={{ fontFamily: Fonts.sansBold }}>
            Workout
          </AppText>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {allDays.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="sparkles-outline" size={48} color={Colors.textMuted} />
          <AppText variant="headlineMd" center>No workout plan yet</AppText>
          <AppText variant="bodyMd" color={Colors.textSecondary} center>
            Go to the Plans tab to build or activate a split.
          </AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.intro}>
            <AppText variant="headlineLg" style={{ fontSize: 28, lineHeight: 32 }}>Current Split</AppText>
            <AppText variant="bodyMd" color={Colors.textSecondary} style={{ marginTop: 4 }}>
              Select a day, then tap an exercise to start logging.
            </AppText>
          </View>

          {allDays.map(({ dayTag, exercises }) => (
            <DayCard
              key={dayTag}
              dayTag={dayTag}
              exercises={exercises}
              expanded={expanded.has(dayTag)}
              onToggle={() => toggle(dayTag)}
              progress={dayProgress(exercises, loggedMap, dayTag)}
              lastWeekProgress={dayProgress(exercises, lastWeekMap, dayTag)}
              loggedMap={loggedMap}
              onOpenExercise={(ex) => openExercise(ex, dayColorForTag(dayTag), dayTag)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MARGIN,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scroll: { paddingHorizontal: MARGIN, paddingTop: Spacing.lg, paddingBottom: 64 },
  intro: { marginBottom: Spacing.xl },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },

  // Day card — square, 1px border, left accent bar (Kinetic Mono)
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
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },

  metaRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  progressBlock: { marginTop: Spacing.md },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  lastWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },

  exList: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exDot: { width: 8, height: 8, borderRadius: 4 },
  exMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  exTrack: {
    height: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: 6,
  },
  exFill: { height: '100%' },
});
