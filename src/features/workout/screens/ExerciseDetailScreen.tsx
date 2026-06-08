import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActionSheetIOS } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText, Card, StepperInput } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { useExercises, useAllDays } from '../hooks/useExercises';
import { useAutoSaveSet, useWorkoutLogs, historyKey } from '../hooks/useWorkoutLogs';
import { useQueryClient } from '@tanstack/react-query';
import { useWatchSync, type WatchSetLogged } from '../hooks/useWatchSync';
import { useBarbellConfig } from '../hooks/useBarbellConfig';
import { calculatePlates } from '@/core/utils/plateCalculator';
import { PlateChips } from '@/core/ui/PlateChips';
import { ProgressChart } from '@/features/history/components/ProgressChart';
import { detectPR } from '../utils/pr';
import { startSession, addExerciseResult, getSession } from '../utils/workoutSession';
import { formatWeight } from '@/core/utils/format';
const MARGIN = 20; // margin-mobile

interface SetState {
  id: number;
  weight: string; // as typed, in active unit
  reps: string;
  done: boolean;
}

let _setIdCounter = 0;
const nextSetId = () => ++_setIdCounter;

interface CelebrateData {
  exerciseName: string;
  setCount: number;
  volumeDisplay: string;
  isPR: boolean;
}

// ── Exercise complete overlay ─────────────────────────────────────────────────

function ExerciseCompleteOverlay({
  data,
  accent,
  unit,
  onNext,
}: {
  data: CelebrateData;
  accent: string;
  unit: string;
  onNext: () => void;
}) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(onNext, 1800);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <TouchableOpacity
      style={[styles.celebrateOverlay, { paddingTop: insets.top }]}
      onPress={onNext}
      activeOpacity={1}
    >
      <View style={styles.celebrateContent}>
        <View style={[styles.celebrateCircle, { borderColor: accent }]}>
          <Ionicons name="checkmark" size={44} color={accent} />
        </View>
        {data.isPR && (
          <View style={[styles.prBadge, { backgroundColor: accent }]}>
            <AppText style={styles.prBadgeText}>NEW PR</AppText>
          </View>
        )}
        <AppText variant="headlineLg" center style={{ fontSize: 26, lineHeight: 32, marginTop: 16 }}>
          {data.exerciseName}
        </AppText>
        <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginTop: 6 }}>
          {data.setCount} sets · {data.volumeDisplay} {unit}
        </AppText>
        <AppText variant="labelMono" color={Colors.textMuted} style={{ marginTop: 32 }}>
          tap to continue
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

// ── Full-screen rest timer ────────────────────────────────────────────────────

const RING_SIZE = 288;
const RING_STROKE = 14;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

function RestTimerOverlay({
  durationSeconds,
  runKey,
  accent,
  upNextTitle,
  upNextSub,
  onComplete,
  onSkip,
}: {
  durationSeconds: number;
  runKey: number;
  accent: string;
  upNextTitle: string;
  upNextSub: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [remaining, setRemaining] = useState(durationSeconds);
  const [total, setTotal] = useState(durationSeconds);
  const endAtRef = useRef(Date.now() + durationSeconds * 1000);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const doneRef = useRef(false);

  useEffect(() => {
    endAtRef.current = Date.now() + durationSeconds * 1000;
    setTotal(durationSeconds);
    setRemaining(durationSeconds);
    doneRef.current = false;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        onCompleteRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [durationSeconds, runKey]);

  const adjust = (delta: number) => {
    endAtRef.current = Math.max(Date.now(), endAtRef.current + delta * 1000);
    const rem = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
    setRemaining(rem);
    setTotal((t) => Math.max(t, rem));
  };

  const progress = total > 0 ? remaining / total : 0;
  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  return (
    <View style={styles.restOverlay}>
      {/* Header */}
      <View style={[styles.restHeader, { paddingTop: insets.top + Spacing.xs }]}>
        <View style={styles.restHeaderLeft}>
          <Ionicons name="timer-outline" size={20} color={accent} />
          <AppText variant="headlineMd" color={accent} style={{ fontFamily: Fonts.sansBold }}>REST</AppText>
        </View>
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppText variant="labelMono" upper color={Colors.textSecondary}>Cancel</AppText>
        </TouchableOpacity>
      </View>

      {/* Ring + countdown */}
      <View style={styles.restCenter}>
        <View style={styles.restRingWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.restRing}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} stroke={Colors.surfaceAlt} strokeWidth={1.5} fill="none" />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={accent}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.restCountWrap}>
            <AppText variant="displayTimer" color={Colors.textPrimary} style={styles.restCountText}>
              {mins}:{secs}
            </AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary}>Seconds Remaining</AppText>
          </View>
        </View>

        {/* Up next */}
        <View style={styles.restUpNext}>
          <AppText variant="labelMono" upper color={accent} style={{ fontFamily: Fonts.sansBold }}>Up Next</AppText>
          <AppText variant="headlineLg" center style={{ fontSize: 26, lineHeight: 30, marginTop: 2 }}>
            {upNextTitle}
          </AppText>
          <AppText variant="bodyMd" color={Colors.textSecondary} style={{ marginTop: 2 }}>
            {upNextSub}
          </AppText>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.restFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.restAdjustRow}>
          <TouchableOpacity style={styles.restAdjustBtn} onPress={() => adjust(-15)} activeOpacity={0.7}>
            <Ionicons name="remove" size={16} color={Colors.textPrimary} />
            <AppText variant="labelMono">15s</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.restAdjustBtn} onPress={() => adjust(15)} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color={Colors.textPrimary} />
            <AppText variant="labelMono">15s</AppText>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.restSkipBtn, { backgroundColor: accent }]} onPress={onSkip} activeOpacity={0.85}>
          <AppText variant="headlineMd" color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>Skip Rest</AppText>
          <Ionicons name="play-skip-forward" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; color?: string; day?: string; startTime?: string }>();
  const exerciseId = Number(params.id);
  const accent = params.color || Colors.primary;
  const startTimeRef = useRef(params.startTime ? parseInt(params.startTime) : Date.now());
  const [celebrateData, setCelebrateData] = useState<CelebrateData | null>(null);

  const { unit, toKg, fromKg, conversionHint, showConversion, showPlateBreakdown } = useUnit();
  const { config: barbellConfig } = useBarbellConfig();
  const saveSet = useAutoSaveSet();
  const qc = useQueryClient();
  const { data: exercises = [] } = useExercises();
  const { data: history = [] } = useWorkoutLogs(exerciseId);

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: historyKey(exerciseId) });
  }, [exerciseId, qc]));
  const { data: allDays = [] } = useAllDays();
  const exercise = exercises.find((e) => e.id === exerciseId);

  // The next exercise in this day's plan (for auto-advance after the last set).
  const dayExercises = allDays.find((d) => d.dayTag === params.day)?.exercises ?? [];
  const curIdx = dayExercises.findIndex((e) => e.id === exerciseId);
  const nextExercise =
    curIdx >= 0 && curIdx < dayExercises.length - 1 ? dayExercises[curIdx + 1] : null;

  const [sets, setSets] = useState<SetState[]>(
    Array.from({ length: 3 }, () => ({ id: nextSetId(), weight: '', reps: '', done: false })),
  );
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restKey, setRestKey] = useState(0);

  // Watch sync
  const setsRef = useRef(sets);
  setsRef.current = sets;

  // Becomes true once the user types/steps/logs, so auto pre-fill stops.
  const touchedRef = useRef(false);

  // When the user changes their unit preference mid-session, convert every
  // typed weight string from the old unit to the new one so the physical load
  // stays the same (100 kg → 220 lbs, not 100 lbs).
  const prevUnitRef = useRef(unit);
  useEffect(() => {
    const prevUnit = prevUnitRef.current;
    prevUnitRef.current = unit;
    if (prevUnit === unit) return;
    const KG_PER_LB = 0.45359237;
    const oldToKg = (v: number) => prevUnit === 'kg' ? v : v * KG_PER_LB;
    setSets(prev => prev.map(s => {
      const typed = parseFloat(s.weight);
      if (!typed) return s;
      const converted = Math.round(fromKg(oldToKg(typed)) * 10) / 10;
      return { ...s, weight: String(converted) };
    }));
  // fromKg already reflects the new unit; prevUnitRef tracks the old one
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // Sets logged from the wrist are handled by `completeSet` (defined below, once
  // pushWatchState/rest state exist). We route through a ref so the native
  // listener can call into that later-defined logic without a TDZ error.
  const handleWatchSetRef = useRef<(p: WatchSetLogged) => void>(() => {});
  const handleSkipRef = useRef<() => void>(() => {});

  const { sendWorkoutState, sendMessage } = useWatchSync({
    onSetLogged: useCallback((p: WatchSetLogged) => handleWatchSetRef.current(p), []),
    onSkipRest: useCallback(() => handleSkipRef.current(), []),
  });

  const weightStep = unit === 'kg' ? 2.5 : 5;

  // First not-done row is the "active" row (primary border).
  const activeIdx = sets.findIndex((s) => !s.done);

  // Suggested values come from the last logged session (first history entry)
  const lastSession = history[0];
  const suggestedWeight = lastSession
    ? Math.max(...lastSession.sets.map((s) => s.weight), 0)
    : 0;
  const suggestedReps = lastSession?.sets[0]?.reps ?? 10;

  // Size the table to the planned set count AND pre-fill each row with the last
  // session's weight/reps, so the screen opens on your previous numbers (not 0).
  // Depends on `history` (not the derived scalars) so the effect re-runs when
  // history arrives from the DB — even when the derived values happen to equal
  // the initial defaults (e.g. weight=0 or reps=10 from an AI-imported session).
  useEffect(() => {
    if (touchedRef.current || !exercise) return;
    const session = history[0];
    const n = exercise.targetSets > 0 ? exercise.targetSets : 3;
    const newSets = Array.from({ length: n }, (_, i) => {
      // Match by setOrder (1-based) so set 1 gets set 1's values, set 2 gets set 2's, etc.
      const prev = session?.sets.find((s) => s.setOrder === i + 1) ?? session?.sets[i];
      const w = prev && prev.weight > 0 ? String(Math.round(fromKg(prev.weight) * 10) / 10) : '';
      const r = prev && prev.reps > 0 ? String(prev.reps) : '';
      return { id: nextSetId(), weight: w, reps: r, done: false };
    });
    setSets(newSets);
    pushWatchState(newSets, false, exercise.defaultRestSeconds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, history, fromKg]);

  const pushWatchState = useCallback(
    (updatedSets: SetState[], isResting: boolean, restDuration: number) => {
      const nextIdx = updatedSets.findIndex((s) => !s.done);
      const setNumber = nextIdx >= 0 ? nextIdx + 1 : updatedSets.length;
      const typedKg = nextIdx >= 0 ? toKg(parseFloat(updatedSets[nextIdx].weight) || 0) : 0;
      const weightForPlates = typedKg > 0 ? typedKg : suggestedWeight;
      const { plates } = calculatePlates(weightForPlates, barbellConfig.barWeight, barbellConfig.plates);
      sendWorkoutState({
        exerciseName: exercise?.name ?? '',
        setNumber,
        totalSets: updatedSets.length,
        suggestedReps,
        suggestedWeight: fromKg(weightForPlates),
        restDuration,
        isResting,
        isWorkoutComplete: false,
        unit,
        weightStep,
        plateBreakdown: plates.map(p => Math.round(fromKg(p) * 10) / 10),
        showWeightConversion: showConversion,
        showPlateBreakdown,
        accentColor: accent,
      });
    },
    [exercise, suggestedReps, suggestedWeight, sendWorkoutState, toKg, fromKg, unit, weightStep, barbellConfig, showConversion],
  );

  // Start session tracking on the very first exercise (no startTime in params)
  useEffect(() => {
    if (!params.startTime) startSession(startTimeRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push initial state when exercise loads
  useEffect(() => {
    if (!exercise) return;
    pushWatchState(sets, false, exercise.defaultRestSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  // Single source of truth for completing a set — used by both the on-screen
  // "done" checkbox and sets logged from the watch. Marks the row done, persists
  // it, starts the rest timer on the phone, and pushes the new state (with the
  // advanced set number + isResting) to the watch so its countdown begins.
  const completeSet = useCallback(
    (index: number, repsNum: number, weightKg: number) => {
      if (!repsNum) return;
      touchedRef.current = true;
      const display = String(Math.round(fromKg(weightKg) * 10) / 10);
      const updatedSets = setsRef.current.map((r, i) =>
        i === index ? { ...r, weight: display, reps: String(repsNum), done: true } : r,
      );
      setSets(updatedSets);
      saveSet(exerciseId, index + 1, repsNum, weightKg).catch(() => {});
      const rest = exercise?.defaultRestSeconds ?? 75;
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

  // Ends the rest period (timer elapsed or user skipped). If every set is done,
  // shows the exercise-complete overlay; otherwise just unlocks the next set.
  const endRest = useCallback(
    (skipped = false) => {
      setRestSeconds(null);
      if (skipped) sendMessage({ type: 'skipRest' });
      pushWatchState(setsRef.current, false, 0);

      const allDone = setsRef.current.length > 0 && setsRef.current.every((s) => s.done);
      if (allDone) {
        // Compute volume and PR for this exercise
        const sessionSetsKg = setsRef.current.map((s) => ({
          weight: toKg(parseFloat(s.weight) || 0),
          reps: parseInt(s.reps) || 0,
        }));
        const volumeKg = sessionSetsKg.reduce((sum, s) => sum + s.weight * s.reps, 0);
        const isPR = detectPR(sessionSetsKg, history);
        addExerciseResult({ name: exercise?.name ?? '', volumeKg, isPR });
        setCelebrateData({
          exerciseName: exercise?.name ?? '',
          setCount: setsRef.current.length,
          volumeDisplay: formatWeight(fromKg(volumeKg)),
          isPR,
        });
      }
    },
    [sendMessage, pushWatchState, exercise, history, toKg, fromKg],
  );

  // Called when the celebrate overlay auto-advances or is tapped
  const handleCelebrateNext = useCallback(() => {
    setCelebrateData(null);
    if (nextExercise) {
      router.replace({
        pathname: '/exercise/[id]',
        params: {
          id: String(nextExercise.id),
          color: accent,
          day: params.day ?? '',
          startTime: String(startTimeRef.current),
        },
      } as never);
    } else {
      router.replace({
        pathname: '/workout/summary',
        params: { day: params.day ?? '', startTime: String(startTimeRef.current), color: accent },
      } as never);
    }
  }, [nextExercise, router, accent, params.day]);

  // Watch "Skip Rest" routes here once endRest exists.
  handleSkipRef.current = () => endRest(false);

  // Finish button — flush current exercise's done sets into session, then go to summary
  const handleFinish = useCallback(() => {
    const doneSets = setsRef.current.filter((s) => s.done);
    if (doneSets.length > 0) {
      const sessionSetsKg = doneSets.map((s) => ({
        weight: toKg(parseFloat(s.weight) || 0),
        reps: parseInt(s.reps) || 0,
      }));
      const volumeKg = sessionSetsKg.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const isPR = detectPR(sessionSetsKg, history);
      addExerciseResult({ name: exercise?.name ?? '', volumeKg, isPR });
    }
    const session = getSession();
    if (session && session.exercises.length > 0) {
      router.replace({
        pathname: '/workout/summary',
        params: { day: params.day ?? '', startTime: String(startTimeRef.current), color: accent },
      } as never);
    } else {
      router.back();
    }
  }, [toKg, history, exercise, accent, params.day]);

  // ••• menu — two-tap protection against accidental mid-lift exits
  const handleMoreMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Finish Workout'], cancelButtonIndex: 0 },
      (index) => { if (index === 1) handleFinish(); },
    );
  }, [handleFinish]);

  const watchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateField = (index: number, field: 'weight' | 'reps', value: string) => {
    touchedRef.current = true;
    const newSets = setsRef.current.map((s, i) => (i === index ? { ...s, [field]: value, done: false } : s));
    setSets(newSets);
    if (field === 'weight') {
      clearTimeout(watchDebounceRef.current);
      watchDebounceRef.current = setTimeout(() => {
        pushWatchState(newSets, restSeconds != null, exercise?.defaultRestSeconds ?? 75);
      }, 200);
    }
  };

  const addSet = () =>
    setSets((prev) => [...prev, { id: nextSetId(), weight: '', reps: '', done: false }]);

  const [undoData, setUndoData] = useState<{ set: SetState; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const deleteSet = useCallback((index: number) => {
    const deleted = setsRef.current[index];
    setSets((prev) => prev.filter((_, i) => i !== index));
    clearTimeout(undoTimerRef.current);
    setUndoData({ set: deleted, index });
    undoTimerRef.current = setTimeout(() => setUndoData(null), 3000);
  }, []);

  const undoDelete = useCallback(() => {
    if (!undoData) return;
    clearTimeout(undoTimerRef.current);
    setSets((prev) => {
      const next = [...prev];
      next.splice(undoData.index, 0, undoData.set);
      return next;
    });
    setUndoData(null);
  }, [undoData]);

  // "Up next" shown on the rest timer: the next set, or the next exercise once
  // every set in this exercise is done.
  // Compute plates once; used to suppress the redundant conversion hint when the card is visible.
  const activePlateResult = (() => {
    const activeW = parseFloat(sets[activeIdx]?.weight ?? '') || 0;
    if (activeW <= 0 || barbellConfig.plates.length === 0) return null;
    const r = calculatePlates(toKg(activeW), barbellConfig.barWeight, barbellConfig.plates);
    return r.plates.length > 0 ? r : null;
  })();

  const restAllDone = sets.length > 0 && sets.every((s) => s.done);
  const restNextIdx = sets.findIndex((s) => !s.done);
  const restUpTitle = restAllDone
    ? nextExercise?.name ?? 'Workout Complete'
    : exercise?.name ?? 'Next Set';
  const restUpSub = restAllDone
    ? nextExercise
      ? 'Next exercise'
      : 'Great work — day done!'
    : `Set ${restNextIdx + 1} of ${sets.length}` +
      (suggestedWeight > 0
        ? ` • ${Math.round(fromKg(suggestedWeight) * 10) / 10} ${unit} × ${suggestedReps}`
        : '');

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
        <TouchableOpacity
          onPress={handleMoreMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.moreBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            onPress={() =>
              router.push({
                pathname: '/(tabs)/history',
                params: { exerciseId: String(exerciseId) },
              })
            }
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
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colWeight} center>Weight ({unit})</AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colReps} center>Reps</AppText>
            <AppText variant="labelMono" upper color={Colors.textSecondary} style={styles.colDone}>Done</AppText>
          </View>

          {sets.map((s, i) => {
            const active = i === activeIdx;
            return (
              <Swipeable
                key={s.id}
                enabled={!s.done && restSeconds == null}
                friction={2}
                rightThreshold={40}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.deleteAction}
                    onPress={() => deleteSet(i)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.white} />
                  </TouchableOpacity>
                )}
              >
                <View
                  style={[
                    styles.row,
                    active && { borderColor: accent },
                    s.done && styles.rowDone,
                  ]}
                >
                  <AppText variant="dataInput" color={Colors.textSecondary} style={styles.colSet}>{i + 1}</AppText>
                  <View style={styles.colWeight}>
                    <StepperInput
                      value={s.weight}
                      onChangeText={(v) => updateField(i, 'weight', v)}
                      step={weightStep}
                      decimal
                      editable={!s.done}
                      color={accent}
                    />
                  </View>
                  <View style={styles.colReps}>
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
              </Swipeable>
            );
          })}

          <TouchableOpacity style={styles.addSet} onPress={addSet} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color={Colors.textSecondary} />
            <AppText variant="labelMono" upper color={Colors.textSecondary}>Add Set</AppText>
          </TouchableOpacity>
        </View>

        {/* Conversion hint — hidden when plate card is visible (card footer already shows it) */}
        {!activePlateResult && activeIdx >= 0 &&
          conversionHint(parseFloat(sets[activeIdx]?.weight ?? '') || 0) ? (
          <AppText variant="labelMono" color={Colors.textMuted} style={styles.convHintBelowTable}>
            {conversionHint(parseFloat(sets[activeIdx]?.weight ?? '') || 0)}
          </AppText>
        ) : null}

        {/* Plate calculator */}
        {activePlateResult && (
          <PlateChips
            plates={activePlateResult.plates}
            barWeight={Math.round(fromKg(barbellConfig.barWeight) * 10) / 10}
            totalWeight={fromKg(activePlateResult.achievable)}
            exact={activePlateResult.exact}
            unit={unit}
          />
        )}

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
      </View>

      {/* Full-screen rest timer — blocks input until it ends or the user skips */}
      {restSeconds != null && (
        <RestTimerOverlay
          durationSeconds={restSeconds}
          runKey={restKey}
          accent={accent}
          upNextTitle={restUpTitle}
          upNextSub={restUpSub}
          onComplete={() => endRest(false)}
          onSkip={() => endRest(true)}
        />
      )}

      {/* Exercise complete celebration overlay */}
      {celebrateData && (
        <ExerciseCompleteOverlay
          data={celebrateData}
          accent={accent}
          unit={unit}
          onNext={handleCelebrateNext}
        />
      )}

      {/* Undo toast */}
      {undoData && (
        <View style={styles.undoToast}>
          <AppText variant="labelMono" color={Colors.white}>
            Set {undoData.index + 1} removed
          </AppText>
          <TouchableOpacity onPress={undoDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText variant="labelMono" color={accent} style={{ fontFamily: Fonts.sansBold }}>
              UNDO
            </AppText>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const COL_SET = 40;
const COL_DONE = 48;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
  restOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background, // fully opaque — immersive + blocks taps
    zIndex: 20,
  },
  restHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
    paddingVertical: Spacing.sm,
  },
  restHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: MARGIN,
  },
  restRingWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  restRing: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  restCountWrap: { alignItems: 'center' },
  restCountText: { fontSize: 74, lineHeight: 78 },
  restUpNext: { alignItems: 'center' },
  restUpNextMeta: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
  restDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted, marginHorizontal: 8 },
  restFooter: { paddingHorizontal: MARGIN, gap: Spacing.md },
  restAdjustRow: { flexDirection: 'row', gap: Spacing.md },
  restAdjustBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  restSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
  },
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
  moreBtn: {
    padding: 4,
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
  rowDone: { backgroundColor: '#f7fff2', opacity: 0.85 },
  colSet: { width: COL_SET, textAlign: 'center' },
  colInput: { flex: 1 },
  colWeight: { flex: 1.4, paddingHorizontal: 3, alignItems: 'center' }, // wider — fits decimals like 102.5
  convHintBelowTable: { fontSize: 10, textAlign: 'center', marginTop: 4 },
  colReps: { flex: 1, paddingHorizontal: 3 },
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
  deleteAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: Radius.sm,
    marginLeft: Spacing.sm,
  },
  undoToast: {
    position: 'absolute',
    bottom: 24,
    left: MARGIN,
    right: MARGIN,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  section: { marginTop: Spacing.xl },

  celebrateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrateContent: { alignItems: 'center', paddingHorizontal: MARGIN },
  celebrateCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prBadge: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  prBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.white,
    letterSpacing: 1,
  },
});
