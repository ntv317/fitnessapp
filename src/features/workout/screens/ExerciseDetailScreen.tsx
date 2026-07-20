import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActionSheetIOS, Alert, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Radius, Fonts } from '@/core/theme';
import { AppText } from '@/core/ui';
import { useUnit } from '@/core/context/UnitContext';
import { usePremium } from '@/core/context/PremiumContext';
import { useExercises, useAllDays, useUpsertExercise } from '../hooks/useExercises';
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
import { suggestProgression, bestSet } from '../utils/progression';
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
import { findClosestCatalogMatch, normalizeName } from '@/features/import/services/catalogMatch';
import { ChartTabs } from '../components/detail/ChartTabs';
import { SetInputCard, type EditingSetData } from '../components/detail/SetInputCard';
import { SessionHistoryList } from '../components/detail/SessionHistoryList';
import type { WorkoutLog } from '@/core/database/types';

// Per-screen-instance so auto-advance (replace mounts the next exercise before
// this one unmounts) can't cancel the new screen's pending notification.
function useRestNotification() {
  const { t } = useTranslation();
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
      content: { title: t('workout.restComplete'), body: t('workout.restCompleteBody'), sound: true },
      trigger: {
        seconds: Math.max(1, seconds),
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  }, [cancel, t]);

  return { schedule, cancel };
}
const MARGIN = 20; // margin-mobile
const REST_PRESETS = [60, 75, 90, 120, 150, 180];

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(onNext, 1800);
    return () => clearTimeout(timer);
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
            <AppText style={styles.prBadgeText}>{t('workout.newPRBadge')}</AppText>
          </View>
        )}
        <AppText variant="headlineLg" center style={{ fontSize: 26, lineHeight: 32, marginTop: 16 }}>
          {data.exerciseName}
        </AppText>
        <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginTop: 6 }}>
          {t('history.sets', { count: data.setCount })} · {data.volumeDisplay} {unit}
        </AppText>
        <AppText variant="labelMono" color={Colors.textMuted} style={{ marginTop: 32 }}>
          {t('workout.tapToContinue')}
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
  const { t } = useTranslation();
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
          <AppText variant="headlineMd" color={accent} style={{ fontFamily: Fonts.sansBold }}>{t('workout.rest')}</AppText>
        </View>
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('common.cancel')}</AppText>
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
            <AppText variant="labelMono" upper color={Colors.textSecondary}>{t('workout.secondsRemaining')}</AppText>
          </View>
        </View>

        {/* Up next */}
        <View style={styles.restUpNext}>
          <AppText variant="labelMono" upper color={accent} style={{ fontFamily: Fonts.sansBold }}>{t('workout.upNext')}</AppText>
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
          <AppText variant="headlineMd" color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>{t('workout.skipRest')}</AppText>
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
  const { t } = useTranslation();
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
  const upsertExercise = useUpsertExercise();
  const qc = useQueryClient();
  const { data: exercises = [] } = useExercises();
  const { data: history = [] } = useWorkoutLogs(exerciseId);

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: historyKey(exerciseId) });
  }, [exerciseId, qc]));
  const { data: allDays = [] } = useAllDays();
  const exercise = exercises.find((e) => e.id === exerciseId);
  // Exercises created from plans/AI import may lack a catalog link — fall back
  // to a name match so the Log-tab flow shows the same images and muscle/
  // equipment info as the library flow.
  const catalogExercise = useMemo(() => {
    if (!exercise) return undefined;
    if (exercise.catalogId) return getById(exercise.catalogId);
    return findClosestCatalogMatch(exercise.name) ?? undefined;
  }, [exercise]);
  // Header meta, matching the library preview screen: mechanic • worked
  // muscles • equipment (e.g. "COMPOUND • ABDOMINALS • BODY ONLY").
  // Exercises with no catalog match show only compound/isolation. A near match
  // (name fallback) keeps muscles but drops equipment — a "Bench Press" matched
  // to "Bench Press - With Bands" must not claim bands.
  const isExactCatalog =
    !!catalogExercise &&
    (!!exercise?.catalogId || normalizeName(catalogExercise.name) === normalizeName(exercise?.name ?? ''));
  // A user edit to muscle groups wins over the catalog's muscles, so saved
  // changes actually show here. Falls back to the catalog when the exercise
  // carries no group of its own.
  const muscleLabel = exercise?.muscleGroup
    ? [exercise.muscleGroup, ...(exercise.secondaryMuscleGroups ?? [])]
        .map((m) => t(`muscleGroups.${m}`, { defaultValue: m }))
        .join(' / ')
    : catalogExercise
      ? [...catalogExercise.primaryMuscles, ...catalogExercise.secondaryMuscles]
          .slice(0, 3)
          .map((m) => t(`exerciseMeta.muscles.${m}`, { defaultValue: m }))
          .join(' / ')
      : null;
  const metaLabel = [
    exercise?.isCompound ? t('workout.compound') : t('workout.isolation'),
    muscleLabel,
    isExactCatalog && catalogExercise?.equipment
      ? t(`exerciseMeta.equipment.${catalogExercise.equipment}`, { defaultValue: catalogExercise.equipment })
      : null,
  ]
    .filter(Boolean)
    .join(' • ');
  // Prefer the exercise's own reference photos / instructions (set in the edit
  // form) over the bundled catalog's.
  const detailImages =
    exercise?.imageUris && exercise.imageUris.length > 0
      ? exercise.imageUris
      : catalogExercise?.images ?? [];
  const detailInstructions =
    exercise?.instructions && exercise.instructions.length > 0
      ? exercise.instructions
      : catalogExercise?.instructions;

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
  const repRangeLabel = formatRepRange(planEntry?.repMin, planEntry?.repMax, t('workout.repsUnit'));

  // Today's log for this day, derived straight from history. Recomputed every
  // render (not memoized once at mount) — a session left open across midnight
  // must roll over to a new "today" boundary, matching what the repository's
  // getTodayLogId/createLog already compute fresh on every save.
  const todayBoundary = new Date();
  todayBoundary.setHours(0, 0, 0, 0);
  const startOfToday = todayBoundary.getTime();
  const todayLog = history.find((l) => l.timestamp >= startOfToday && (l.dayTag ?? null) === dayTag);
  const priorSession = history.find((l) => l !== todayLog && (l.dayTag ?? null) === dayTag);
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
  const { isPro } = usePremium();
  const progression = useMemo(
    () =>
      isPro && priorSession
        ? suggestProgression(priorSession.sets, planEntry?.repMin, planEntry?.repMax, 2.5)
        : null,
    [isPro, priorSession, planEntry],
  );
  const bestPriorSet = useMemo(() => bestSet(priorSession?.sets ?? []), [priorSession]);

  // Takes the sets array (rather than closing over `todaySets`) so
  // pushWatchState can compute the prefill for the set AFTER whatever was just
  // logged, using the fresh array passed to it — not a stale value from this
  // render.
  const prefillFor = useCallback(
    (sets: LoggedSet[]) => {
      // Sets 2+ continue this session: carry the previous set forward exactly,
      // unclamped — the lifter picked those numbers seconds ago and the plan's
      // range must not silently rewrite them.
      const last = sets[sets.length - 1];
      if (last) return { weightKg: last.weight, reps: last.reps };
      // Set 1 matches the progression chip shown above the input, so the
      // suggestion and the prefilled numbers never disagree. suggestProgression
      // already keeps reps inside the plan's range.
      if (progression) return { weightKg: progression.weightKg, reps: progression.reps };
      // No progression (no history, or not Pro): seed from the top set, clamped
      // so a stale range from an older plan doesn't propose reps it no longer
      // prescribes.
      return {
        weightKg: bestPriorSet?.weight ?? 0,
        reps: clampReps(bestPriorSet?.reps ?? suggestedReps, planEntry?.repMin, planEntry?.repMax),
      };
    },
    [progression, bestPriorSet, suggestedReps, planEntry],
  );
  const { weightKg: prefillWeightKg, reps: prefillReps } = prefillFor(todaySets);

  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restKey, setRestKey] = useState(0);
  const [editing, setEditing] = useState<EditingSetData | null>(null);

  const handleWatchSetRef = useRef<(p: WatchSetLogged) => void>(() => {});
  const handleSkipRef = useRef<() => void>(() => {});
  const handleFinishRef = useRef<() => void>(() => {});

  const { sendWorkoutState, sendMessage } = useWatchSync({
    onSetLogged: useCallback((p: WatchSetLogged) => handleWatchSetRef.current(p), []),
    onSkipRest: useCallback(() => handleSkipRef.current(), []),
    onFinishWorkout: useCallback(() => handleFinishRef.current(), []),
  });

  const weightStep = unit === 'kg' ? 2.5 : 5;

  const pushWatchState = useCallback(
    (updatedSets: LoggedSet[], isResting: boolean, restDuration: number) => {
      const loggedN = updatedSets.length;
      const { weightKg: nextWeightKg, reps: nextReps } = prefillFor(updatedSets);
      const weightForPlates = nextWeightKg > 0 ? nextWeightKg : suggestedWeight;
      const { plates } = calculatePlates(weightForPlates, barbellConfig.barWeight, barbellConfig.plates);
      // Session-so-far stats for the watch summary card. The current exercise
      // is summed from live sets (it isn't in the session until endRest), and
      // excluded from the session list so a re-completed exercise isn't
      // counted twice.
      const sess = getSession();
      const currentVolumeKg = updatedSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const otherVolumeKg =
        sess?.exercises.reduce((sum, e) => sum + (e.name === exercise?.name ? 0 : e.volumeKg), 0) ?? 0;
      const totalSets = Math.max(target, loggedN);
      sendWorkoutState({
        exerciseName: exercise?.name ?? '',
        // Clamp: after the final set there is no next set, so setNumber must not
        // exceed totalSets or the watch/Live Activity read "Set 4 of 3".
        setNumber: Math.min(loggedN + 1, totalSets),
        totalSets,
        suggestedReps: nextReps || suggestedReps,
        suggestedWeight: fromKg(weightForPlates),
        restDuration,
        isResting,
        isWorkoutComplete: loggedN >= target && !isResting,
        totalVolume: Math.round(fromKg(otherVolumeKg + currentVolumeKg)),
        elapsedMinutes: sess ? Math.max(0, Math.round((Date.now() - sess.startTime) / 60000)) : 0,
        workoutName: dayTag ?? '',
        unit,
        weightStep,
        plateBreakdown: plates.map((p) => Math.round(fromKg(p) * 10) / 10),
        showWeightConversion: showConversion,
        showPlateBreakdown,
        accentColor: accent,
      });
    },
    [exercise, target, prefillFor, suggestedWeight, suggestedReps, sendWorkoutState, fromKg, unit, weightStep, barbellConfig, showConversion, showPlateBreakdown, accent, dayTag],
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
        Alert.alert(t('workout.setNotSaved'), t('workout.setNotSavedBody'));
      });
      // The number pad is usually still up from typing weight/reps — the rest
      // overlay covers the whole screen, so a lingering keyboard floats over it.
      Keyboard.dismiss();
      const rest = exercise?.defaultRestSeconds ?? 75;
      setRestSeconds(rest);
      setRestKey((k) => k + 1);
      pushWatchState(updated, true, rest);
      const totalSetsForActivity = Math.max(target, updated.length);
      startRestActivity(exercise?.name ?? '', Math.min(updated.length + 1, totalSetsForActivity), totalSetsForActivity, Date.now() + rest * 1000, accent);
      scheduleRestNotification(rest);
    },
    [exerciseId, exercise, saveSet, pushWatchState, accent, scheduleRestNotification, dayTag, target, qc, t],
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
    // Nothing else pushes a cleared state from the phone — without this the
    // watch's last mid-workout snapshot can persist in its application
    // context and get resurrected on a cold start within the 4h window.
    // Mirrors exactly what the watch's own finishWorkoutLocally() resets.
    sendWorkoutState({
      exerciseName: '',
      setNumber: 1,
      totalSets: 1,
      suggestedReps: 0,
      suggestedWeight: 0,
      restDuration: 0,
      isResting: false,
      isWorkoutComplete: false,
      totalVolume: 0,
      elapsedMinutes: 0,
      workoutName: '',
      unit,
      weightStep,
      plateBreakdown: [],
      showWeightConversion: showConversion,
      showPlateBreakdown,
      accentColor: accent,
    });
    const session = getSession();
    if (session && session.exercises.length > 0) {
      router.replace({
        pathname: '/workout/summary',
        params: { day: params.day ?? '', startTime: String(startTimeRef.current), color: accent },
      } as never);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [priorHistory, exercise, accent, params.day, sendWorkoutState, unit, weightStep, showConversion, showPlateBreakdown]);

  // Watch "Finish" (from the summary screen) routes here too, so a
  // watch-initiated finish flushes the session and navigates on the phone —
  // previously this event was emitted natively but never subscribed to.
  handleFinishRef.current = handleFinish;

  const handleRestTimerMenu = useCallback(() => {
    if (!isPro) {
      router.push('/paywall' as never);
      return;
    }
    if (!exercise) return;
    const current = exercise.defaultRestSeconds;
    const labels = REST_PRESETS.map((s) => `${s}s${s === current ? ' ✓' : ''}`);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: t('workout.restTimer'), options: [t('common.cancel'), ...labels], cancelButtonIndex: 0 },
      (index) => {
        if (index === 0) return;
        upsertExercise.mutate({
          name: exercise.name,
          defaultRestSeconds: REST_PRESETS[index - 1],
          isCompound: exercise.isCompound,
          isCustom: exercise.isCustom,
        });
      },
    );
  }, [isPro, exercise, upsertExercise, t]);

  // ••• menu — two-tap protection against accidental mid-lift exits
  const handleMoreMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [t('common.cancel'), t('workout.finishWorkout'), t('workout.restTimer')], cancelButtonIndex: 0 },
      (index) => {
        if (index === 1) handleFinish();
        // Defer so the sheet finishes dismissing before the next one presents.
        else if (index === 2) setTimeout(handleRestTimerMenu, 0);
      },
    );
  }, [handleFinish, handleRestTimerMenu, t]);

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
    ? nextExercise?.name ?? t('workout.workoutComplete')
    : exercise?.name ?? t('workout.nextSet');
  const restUpSub = restAllDone
    ? nextExercise
      ? t('workout.nextExercise')
      : t('workout.dayDone')
    : t('workout.setXofY', { n: todaySets.length + 1, total: Math.max(target, todaySets.length + 1) }) +
      (prefillWeightKg > 0 ? ` • ${Math.round(fromKg(prefillWeightKg) * 10) / 10} ${unit} × ${prefillReps}` : '');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top app bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Ionicons name="barbell" size={20} color={Colors.primary} />
          <AppText variant="headlineMd" color={Colors.primary} style={{ fontFamily: Fonts.sansBold }}>
            {t('workout.title')}
          </AppText>
        </View>
        <View style={styles.appBarRight}>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/library/exercise-form', params: { exerciseId: String(exerciseId) } } as never)
            }
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.moreBtn}
          >
            <Ionicons name="pencil" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleMoreMenu}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.moreBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Exercise header */}
        <View style={styles.exHeader}>
          <AppText variant="headlineLg" selectable style={{ fontSize: 28, lineHeight: 32 }}>
            {exercise?.name ?? t('workout.exerciseFallback')}
          </AppText>
          <AppText variant="labelMono" upper color={Colors.textSecondary} style={{ marginTop: 2 }}>
            {[metaLabel, repRangeLabel].filter(Boolean).join(' • ')}
          </AppText>
          {progression && loggedCount === 0 && (
            <View style={styles.suggestionChip}>
              <Ionicons
                name={progression.increased ? 'trending-up' : 'repeat'}
                size={14}
                color={accent}
              />
              <AppText variant="labelMono" color={Colors.textSecondary}>
                {t('workout.nextSuggestion', {
                  weight: formatWeight(fromKg(progression.weightKg)),
                  unit,
                  reps: progression.reps,
                })}
                {progression.increased ? t('workout.earnedIncrease') : ''}
              </AppText>
            </View>
          )}
        </View>

        {detailImages.length > 0 && (
          <View style={styles.carouselWrap}>
            <ImageCarousel images={detailImages} instructions={detailInstructions} />
          </View>
        )}

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

        <ChartTabs logs={history} accent={accent} />

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
  appBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  moreBtn: {
    padding: 4,
  },
  scroll: { paddingHorizontal: MARGIN, paddingTop: Spacing.lg, paddingBottom: 64 },

  exHeader: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
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
