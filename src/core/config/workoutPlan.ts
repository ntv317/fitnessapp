export interface PlannedExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  isCompound: boolean;
}

export interface WorkoutDay {
  dayNumber: number;
  name: string;
  muscles: string[];
  color: string;
  exercises: PlannedExercise[];
}

// Kinetic Mono accent set — on-palette, one per training day.
export const DAY_COLORS: Record<number, string> = {
  1: '#a83300', // Mon PUSH       - primary brick
  2: '#0058bc', // Tue PULL       - secondary blue
  3: '#006b27', // Wed LEGS       - tertiary green
  4: '#b3560a', // Thu SHOULDERS  - warm amber
  5: '#6d4faf', // Fri BACK+ARMS  - muted violet
};

export const WEEKLY_PLAN: Record<number, WorkoutDay | null> = {
  0: null, // Sun
  1: {
    dayNumber: 1,
    name: 'PUSH',
    muscles: ['Chest', 'Side Delts', 'Triceps'],
    color: DAY_COLORS[1],
    exercises: [
      { name: 'Flat Dumbbell Press',        sets: 3, repsMin: 8,  repsMax: 12, isCompound: true },
      { name: 'Machine Chest Press',        sets: 3, repsMin: 8,  repsMax: 12, isCompound: true },
      { name: 'Cable Chest Fly',            sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
      { name: 'Dumbbell Lateral Raise',     sets: 4, repsMin: 12, repsMax: 20, isCompound: false },
      { name: 'Cable Lateral Raise',        sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
      { name: 'Overhead Rope Tricep Ext.',  sets: 3, repsMin: 10, repsMax: 15, isCompound: false },
      { name: 'Rope Pushdown',              sets: 3, repsMin: 10, repsMax: 15, isCompound: false },
    ],
  },
  2: {
    dayNumber: 2,
    name: 'PULL',
    muscles: ['Back', 'Rear Delts', 'Biceps'],
    color: DAY_COLORS[2],
    exercises: [
      { name: 'Wide Grip Lat Pulldown',     sets: 3, repsMin: 8,  repsMax: 12, isCompound: true },
      { name: 'Chest Supported Row',        sets: 3, repsMin: 8,  repsMax: 12, isCompound: true },
      { name: 'Seated Cable Row',           sets: 3, repsMin: 10, repsMax: 14, isCompound: true },
      { name: 'Straight Arm Pulldown',      sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
      { name: 'Rear Delt Fly',              sets: 3, repsMin: 15, repsMax: 20, isCompound: false },
      { name: 'EZ Bar Curl',               sets: 3, repsMin: 10, repsMax: 14, isCompound: false },
      { name: 'Hammer Curl',               sets: 3, repsMin: 10, repsMax: 14, isCompound: false },
    ],
  },
  3: {
    dayNumber: 3,
    name: 'LEGS',
    muscles: ['Quads', 'Hamstrings', 'Calves', 'Abs'],
    color: DAY_COLORS[3],
    exercises: [
      { name: 'Hack Squat',                sets: 4, repsMin: 6,  repsMax: 10, isCompound: true },
      { name: 'Leg Press',                 sets: 3, repsMin: 10, repsMax: 15, isCompound: true },
      { name: 'Romanian Deadlift',         sets: 3, repsMin: 8,  repsMax: 12, isCompound: true },
      { name: 'Leg Curl',                  sets: 3, repsMin: 10, repsMax: 15, isCompound: false },
      { name: 'Standing Calf Raise',       sets: 4, repsMin: 15, repsMax: 20, isCompound: false },
      { name: 'Hanging Leg Raise',         sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
      { name: 'Cable Crunch',              sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
    ],
  },
  4: {
    dayNumber: 4,
    name: 'SHOULDERS',
    muscles: ['Shoulders', 'Chest'],
    color: DAY_COLORS[4],
    exercises: [
      { name: 'Seated DB Shoulder Press',  sets: 4, repsMin: 6,  repsMax: 10, isCompound: true },
      { name: 'Dumbbell Lateral Raise',    sets: 4, repsMin: 12, repsMax: 20, isCompound: false },
      { name: 'Cable Lateral Raise',       sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
      { name: 'Rear Delt Fly',             sets: 3, repsMin: 15, repsMax: 20, isCompound: false },
      { name: 'Machine Chest Press',       sets: 3, repsMin: 10, repsMax: 14, isCompound: true },
      { name: 'Cable Chest Fly',           sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
    ],
  },
  5: {
    dayNumber: 5,
    name: 'BACK + ARMS',
    muscles: ['Back', 'Biceps', 'Triceps'],
    color: DAY_COLORS[5],
    exercises: [
      { name: 'Wide Grip Lat Pulldown',         sets: 3, repsMin: 8,  repsMax: 12, isCompound: true },
      { name: 'Single Arm Cable Lat Row',       sets: 3, repsMin: 10, repsMax: 14, isCompound: true },
      { name: 'Straight Arm Pulldown',          sets: 3, repsMin: 12, repsMax: 15, isCompound: false },
      { name: 'Rope Pushdown',                  sets: 3, repsMin: 10, repsMax: 15, isCompound: false },
      { name: 'Overhead Rope Tricep Extension', sets: 3, repsMin: 10, repsMax: 15, isCompound: false },
      { name: 'Cable Curl',                     sets: 3, repsMin: 10, repsMax: 14, isCompound: false },
      { name: 'Hammer Curl',                    sets: 3, repsMin: 10, repsMax: 14, isCompound: false },
    ],
  },
  6: null, // Sat
};
