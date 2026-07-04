/** "8-12 reps", "12 reps", or '' when no range is set. */
export function formatRepRange(repMin: number | null | undefined, repMax: number | null | undefined): string {
  const min = repMin ?? repMax;
  const max = repMax ?? repMin;
  if (min == null || max == null) return '';
  return min === max ? `${min} reps` : `${min}-${max} reps`;
}

export function clampReps(reps: number, repMin: number | null | undefined, repMax: number | null | undefined): number {
  if (repMin != null && reps < repMin) return repMin;
  if (repMax != null && reps > repMax) return repMax;
  return reps;
}
