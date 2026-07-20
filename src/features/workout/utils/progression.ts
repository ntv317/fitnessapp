export interface SetLike {
  reps: number;
  weight: number; // kg
}

export interface ProgressionSuggestion {
  weightKg: number;
  reps: number;
  /** True when the last session earned a weight increase (double progression). */
  increased: boolean;
}

/**
 * The session's top set: heaviest, ties broken by the higher rep count.
 * Weight and reps come from the same set, so callers never pair a heaviest
 * weight with another set's easier reps. Ignores warmup/blank rows (weight or
 * reps of 0). Returns null when nothing qualifies.
 */
export function bestSet<T extends SetLike>(sets: T[]): T | null {
  const working = sets.filter((s) => s.weight > 0 && s.reps > 0);
  if (working.length === 0) return null;
  return working.reduce((best, s) =>
    s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best,
  );
}

/**
 * Double progression on the last session's working sets:
 * every set at or above repMax → add one increment and restart at repMin;
 * otherwise repeat the top weight aiming one rep higher (capped at repMax).
 */
export function suggestProgression(
  lastSets: SetLike[],
  repMin: number | null | undefined,
  repMax: number | null | undefined,
  incrementKg: number,
): ProgressionSuggestion | null {
  const working = lastSets.filter((s) => s.weight > 0 && s.reps > 0);
  if (working.length === 0) return null;

  const min = repMin ?? 8;
  const max = repMax ?? 12;
  const topWeight = Math.max(...working.map((s) => s.weight));
  const topWeightSets = working.filter((s) => s.weight === topWeight);

  if (topWeightSets.every((s) => s.reps >= max)) {
    return { weightKg: topWeight + incrementKg, reps: min, increased: true };
  }

  const lowestReps = Math.min(...topWeightSets.map((s) => s.reps));
  return { weightKg: topWeight, reps: Math.min(lowestReps + 1, max), increased: false };
}
