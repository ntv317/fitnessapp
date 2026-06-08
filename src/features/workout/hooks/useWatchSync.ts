import { useCallback, useEffect, useRef } from 'react';
import WatchSync from '../../../../modules/watch-sync';

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
}

export function useWatchSync(options: UseWatchSyncOptions = {}) {
  const { onSetLogged, onSkipRest } = options;

  // Keep the latest callbacks in refs so the listeners don't churn.
  const onSetLoggedRef = useRef(onSetLogged);
  onSetLoggedRef.current = onSetLogged;
  const onSkipRestRef = useRef(onSkipRest);
  onSkipRestRef.current = onSkipRest;

  useEffect(() => {
    if (!WatchSync) return;
    const setSub = WatchSync.addListener('onSetLogged', (payload: WatchSetLogged) => {
      onSetLoggedRef.current?.(payload);
    });
    const skipSub = WatchSync.addListener('onSkipRest', () => {
      onSkipRestRef.current?.();
    });
    return () => {
      setSub.remove();
      skipSub.remove();
    };
  }, []);

  const sendWorkoutState = useCallback((state: WatchWorkoutState) => {
    WatchSync?.updateState(state as unknown as Record<string, unknown>);
  }, []);

  const sendMessage = useCallback((message: WatchMessage) => {
    WatchSync?.sendMessage(message as Record<string, unknown>);
  }, []);

  return { sendWorkoutState, sendMessage };
}
