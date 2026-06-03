import { useCallback } from 'react';

/**
 * Apple Watch sync bridge.
 *
 * The companion watchOS app mirrors the active set and receives rest-timer
 * events; in return it can log a set from the wrist. Wiring that up requires a
 * native watch-connectivity module (WCSession), which is not part of this Expo
 * managed build yet — so this hook is a typed no-op that preserves the call
 * sites. When the native module lands, replace the bodies below with real
 * `sendMessage` / `applicationContext` calls and invoke `onSetLogged` from the
 * incoming-message listener.
 */

export interface WatchWorkoutState {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  suggestedReps: number;
  suggestedWeight: number;
  restDuration: number;
  isResting: boolean;
  isWorkoutComplete: boolean;
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
}

export function useWatchSync(_options: UseWatchSyncOptions = {}) {
  const sendWorkoutState = useCallback((_state: WatchWorkoutState) => {
    // no-op until native WCSession bridge is available
  }, []);

  const sendMessage = useCallback((_message: WatchMessage) => {
    // no-op until native WCSession bridge is available
  }, []);

  return { sendWorkoutState, sendMessage };
}
