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
