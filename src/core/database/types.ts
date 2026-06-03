import { z } from 'zod';

// ── RAW ROW TYPES (SQLite columns, never leave the repository tier) ──────────

export interface ExerciseRow {
  id: number;
  name: string;
  default_rest_seconds: number;
  is_compound: number; // 0 | 1
  is_custom: number;   // 0 | 1
  target_sets: number;
}

export interface WorkoutDayRow {
  id: number;
  name: string;
}

export interface WorkoutLogRow {
  id: number;
  exercise_id: number;
  timestamp: number; // epoch ms
}

export interface WorkoutSetRow {
  id: number;
  log_id: number;
  set_order: number;
  reps: number;
  weight: number;
}

// ── DOMAIN MODELS (camelCase, real booleans — what hooks/UI consume) ─────────

export interface Exercise {
  id: number;
  name: string;
  defaultRestSeconds: number;
  isCompound: boolean;
  isCustom: boolean;
  dayTag: string | null;
  targetSets: number;
}

export interface WorkoutSet {
  setOrder: number;
  reps: number;
  weight: number;
}

export interface WorkoutLog {
  id: number;
  exerciseId: number;
  timestamp: number;
  sets: WorkoutSet[];
}

export interface WorkoutLogWithExercise extends WorkoutLog {
  exerciseName: string;
  dayTag: string | null;
}

// ── WRITE INPUTS (no id — the DB assigns it) ─────────────────────────────────

export interface ExerciseInput {
  name: string;
  defaultRestSeconds: number;
  isCompound: boolean;
  isCustom: boolean;
  dayTag?: string | null;
  /** Planned set count. Omit to leave an existing row's value untouched. */
  targetSets?: number;
}

export interface LogWorkoutInput {
  exerciseId: number;
  timestamp: number;
  sets: Array<{ reps: number; weight: number }>;
}

export interface PageOptions {
  limit: number;
  /** Cursor: return logs strictly older than this timestamp. Omit for first page. */
  beforeTimestamp?: number;
}

// ── AI IMPORT DTOs (Zod-validated at the ImportService boundary) ──────────────

export const AISetSchema = z.object({
  reps: z.number().int().positive(),
  weight: z.number().nonnegative(),
});

export const AIExerciseSchema = z.object({
  name: z.string().min(1),
  isCompound: z.boolean().default(false),
  sets: z.array(AISetSchema).min(1),
});

export const AIDaySchema = z.object({
  day: z.string().min(1),
  exercises: z.array(AIExerciseSchema).min(1),
});

export const AIImportSchema = z.array(AIDaySchema).min(1);

export type AIExerciseDTO = z.infer<typeof AIExerciseSchema>;
export type AIDayDTO = z.infer<typeof AIDaySchema>;
export type AIImportPayload = z.infer<typeof AIImportSchema>;
