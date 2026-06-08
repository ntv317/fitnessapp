import type { WorkoutLog } from '@/core/database/types';

export function est1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

export function detectPR(
  currentSets: Array<{ weight: number; reps: number }>,
  history: WorkoutLog[],
): boolean {
  if (history.length === 0) return false;
  const currentBest = Math.max(...currentSets.map((s) => est1RM(s.weight, s.reps)));
  if (currentBest <= 0) return false;
  const histBest = Math.max(
    ...history.flatMap((log) => log.sets.map((s) => est1RM(s.weight, s.reps))),
  );
  return currentBest > histBest;
}
