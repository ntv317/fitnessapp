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
  const histSets = history.flatMap((log) => log.sets);
  const histBest = Math.max(...histSets.map((s) => est1RM(s.weight, s.reps)));
  if (currentBest > 0 && currentBest > histBest) return true;

  // True weight PR that e1RM alone can miss (e.g. 100kg×5 after an 80kg×20
  // set scores a lower e1RM): beats the heaviest weight ever lifted for at
  // least this many reps — i.e. matched or exceeded the rep count while
  // lifting more. Only fires when a comparable prior set exists, so a rep
  // range never attempted before doesn't auto-PR.
  return currentSets.some((cur) => {
    if (cur.weight <= 0 || cur.reps <= 0) return false;
    const comparable = histSets.filter((h) => h.reps >= cur.reps);
    if (comparable.length === 0) return false;
    const priorBest = Math.max(...comparable.map((h) => h.weight));
    return cur.weight > priorBest;
  });
}
