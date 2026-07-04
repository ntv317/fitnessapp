import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActionSheetIOS, Alert, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { useExercises, useAllDays } from '../hooks/useExercises';
import {
  useAutoSaveSet,
  useWorkoutLogs,
  useWeeklyProgress,
  useUpdateSet,
  useDeleteSet,
  historyKey,
} from '../hooks/useWorkoutLogs';
import { DEFAULT_TARGET_SETS, weeklyKey } from '../utils/progress';
import { formatRepRange, clampReps } from '../utils/repRange';
import { weekStartOf } from '@/core/utils/date';
import { useQueryClient } from '@tanstack/react-query';
import { useWatchSync, type WatchSetLogged } from '../hooks/useWatchSync';
import { useBarbellConfig } from '../hooks/useBarbellConfig';
import { calculatePlates } from '@/core/utils/plateCalculator';
import { detectPR } from '../utils/pr';
import { startSession, addExerciseResult, getSession } from '../utils/workoutSession';
import { formatWeight } from '@/core/utils/format';
import * as Notifications from 'expo-notifications';
import {
  startRestActivity,
  updateRestActivity,
  stopRestActivity,
} from '../../../../modules/live-activity';
import { ImageCarousel } from '@/features/library/components/ImageCarousel';
import { getById } from '@/features/library/services/ExerciseCatalog';
import { ChartTabs } from '../components/detail/ChartTabs';
import { SetInputCard, type EditingSetData } from '../components/detail/SetInputCard';
import { SessionHistoryList } from '../components/detail/SessionHistoryList';
import type { WorkoutLog } from '@/core/database/types';

// Per-screen-instance so auto-advance (replace mounts the next exercise before
// this one unmounts) can't cancel the new screen's pending notification.
function useRestNotification() {
  const idRef = useRef<string | null>(null);

  const cancel = useCallback(async () => {
    if (idRef.current) {
      await Notifications.cancelScheduledNotificationAsync(idRef.current).catch(() => {});
      idRef.current = null;
    }
  }, []);

  // Fires when rest ends while the app is backgrounded; silent in foreground
  // (the rest overlay is already on screen).
  const schedule = useCallback(async (seconds: number) => {
    const perm = await Notifications.getPermissionsAsync().catch(() => null);
    if (!perm?.granted) return;
    await cancel();
    idRef.current = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest complete', body: 'Time for your next set.', sound: true },
      trigger: {
        seconds: Math.max(1, seconds),
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  }, [cancel]);

  return { schedule, cancel };
}
const MARGIN = 20; // margin-mobile

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
  onAdjust,
}: {
  durationSeconds: number;
  runKey: number;
  accent: string;
  upNextTitle: string;
  upNextSub: string;
  onComplete: () => void;
  onSkip: () => void;
  onAdjust?: (endAtMs: number) => void;
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
    onAdjust?.(endAtRef.current);
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

interface LoggedSet {
  setOrder: number;
  weight: number; // kg
  reps: number;
}

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; color?: string; day?: string; startTime?: string }>();
  const exerciseId = Number(params.id);
  const accent = params.color || Colors.primary;
  const startTimeRef = useRef(params.startTime ? parseInt(params.startTime) : Date.now());
  const [celebrateData, setCelebrateData] = useState<CelebrateData | null>(null);

  const { unit, toKg, fromKg, showConversion, showPlateBreakdown } = useUnit();
  const { schedule: scheduleRestNotification, cancel: cancelRestNotification } = useRestNotification();

  // Ask once up front so the permission dialog doesn't interrupt the first rest.
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);
  const { config: barbellConfig } = useBarbellConfig();
  const { saveSet, resetLogCache } = useAutoSaveSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const qc = useQueryClient();
  const { data: exercises = [] } = useExercises();
  const { data: history = [] } = useWorkoutLogs(exerciseId);

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: historyKey(exerciseId) });
  }, [exerciseId, qc]));
  const { data: allDays = [] } = useAllDays();
  const exercise = exercises.find((e) => e.id === exerciseId);
  const catalogExercise = exercise?.catalogId ? getById(exercise.catalogId) : undefined;
  // Header meta, matching the library preview screen: mechanic • worked
  // muscles • equipment (e.g. "COMPOUND • ABDOMINALS • BODY ONLY").
  // Custom/AI-imported exercises have no catalog link, so those show only
  // compound/isolation.
  const metaLabel = [
    exercise?.isCompound ? 'Compound' : 'Isolation',
    catalogExercise
      ? [...catalogExercise.primaryMuscles, ...catalogExercise.secondaryMuscles].slice(0, 3).join(' / ')
      : null,
    catalogExercise?.equipment ?? null,
  ]
    .filter(Boolean)
    .join(' • ');

  // Auto-advance targets the next INCOMPLETE exercise of the day (wrapping back
  // to skipped ones), so the summary only appears once every exercise is done.
  const thisWeekStart = useMemo(() => weekStartOf(Date.now()), []);
  const { data: weeklyMap = new Map<string, number>() } = useWeeklyProgress(thisWeekStart);
  // Launched from the Log tab, `day` is always given. Launched from the library
  // (no `day` param), auto-attach to the exercise's day in the active plan so
  // the set counts toward that day's weekly progress instead of silently
  // logging as freeform. Exercises not in any plan day fall back to null
  // (genuinely freeform), same as before.
  //
  // Auto-advance/next-exercise chaining below stays keyed on the raw route
  // param, not this resolved value — it's a Log-tab-specific workflow that
  // must stay off for library launches (chaining into the next exercise would
  // pass day='' to it, which is a non-null string that blocks this same
  // fallback from re-resolving on the next screen).
  const dayTag = params.day ?? exercise?.dayTag ?? null;
  const dayExercises = allDays.find((d) => d.dayTag === params.day)?.exercises ?? [];
  const curIdx = dayExercises.findIndex((e) => e.id === exerciseId);
  const remaining = dayExercises.filter((e) => {
    if (e.id === exerciseId) return false;
    const target = e.targetSets > 0 ? e.targetSets : DEFAULT_TARGET_SETS;
    return (weeklyMap.get(weeklyKey(e.id, dayTag)) ?? 0) < target;
  });
  const nextExercise =
    remaining.find((e) => dayExercises.indexOf(e) > curIdx) ?? remaining[0] ?? null;

  // dayExercises comes from getAllDays(), which already overrides targetSets with
  // the active plan's per-day PlanExercises.target_sets — prefer that over the
  // exercise's own base target_sets so editing a plan's set count actually reaches
  // the logging screen (the Log tab already reads dayExercises the same way).
  const planEntry = dayExercises.find((e) => e.id === exerciseId);
  const targetSource = planEntry ?? exercise;
  const target = targetSource && targetSource.targetSets > 0 ? targetSource.targetSets : DEFAULT_TARGET_SETS;
  const repRangeLabel = formatRepRange(planEntry?.repMin, planEntry?.repMax);

  // Today's log for this day, derived straight from history. Recomputed every
  // render (not memoized once at mount) — a session left open across midnight
  // must roll over to a new "today" boundary, matching what the repository's
  // getTodayLogId/createLog already compute fresh on every save.
  const todayBoundary = new Date();
  todayBoundary.setHours(0, 0, 0, 0);
  const startOfToday = todayBoundary.getTime();
  const todayLog = history.find((l) => l.timestamp >= startOfToday && (l.dayTag ?? null) === dayTag);
  const priorSession = history.find((l) => l !== todayLog);
  // detectPR compares today's sets against history — once today's own sets are
  // saved and refetched, `history` includes them too, which would make a PR
  // impossible to ever detect (today always ties itself). Compare against
  // everything BEFORE today instead.
  const priorHistory = todayLog ? history.filter((l) => l.id !== todayLog.id) : history;

  // Optimistic local mirror of today's logged sets, so completing a set (or the
  // watch logging one) updates the UI/rest-timer/watch-state immediately instead
  // of waiting on the query-invalidation round trip. Resynced from the server
  // once on load; after that, every mutation updates it directly.
  const [todaySets, setTodaySets] = useState<LoggedSet[]>([]);
  const touchedRef = useRef(false);
  // Guards the celebration overlay to fire once per target-crossing, not on
  // every rest-end after — otherwise logging freeform sets beyond the target
  // re-celebrates (and auto-advances away) on every single one.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (touchedRef.current) return;
    const seeded = (todayLog?.sets ?? []).map((s) => ({ setOrder: s.setOrder, weight: s.weight, reps: s.reps }));
    setTodaySets(seeded);
    celebratedRef.current = seeded.length >= target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLog]);
  const todaySetsRef = useRef(todaySets);
  todaySetsRef.current = todaySets;

  const loggedCount = todaySets.length;
  const suggestedWeight = priorSession ? Math.max(...priorSession.sets.map((s) => s.weight), 0) : 0;
  const suggestedReps = priorSession?.sets[0]?.reps ?? 10;
  // Takes an explicit loggedN (rather than closing over `loggedCount`) so
  // pushWatchState can compute the prefill for the set AFTER whatever was just
  // logged, using the fresh count passed to it — not a stale pre-increment
  // value from this render.
  const prefillFor = useCallback(
    (loggedN: number) => {
      const atNext = priorSession?.sets.find((s) => s.setOrder === loggedN + 1) ?? priorSession?.sets[loggedN];
      return {
        weightKg: atNext && atNext.weight > 0 ? atNext.weight : suggestedWeight,
        // Keep the suggestion inside the plan's rep range so a stale history
        // value doesn't propose reps the plan no longer prescribes.
        reps: clampReps(atNext && atNext.reps > 0 ? atNext.reps : suggestedReps, planEntry?.repMin, planEntry?.repMax),
      };
    },
    [priorSession, suggestedWeight, suggestedReps, planEntry],
  );
  const { weightKg: prefillWeightKg, reps: prefillReps } = prefillFor(loggedCount);

  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restKey, setRestKey] = useState(0);
  const [editing, setEditing] = useState<EditingSetData | null>(null);

  const handleWatchSetRef = useRef<(p: WatchSetLogged) => void>(() => {});
  const handleSkipRef = useRef<() => void>(() => {});

  const { sendWorkoutState, sendMessage } = useWatchSync({
    onSetLogged: useCallback((p: WatchSetLogged) => handleWatchSetRef.current(p), []),
    onSkipRest: useCallback(() => handleSkipRef.current(), []),
  });

  const weightStep = unit === 'kg' ? 2.5 : 5;

  const pushWatchState = useCallback(
    (updatedSets: LoggedSet[], isResting: boolean, restDuration: number) => {
      const loggedN = updatedSets.length;
      const { weightKg: nextWeightKg, reps: nextReps } = prefillFor(loggedN);
      const weightForPlates = nextWeightKg > 0 ? nextWeightKg : suggestedWeight;
      const { plates } = calculatePlates(weightForPlates, barbellConfig.barWeight, barbellConfig.plates);
      sendWorkoutState({
        exerciseName: exercise?.name ?? '',
        setNumber: loggedN + 1,
        totalSets: Math.max(target, loggedN),
        suggestedReps: nextReps || suggestedReps,
        suggestedWeight: fromKg(weightForPlates),
        restDuration,
        isResting,
        isWorkoutComplete: loggedN >= target && !isResting,
        unit,
        weightStep,
        plateBreakdown: plates.map((p) => Math.round(fromKg(p) * 10) / 10),
        showWeightConversion: showConversion,
        showPlateBreakdown,
        accentColor: accent,
      });
    },
    [exercise, target, prefillFor, suggestedWeight, suggestedReps, sendWorkoutState, fromKg, unit, weightStep, barbellConfig, showConversion, showPlateBreakdown, accent],
  );

  // Start session tracking on the very first exercise (no startTime in params).
  // If a recent session is already in progress (user navigated back to the day
  // list to open a skipped exercise), keep it instead of wiping its results.
  useEffect(() => {
    if (params.startTime) return;
    const existing = getSession();
    if (existing && Date.now() - existing.startTime < 4 * 60 * 60 * 1000) {
      startTimeRef.current = existing.startTime;
    } else {
      startSession(startTimeRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the screen mid-rest must not leave a stale lock-screen countdown.
  useEffect(() => () => {
    stopRestActivity();
    cancelRestNotification();
  }, [cancelRestNotification]);

  // Push initial state when exercise loads
  useEffect(() => {
    if (!exercise) return;
    pushWatchState(todaySetsRef.current, false, exercise.defaultRestSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  // Single source of truth for logging a new set — used by both the "+" button
  // and sets logged from the watch. Appends it, persists it, starts the rest
  // timer on the phone, and pushes the new state to the watch.
  const completeSet = useCallback(
    (weightKg: number, repsNum: number, rpe: number | null = null, note: string | null = null) => {
      if (!repsNum) return;
      touchedRef.current = true;
      const setOrder = todaySetsRef.current.length + 1;
      const updated = [...todaySetsRef.current, { setOrder, weight: weightKg, reps: repsNum }];
      // Written synchronously (not just via the render-driven assignment below)
      // so a second call in the same tick — e.g. the watch and a phone tap
      // landing back to back — reads the incremented length, not a stale one.
      todaySetsRef.current = updated;
      setTodaySets(updated);
      saveSet(exerciseId, setOrder, repsNum, weightKg, dayTag, rpe, note).catch(() => {
        // saveSet already retried once internally — this is a genuine failure.
        // Stop trusting the optimistic mirror and let the next history fetch
        // (which we force here) resync it, so the screen never shows a set
        // that isn't actually saved.
        touchedRef.current = false;
        qc.invalidateQueries({ queryKey: historyKey(exerciseId) });
        Alert.alert('Set not saved', 'That set could not be saved — please log it again.');
      });
      // The number pad is usually still up from typing weight/reps — the rest
      // overlay covers the whole screen, so a lingering keyboard floats over it.
      Keyboard.dismiss();
      const rest = exercise?.defaultRestSeconds ?? 75;
      setRestSeconds(rest);
      setRestKey((k) => k + 1);
      pushWatchState(updated, true, rest);
      startRestActivity(exercise?.name ?? '', updated.length + 1, Math.max(target, updated.length), Date.now() + rest * 1000, accent);
      scheduleRestNotification(rest);
    },
    [exerciseId, exercise, saveSet, pushWatchState, accent, scheduleRestNotification, dayTag, target, qc],
  );

  // Wire the watch handler now that completeSet exists. Reassigned each render
  // so it always closes over the latest completeSet. The watch always appends
  // at the next open slot — it has no concept of editing a past set.
  handleWatchSetRef.current = ({ reps, weight }: WatchSetLogged) => {
    completeSet(toKg(weight), reps);
  };

  // Ends the rest period (timer elapsed or user skipped). If the target is met,
  // shows the exercise-complete overlay; otherwise just unlocks the next set.
  const endRest = useCallback(
    (skipped = false) => {
      setRestSeconds(null);
      stopRestActivity();
      cancelRestNotification();
      if (skipped) sendMessage({ type: 'skipRest' });
      pushWatchState(todaySetsRef.current, false, 0);

      const allDone = todaySetsRef.current.length >= target;
      if (allDone && !celebratedRef.current) {
        celebratedRef.current = true;
        const volumeKg = todaySetsRef.current.reduce((sum, s) => sum + s.weight * s.reps, 0);
        const isPR = detectPR(todaySetsRef.current, priorHistory);
        addExerciseResult({ name: exercise?.name ?? '', volumeKg, isPR });
        setCelebrateData({
          exerciseName: exercise?.name ?? '',
          setCount: todaySetsRef.current.length,
          volumeDisplay: formatWeight(fromKg(volumeKg)),
          isPR,
        });
      }
    },
    [sendMessage, pushWatchState, exercise, priorHistory, fromKg, cancelRestNotification, target],
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

  // Finish button — flush today's logged sets into the session, then go to summary
  const handleFinish = useCallback(() => {
    if (todaySetsRef.current.length > 0) {
      const volumeKg = todaySetsRef.current.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const isPR = detectPR(todaySetsRef.current, priorHistory);
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
  }, [priorHistory, exercise, accent, params.day]);

  // ••• menu — two-tap protection against accidental mid-lift exits
  const handleMoreMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Finish Workout'], cancelButtonIndex: 0 },
      (index) => { if (index === 1) handleFinish(); },
    );
  }, [handleFinish]);

  // ── Editable history ────────────────────────────────────────────────────────

  const handleEditSet = useCallback((log: WorkoutLog, setOrder: number) => {
    const s = log.sets.find((x) => x.setOrder === setOrder);
    if (!s) return;
    setEditing({ logId: log.id, setOrder, timestamp: log.timestamp, weightKg: s.weight, reps: s.reps, rpe: s.rpe, note: s.note });
  }, []);

  const handleCancelEdit = useCallback(() => setEditing(null), []);

  const handleUpdateSet = useCallback(
    (weightKg: number, reps: number, rpe: number | null, note: string | null) => {
      if (!editing) return;
      const { logId, setOrder } = editing;
      updateSet.mutate({ logId, setOrder, reps, weight: weightKg, rpe, note });
      // Editing an already-logged set never touches the watch — only today's
      // append/delete flow does.
      if (todayLog && logId === todayLog.id) {
        setTodaySets((prev) => prev.map((s) => (s.setOrder === setOrder ? { ...s, weight: weightKg, reps } : s)));
      }
      setEditing(null);
    },
    [editing, updateSet, todayLog],
  );

  const handleDeleteSet = useCallback(() => {
    if (!editing) return;
    const { logId, setOrder } = editing;
    deleteSet.mutate({ logId, setOrder });
    if (todayLog && logId === todayLog.id) {
      // Match and compact by the set's own setOrder field, not array position —
      // mirrors the repo's compaction so the local mirror never drifts from the DB.
      const next = todaySetsRef.current
        .filter((s) => s.setOrder !== setOrder)
        .map((s) => (s.setOrder > setOrder ? { ...s, setOrder: s.setOrder - 1 } : s));
      setTodaySets(next);
      if (next.length === 0) {
        // The repo drops the now-empty WorkoutLogs row — if useAutoSaveSet
        // still had this log id cached, the next "+" would silently fail its
        // FOREIGN KEY insert (swallowed by completeSet's .catch).
        resetLogCache(exerciseId, dayTag);
      }
      // Deleting one of today's sets shrinks the set count — the watch must
      // know immediately so it doesn't log into a slot that no longer exists.
      pushWatchState(next, restSeconds != null, exercise?.defaultRestSeconds ?? 75);
    }
    setEditing(null);
  }, [editing, deleteSet, todayLog, pushWatchState, restSeconds, exercise, resetLogCache, exerciseId, dayTag]);

  const restAllDone = todaySets.length >= target;
  const restUpTitle = restAllDone
    ? nextExercise?.name ?? 'Workout Complete'
    : exercise?.name ?? 'Next Set';
  const restUpSub = restAllDone
    ? nextExercise
      ? 'Next exercise'
      : 'Great work — day done!'
    : `Set ${todaySets.length + 1} of ${Math.max(target, todaySets.length + 1)}` +
      (prefillWeightKg > 0 ? ` • ${Math.round(fromKg(prefillWeightKg) * 10) / 10} ${unit} × ${prefillReps}` : '');

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
          <AppText variant="headlineLg" selectable style={{ fontSize: 28, lineHeight: 32 }}>
            {exercise?.name ?? 'Exercise'}
          </AppText>
          <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginTop: 2 }}>
            {[metaLabel, repRangeLabel].filter(Boolean).join(' • ')}
          </AppText>
        </View>

        {catalogExercise && (
          <View style={styles.carouselWrap}>
            <ImageCarousel images={catalogExercise.images} instructions={catalogExercise.instructions} />
          </View>
        )}

        <ChartTabs logs={history} accent={accent} />

        <SetInputCard
          accent={accent}
          loggedCount={loggedCount}
          target={target}
          prefillWeightKg={prefillWeightKg}
          prefillReps={prefillReps}
          editing={editing}
          onLog={completeSet}
          onUpdate={handleUpdateSet}
          onDelete={handleDeleteSet}
          onCancelEdit={handleCancelEdit}
        />

        <SessionHistoryList logs={history} accent={accent} onEditSet={handleEditSet} />
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
          onAdjust={(endAtMs) => {
            updateRestActivity(endAtMs);
            scheduleRestNotification((endAtMs - Date.now()) / 1000);
          }}
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
    </SafeAreaView>
  );
}

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

  exHeader: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  carouselWrap: {
    marginHorizontal: -MARGIN,
    marginBottom: Spacing.md,
  },

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
