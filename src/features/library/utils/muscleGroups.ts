const MUSCLE_TO_GROUP: Record<string, string> = {
  abdominals: 'Abs',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  traps: 'Back',
  neck: 'Back',
  biceps: 'Biceps',
  calves: 'Calf',
  chest: 'Chest',
  forearms: 'Forearms',
  quadriceps: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  abductors: 'Legs',
  adductors: 'Legs',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
};

export const GROUP_ORDER = [
  'Abs',
  'Back',
  'Biceps',
  'Calf',
  'Chest',
  'Forearms',
  'Legs',
  'Shoulders',
  'Triceps',
] as const;

export type MuscleGroup = (typeof GROUP_ORDER)[number];

/** Display group for an exercise, from its first mapped primary muscle. */
export function groupOf(primaryMuscles: string[]): MuscleGroup | null {
  for (const muscle of primaryMuscles) {
    const group = MUSCLE_TO_GROUP[muscle];
    if (group) return group as MuscleGroup;
  }
  return null;
}
