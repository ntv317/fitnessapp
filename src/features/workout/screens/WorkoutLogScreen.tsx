import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { WEEKLY_PLAN } from '@/core/config/workoutPlan';
import { useAllDays } from '../hooks/useExercises';
import { useAllHistory } from '../hooks/useWorkoutLogs';
import { loggedSetsThisWeek, dayProgress, DEFAULT_TARGET_SETS, type SetProgress } from '../utils/progress';
import { AppText, UnitToggle } from '@/core/ui';
import type { Exercise } from '@/core/database/types';

const MARGIN = 20; // margin-mobile

// ── Plan lookups ─────────────────────────────────────────────────────────────

function planFor(dayTag: string) {
  return Object.values(WEEKLY_PLAN).find((p) => p?.name === dayTag) ?? null;
}

function weekdayFor(dayTag: string): number | null {
  const entry = Object.entries(WEEKLY_PLAN).find(([, p]) => p?.name === dayTag);
  return entry ? Number(entry[0]) : null;
}

function dayColor(dayTag: string): string {
  return planFor(dayTag)?.color ?? Colors.primary;
}

function musclesFor(dayTag: string): string {
  const p = planFor(dayTag);
  return p ? p.muscles.join(' / ') : 'Custom';
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
  return (
    <TouchableOpacity style={styles.exRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.exDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLg">{exercise.name}</AppText>
        <View style={styles.exMetaRow}>
          <AppText variant="labelMono" upper color={Colors.textMuted}>
            {exercise.isCompound ? 'Compound' : 'Isolation'}
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
  isToday,
  expanded,
  onToggle,
  progress,
  loggedMap,
  onOpenExercise,
}: {
  dayTag: string;
  exercises: Exercise[];
  isToday: boolean;
  expanded: boolean;
  onToggle: () => void;
  progress: SetProgress;
  loggedMap: Map<number, number>;
  onOpenExercise: (ex: Exercise) => void;
}) {
  const color = dayColor(dayTag);
  const exCount = exercises.length;
  const { done, total, pct, complete } = progress;

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <TouchableOpacity style={styles.cardHead} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <View style={styles.catRow}>
            <AppText variant="labelMono" upper color={color}>{musclesFor(dayTag)}</AppText>
            {isToday && (
              <View style={[styles.todayPill, { backgroundColor: color }]}>
                <AppText variant="labelMono" upper color={Colors.white} style={{ fontSize: 10 }}>Today</AppText>
              </View>
            )}
          </View>
          <AppText variant="headlineMd" style={{ marginTop: 2 }}>{dayTag}</AppText>
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

      {/* Weekly progress (sets completed this week) */}
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
      </View>

      {/* Expanded exercise list */}
      {expanded && (
        <View style={styles.exList}>
          {exercises.map((ex) => {
            const exTarget = ex.targetSets > 0 ? ex.targetSets : DEFAULT_TARGET_SETS;
            const exDone = Math.min(loggedMap.get(ex.id) ?? 0, exTarget);
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
  const { data: history = [], refetch: refetchHistory } = useAllHistory();
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // empty = all collapsed

  // Refresh weekly progress whenever the Log screen regains focus (e.g. after
  // logging sets on the exercise detail screen and navigating back).
  useFocusEffect(
    useCallback(() => {
      refetchHistory();
    }, [refetchHistory]),
  );

  const today = new Date().getDay();
  const todayTag = WEEKLY_PLAN[today]?.name ?? null;

  // Sort days so today is first, then tomorrow, etc. Unplanned days last.
  const sortedDays = useMemo(() => {
    const offset = (tag: string) => {
      const wd = weekdayFor(tag);
      if (wd == null) return 99;
      return (wd - today + 7) % 7;
    };
    return [...allDays].sort((a, b) => offset(a.dayTag) - offset(b.dayTag));
  }, [allDays, today]);

  // exerciseId → sets logged this calendar week. Drives set-level day progress,
  // counted by exercise membership (not the log's primary dayTag) so a day's
  // progress reflects exactly the exercises shown on that card.
  const loggedMap = useMemo(() => loggedSetsThisWeek(history), [history]);

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
        <UnitToggle />
      </View>

      {allDays.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="sparkles-outline" size={48} color={Colors.textMuted} />
          <AppText variant="headlineMd" center>No workout plan yet</AppText>
          <AppText variant="bodyMd" color={Colors.textSecondary} center>
            Go to the AI Import tab to generate your weekly split.
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

          {sortedDays.map(({ dayTag, exercises }) => (
            <DayCard
              key={dayTag}
              dayTag={dayTag}
              exercises={exercises}
              isToday={todayTag === dayTag}
              expanded={expanded.has(dayTag)}
              onToggle={() => toggle(dayTag)}
              progress={dayProgress(exercises, loggedMap)}
              loggedMap={loggedMap}
              onOpenExercise={(ex) => openExercise(ex, dayColor(dayTag), dayTag)}
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
  todayPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },

  metaRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  progressBlock: { marginTop: Spacing.md },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
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
