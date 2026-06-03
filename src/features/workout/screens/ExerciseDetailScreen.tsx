import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, Card, StepperInput } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { useExercises } from '../hooks/useExercises';
import { useAutoSaveSet, useWorkoutLogs } from '../hooks/useWorkoutLogs';
import { useWatchSync, type WatchSetLogged } from '../hooks/useWatchSync';
import { ProgressChart } from '@/features/history/components/ProgressChart';
const MARGIN = 20; // margin-mobile

interface SetState {
  weight: string; // as typed, in active unit
  reps: string;
  done: boolean;
}

// ── Rest timer card ──────────────────────────────────────────────────────────

function RestTimerCard({
  seconds,
  runKey,
  onSkip,
  color,
}: {
  seconds: number | null;
  runKey: number;
  onSkip: () => void;
  color: string;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (seconds == null) return;
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, runKey]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  return (
    <View style={styles.timerCard}>
      <AppText variant="labelMono" upper color={Colors.textSecondary}>Rest Timer</AppText>
      <AppText variant="displayTimer" color={color} style={styles.timerValue}>
        {mins}:{secs}
      </AppText>
      <TouchableOpacity onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <AppText variant="bodyMd" color={color} style={{ fontFamily: Fonts.sansBold }}>
          Skip Rest
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; color?: string }>();
  const exerciseId = Number(params.id);
  const accent = params.color ?? Colors.primary;

  const { unit, toKg, fromKg } = useUnit();
  const saveSet = useAutoSaveSet();
  const { data: exercises = [] } = useExercises();
  const { data: history = [] } = useWorkoutLogs(exerciseId);
  const exercise = exercises.find((e) => e.id === exerciseId);

  const [sets, setSets] = useState<SetState[]>(
    Array.from({ length: 3 }, () => ({ weight: '', reps: '', done: false })),
  );
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restKey, setRestKey] = useState(0);

  // Watch sync
  const setsRef = useRef(sets);
  setsRef.current = sets;

  // Sets logged from the wrist are handled by `completeSet` (defined below, once
  // pushWatchState/rest state exist). We route through a ref so the native
  // listener can call into that later-defined logic without a TDZ error.
  const handleWatchSetRef = useRef<(p: WatchSetLogged) => void>(() => {});

  const { sendWorkoutState, sendMessage } = useWatchSync({
    onSetLogged: useCallback((p: WatchSetLogged) => handleWatchSetRef.current(p), []),
  });

  // Once the exercise loads, size the table to its planned set count — but only
  // while the table is still pristine, so we never clobber user input.
  const sizedRef = useRef(false);
  useEffect(() => {
    if (sizedRef.current || !exercise) return;
    sizedRef.current = true;
    const n = exercise.targetSets > 0 ? exercise.targetSets : 3;
    if (n !== 3) {
      setSets(Array.from({ length: n }, () => ({ weight: '', reps: '', done: false })));
    }
  }, [exercise]);

  const weightStep = unit === 'kg' ? 2.5 : 5;

  // First not-done row is the "active" row (primary border).
  const activeIdx = sets.findIndex((s) => !s.done);

  // Suggested values come from the last logged session (first history entry)
  const lastSession = history[0];
  const suggestedWeight = lastSession
    ? Math.max(...lastSession.sets.map((s) => s.weight), 0)
    : 0;
  const suggestedReps = lastSession?.sets[0]?.reps ?? 10;

  const pushWatchState = useCallback(
    (updatedSets: SetState[], isResting: boolean, restDuration: number) => {
      const nextIdx = updatedSets.findIndex((s) => !s.done);
      const setNumber = nextIdx >= 0 ? nextIdx + 1 : updatedSets.length;
      sendWorkoutState({
        exerciseName: exercise?.name ?? '',
        setNumber,
        totalSets: updatedSets.length,
        suggestedReps,
        suggestedWeight: fromKg(suggestedWeight), // send in the active unit
        restDuration,
        isResting,
        isWorkoutComplete: false,
        unit,
        weightStep,
      });
    },
    [exercise, suggestedReps, suggestedWeight, sendWorkoutState, fromKg, unit, weightStep],
  );

  // Push initial state when exercise loads
  useEffect(() => {
    if (!exercise) return;
    pushWatchState(sets, false, exercise.isCompound ? 150 : 75);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  // Single source of truth for completing a set — used by both the on-screen
  // "done" checkbox and sets logged from the watch. Marks the row done, persists
  // it, starts the rest timer on the phone, and pushes the new state (with the
  // advanced set number + isResting) to the watch so its countdown begins.
  const completeSet = useCallback(
    (index: number, repsNum: number, weightKg: number) => {
      if (!repsNum) return;
      const display = String(Math.round(fromKg(weightKg) * 10) / 10);
      const updatedSets = setsRef.current.map((r, i) =>
        i === index ? { weight: display, reps: String(repsNum), done: true } : r,
      );
      setSets(updatedSets);
      saveSet(exerciseId, index + 1, repsNum, weightKg).catch(() => {});
      const rest = exercise?.isCompound ? 150 : 75;
      setRestSeconds(rest);
      setRestKey((k) => k + 1);
      pushWatchState(updatedSets, true, rest);
    },
    [exerciseId, exercise, saveSet, fromKg, pushWatchState],
  );

  // Wire the watch handler now that completeSet exists. Reassigned each render
  // so it always closes over the latest completeSet.
  handleWatchSetRef.current = ({ reps, weight, setOrder }: WatchSetLogged) => {
    const current = setsRef.current;
    const idx = setOrder - 1;
    const targetIdx =
      idx >= 0 && idx < current.length && !current[idx].done
        ? idx
        : current.findIndex((s) => !s.done);
    if (targetIdx < 0) return;
    // The watch reports weight in the active display unit; store canonical kg.
    completeSet(targetIdx, reps, toKg(weight));
  };

  const toggleDone = useCallback(
    (index: number) => {
      const s = setsRef.current[index];
      if (s.done) return;
      const reps = parseInt(s.reps, 10);
      const typed = parseFloat(s.weight) || 0;
      if (!reps) return;
      completeSet(index, reps, toKg(typed));
    },
    [completeSet, toKg],
  );

  const updateField = (index: number, field: 'weight' | 'reps', value: string) =>
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value, done: false } : s)),
    );

  const addSet = () =>
    setSets((prev) => [...prev, { weight: '', reps: '', done: false }]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top app bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Ionicons name="barbell" size={20} color={Colors.primary} />
          <AppText variant="headlineMd" color={Colors.primary} style={{ fontFamily: Fonts.sansBold }}>
            Workout
          </AppText>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={() => router.back()}>
          <AppText variant="bodyMd" color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>
            Finish
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Rest timer */}
        <RestTimerCard
          seconds={restSeconds}
          runKey={restKey}
          onSkip={() => {
            setRestSeconds(null);
            sendMessage({ type: 'skipRest' });
          }}
          color={accent}
        />

        {/* Exercise header */}
        <View style={styles.exHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="headlineLg" style={{ fontSize: 28, lineHeight: 32 }}>
              {exercise?.name ?? 'Exercise'}
            </AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginTop: 2 }}>
              {exercise?.isCompound ? 'Compound' : 'Isolation'} • Strength
            </AppText>
          </View>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push('/(tabs)/history')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
            <AppText variant="labelMono" upper color={Colors.textSecondary}>History</AppText>
          </TouchableOpacity>
        </View>

        {/* Set table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colSet}>Set</AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colInput} center>Weight ({unit})</AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colInput} center>Reps</AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colDone}>Done</AppText>
          </View>

          {sets.map((s, i) => {
            const active = i === activeIdx;
            return (
              <View
                key={i}
                style={[
                  styles.row,
                  active && styles.rowActive,
                  s.done && styles.rowDone,
                ]}
              >
                <AppText variant="dataInput" color={Colors.textSecondary} style={styles.colSet}>{i + 1}</AppText>
                <View style={styles.colInput}>
                  <StepperInput
                    value={s.weight}
                    onChangeText={(v) => updateField(i, 'weight', v)}
                    step={weightStep}
                    decimal
                    editable={!s.done}
                    color={accent}
                  />
                </View>
                <View style={styles.colInput}>
                  <StepperInput
                    value={s.reps}
                    onChangeText={(v) => updateField(i, 'reps', v)}
                    step={1}
                    editable={!s.done}
                    color={accent}
                  />
                </View>
                <View style={styles.colDone}>
                  <TouchableOpacity
                    style={[styles.checkbox, s.done && { borderColor: accent }]}
                    onPress={() => toggleDone(i)}
                    activeOpacity={0.7}
                  >
                    {s.done && <Ionicons name="checkmark" size={22} color={accent} />}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addSet} onPress={addSet} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color={Colors.textSecondary} />
            <AppText variant="labelMono" upper color={Colors.textSecondary}>Add Set</AppText>
          </TouchableOpacity>
        </View>

        {/* Progress chart */}
        {history.length >= 2 && (
          <Card style={styles.section}>
            <AppText variant="headlineMd">Progress Chart</AppText>
            <AppText variant="bodyMd" color={Colors.textSecondary} style={{ marginBottom: Spacing.sm }}>
              Best set over time
            </AppText>
            <ProgressChart logs={history} color={accent} />
          </Card>
        )}

        {/* Exercise notes */}
        <Card style={styles.section}>
          <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginBottom: Spacing.sm }}>
            Exercise Notes
          </AppText>
          <AppText variant="bodyMd">
            {exercise?.isCompound
              ? 'Brace your core and control the eccentric. Drive through the full range with explosive intent on the concentric.'
              : 'Slow, controlled reps. Focus on the target muscle and a strong squeeze at peak contraction.'}
          </AppText>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const COL_SET = 40;
const COL_DONE = 48;

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
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  finishBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  scroll: { paddingHorizontal: MARGIN, paddingTop: Spacing.lg, paddingBottom: 64 },

  timerCard: {
    backgroundColor: Colors.surfaceSunken,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  timerValue: { marginVertical: Spacing.xs },

  exHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 },

  table: { gap: Spacing.sm },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  rowActive: { borderColor: Colors.primary },
  rowDone: { backgroundColor: '#f7fff2', opacity: 0.85 },
  colSet: { width: COL_SET, textAlign: 'center' },
  colInput: { flex: 1 },
  colDone: { width: COL_DONE, alignItems: 'flex-end' },
  checkbox: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  section: { marginTop: Spacing.xl },
});
