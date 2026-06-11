import { requireOptionalNativeModule } from 'expo-modules-core';

interface LiveActivityNativeModule {
  startRestActivity(
    exerciseName: string,
    setNumber: number,
    totalSets: number,
    endTimestampMs: number,
    accentHex: string,
  ): void;
  updateRestActivity(endTimestampMs: number): void;
  stopRestActivity(): void;
}

// Optional: null on platforms/builds without the native module, so callers
// degrade gracefully (e.g. Android, Expo Go).
const LiveActivity = requireOptionalNativeModule<LiveActivityNativeModule>('LiveActivity');

export function startRestActivity(
  exerciseName: string,
  setNumber: number,
  totalSets: number,
  endTimestampMs: number,
  accentHex: string,
) {
  LiveActivity?.startRestActivity(exerciseName, setNumber, totalSets, endTimestampMs, accentHex);
}

export function updateRestActivity(endTimestampMs: number) {
  LiveActivity?.updateRestActivity(endTimestampMs);
}

export function stopRestActivity() {
  LiveActivity?.stopRestActivity();
}
