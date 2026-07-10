import { useCallback, useEffect, useRef } from 'react';
import WatchSync from '../../../../modules/watch-sync';
import { usePremium } from '@/core/context/PremiumContext';

/**
 * Apple Watch sync bridge.
 *
 * The companion watchOS app (TRAKWatch) mirrors the active set and rest timer,
 * and can log a set from the wrist. This hook talks to the native `WatchSync`
 * module (WatchConnectivity / WCSession):
 *   - `sendWorkoutState` pushes the current set/rest snapshot to the watch.
 *   - `sendMessage` sends one-off events (e.g. { type: 'skipRest' }).
 *   - `onSetLogged` fires when the watch logs a set from the wrist.
 *
 * If the native module isn't available (Android, or a build without it), the
 * module is null and every call is a safe no-op.
 */

export interface WatchWorkoutState {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  suggestedReps: number;
  suggestedWeight: number; // in the active display unit (see `unit`)
  restDuration: number;
  isResting: boolean;
  isWorkoutComplete: boolean;
  totalVolume: number; // session volume so far, in the active display unit
  elapsedMinutes: number;
  workoutName: string; // day tag, e.g. "Push"
  unit: 'kg' | 'lbs';
  weightStep: number; // +/- and Digital Crown increment, in the active unit
  plateBreakdown: number[]; // plates per side, largest-first; empty = no config
  showWeightConversion: boolean;
  showPlateBreakdown: boolean;
  accentColor: string; // hex color for the active day, e.g. "#a83300"
}

export interface WatchSetLogged {
  reps: number;
  weight: number; // kg
  setOrder: number;
}

export interface WatchMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWatchSyncOptions {
  onSetLogged?: (payload: WatchSetLogged) => void | Promise<void>;
  /** Fired when the user skips rest from the watch. */
  onSkipRest?: () => void;
  /** Fired when the user taps "Finish" on the watch's summary screen. */
  onFinishWorkout?: () => void;
}

export function useWatchSync(options: UseWatchSyncOptions = {}) {
  const { onSetLogged, onSkipRest, onFinishWorkout } = options;
  const { isPro, isLoading } = usePremium();

  // Keep the latest callbacks in refs so the listeners don't churn.
  const onSetLoggedRef = useRef(onSetLogged);
  onSetLoggedRef.current = onSetLogged;
  const onSkipRestRef = useRef(onSkipRest);
  onSkipRestRef.current = onSkipRest;
  const onFinishWorkoutRef = useRef(onFinishWorkout);
  onFinishWorkoutRef.current = onFinishWorkout;

  // Blocked only once the user is definitively non-Pro; while the entitlement
  // is resolving we still send/accept so a Pro watch never stalls or drops sets.
  const blocked = !isPro && !isLoading;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    if (!WatchSync) return;
    // Listeners stay registered so identity is stable across entitlement
    // resolution; payloads from a non-Pro watch are dropped instead.
    const setSub = WatchSync.addListener('onSetLogged', (payload: WatchSetLogged) => {
      if (blockedRef.current) return;
      onSetLoggedRef.current?.(payload);
    });
    const skipSub = WatchSync.addListener('onSkipRest', () => {
      if (blockedRef.current) return;
      onSkipRestRef.current?.();
    });
    const finishSub = WatchSync.addListener('onFinishWorkout', () => {
      if (blockedRef.current) return;
      onFinishWorkoutRef.current?.();
    });
    return () => {
      setSub.remove();
      skipSub.remove();
      finishSub.remove();
    };
  }, []);

  const sendWorkoutState = useCallback((state: WatchWorkoutState) => {
    if (blocked) return;
    // stateAt lets the watch ignore a stale persisted snapshot on cold start
    // (e.g. yesterday's workout) while still restoring the premium lock.
    WatchSync?.updateState({ ...state, stateAt: Date.now() } as unknown as Record<string, unknown>);
  }, [blocked]);

  const sendMessage = useCallback((message: WatchMessage) => {
    if (blocked) return;
    WatchSync?.sendMessage(message as Record<string, unknown>);
  }, [blocked]);

  return { sendWorkoutState, sendMessage };
}
