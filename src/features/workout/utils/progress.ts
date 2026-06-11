import type { Exercise } from '@/core/database/types';

/** Safety fallback if an exercise somehow has no stored target. */
export const DEFAULT_TARGET_SETS = 3;

/**
 * Map key for day-scoped weekly progress. An exercise shared by two days
 * (e.g. a press on Push and Shoulders) tracks each day independently.
 */
export const weeklyKey = (exerciseId: number, dayTag: string | null) =>
  `${exerciseId}|${dayTag ?? ''}`;

export interface SetProgress {
  done: number;
  total: number;
  pct: number; // 0..1
  complete: boolean;
}

/**
 * Set-level progress for one day this week.
 * total = Σ each exercise's stored targetSets.
 * done  = Σ logged sets per exercise this week, capped at each exercise's target,
 *         so the count reads cleanly as 0/total … total/total.
 */
export function dayProgress(
  exercises: Exercise[],
  loggedMap: Map<string, number>,
  dayTag: string,
): SetProgress {
  let done = 0;
  let total = 0;
  for (const e of exercises) {
    const target = e.targetSets > 0 ? e.targetSets : DEFAULT_TARGET_SETS;
    total += target;
    done += Math.min(loggedMap.get(weeklyKey(e.id, dayTag)) ?? 0, target);
  }
  return {
    done,
    total,
    pct: total > 0 ? done / total : 0,
    complete: total > 0 && done >= total,
  };
}
