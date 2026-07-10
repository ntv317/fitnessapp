import { z } from 'zod';

// ── RAW ROW TYPES (SQLite columns, never leave the repository tier) ──────────

export interface ExerciseRow {
  id: number;
  name: string;
  default_rest_seconds: number;
  is_compound: number; // 0 | 1
  is_custom: number;   // 0 | 1
  target_sets: number;
  catalog_id: string | null;
  muscle_group: string | null;
  secondary_muscle_groups: string | null;
  instructions: string | null;
  image_uris: string | null;
}

export interface PlanRow {
  id: number;
  name: string;
  is_active: number; // 0 | 1
  created_at: number;
}

export interface PlanDayRow {
  id: number;
  plan_id: number;
  name: string;
  sort_order: number;
}

export interface PlanExerciseRow {
  id: number;
  plan_day_id: number;
  exercise_id: number;
  sort_order: number;
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
}

export interface WorkoutLogRow {
  id: number;
  exercise_id: number;
  timestamp: number; // epoch ms
  day_tag: string | null;
}

export interface WorkoutSetRow {
  id: number;
  log_id: number;
  set_order: number;
  reps: number;
  weight: number;
  rpe: number | null;
  note: string | null;
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
  catalogId: string | null;
  muscleGroup: string | null;
  /** Additional worked muscle groups beyond the primary `muscleGroup`. Display metadata only. */
  secondaryMuscleGroups: string[] | null;
  instructions: string[] | null;
  imageUris: string[] | null;
  /** Active plan's rep range for this exercise; null outside a plan context. */
  repMin: number | null;
  repMax: number | null;
}

export interface WorkoutSet {
  setOrder: number;
  reps: number;
  weight: number;
  rpe: number | null;
  note: string | null;
}

export interface WorkoutLog {
  id: number;
  exerciseId: number;
  timestamp: number;
  dayTag: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutLogWithExercise extends WorkoutLog {
  exerciseName: string;
}

export interface Plan {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: number;
}

export interface PlanDay {
  id: number;
  planId: number;
  name: string;
  sortOrder: number;
}

export interface PlanExerciseDetail {
  id: number;
  exerciseId: number;
  exerciseName: string;
  sortOrder: number;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
}

export interface PlanDayDetail extends PlanDay {
  exercises: PlanExerciseDetail[];
}

export interface PlanDetail extends Plan {
  days: PlanDayDetail[];
}

// ── WRITE INPUTS (no id — the DB assigns it) ─────────────────────────────────

export interface ExerciseInput {
  name: string;
  defaultRestSeconds: number;
  isCompound: boolean;
  isCustom: boolean;
  /** Planned set count. Omit to leave an existing row's value untouched. */
  targetSets?: number;
  /** Bundled catalog link. Omit to leave an existing row's value untouched. */
  catalogId?: string | null;
  /** Library display group for uncataloged exercises. Omit to leave an existing row's value untouched. */
  muscleGroup?: string | null;
  /**
   * When true and an exercise with this name already exists, keep its current
   * defaultRestSeconds/isCompound instead of overwriting them with the values
   * passed here. Use this when linking a catalog/library pick to a possibly
   * already-customized exercise; leave false for a genuine re-import.
   */
  keepExistingSettings?: boolean;
}

/** Thrown when a create/update would collide with another exercise's name (case/punctuation-insensitive). */
export class NameTakenError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists.`);
    this.name = 'NameTakenError';
  }
}

export interface CustomExerciseInput {
  name: string;
  isCompound: boolean;
  targetSets?: number;
  muscleGroup?: string | null;
  secondaryMuscleGroups?: string[] | null;
  instructions?: string[] | null;
  imageFilenames?: string[] | null;
}

/** Partial edit applied by updateExercise / createOrUpdateCatalogOverride — only provided fields are written. */
export interface ExercisePatch {
  name?: string;
  isCompound?: boolean;
  targetSets?: number;
  muscleGroup?: string | null;
  secondaryMuscleGroups?: string[] | null;
  instructions?: string[] | null;
  imageFilenames?: string[] | null;
}

export interface BodyWeightEntry {
  id: number;
  timestamp: number;
  weightKg: number;
}

export interface WeeklyStats {
  volumeKg: number;
  totalSets: number;
  daysTrained: number;
}

export interface PageOptions {
  limit: number;
  /** Cursor: return logs strictly older than this timestamp. Omit for first page. */
  beforeTimestamp?: number;
}

// ── AI IMPORT DTOs (Zod-validated at the ImportService boundary) ──────────────

// Upper bounds guard against pathological pastes — an unbounded "name" or
// sets value lands directly in the DB and progress denominators otherwise.
export const AIExerciseSchema = z
  .object({
    name: z.string().min(1).max(80),
    isCompound: z.boolean().default(false),
    // Number of working sets — becomes the per-plan target set count.
    sets: z.number().int().positive().max(20),
    repMin: z.number().int().positive().max(100).optional(),
    repMax: z.number().int().positive().max(100).optional(),
    // Legacy alias: a single "reps" value maps to repMin = repMax = reps.
    reps: z.number().int().positive().max(100).optional(),
    // Free-form here; resolved against the library's group list at import time.
    muscleGroup: z.string().max(40).optional(),
  })
  .refine((e) => e.repMin == null || e.repMax == null || e.repMin <= e.repMax, {
    message: 'repMin must be <= repMax',
  });

export const AIDaySchema = z.object({
  day: z.string().min(1).max(40),
  exercises: z.array(AIExerciseSchema).min(1).max(30),
});

export const AIImportSchema = z.array(AIDaySchema).min(1).max(14);

export type AIExerciseDTO = z.infer<typeof AIExerciseSchema>;
export type AIDayDTO = z.infer<typeof AIDaySchema>;
export type AIImportPayload = z.infer<typeof AIImportSchema>;

// After catalog matching + group/rep-range normalization (ImportService tier) —
// what importBatch actually persists.
export interface ResolvedImportExercise {
  name: string;
  isCompound: boolean;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  muscleGroup: string | null;
  catalogId: string | null;
}

export interface ResolvedImportDay {
  day: string;
  exercises: ResolvedImportExercise[];
}

export type ResolvedImportPayload = ResolvedImportDay[];
