import { requireOptionalNativeModule } from 'expo-modules-core';

export interface WatchSetLoggedPayload {
  reps: number;
  weight: number; // kg
  setOrder: number;
}

export interface WatchSyncNativeModule {
  updateState(state: Record<string, unknown>): void;
  sendMessage(message: Record<string, unknown>): void;
  isReachable(): boolean;
  addListener(
    event: 'onSetLogged',
    listener: (payload: WatchSetLoggedPayload) => void,
  ): { remove: () => void };
  addListener(event: 'onFinishWorkout', listener: () => void): { remove: () => void };
}

// Optional: returns null on platforms/builds where the native module isn't present
// (e.g. Android, or before the native module is built), so callers degrade gracefully.
const WatchSync = requireOptionalNativeModule<WatchSyncNativeModule>('WatchSync');

export default WatchSync;
