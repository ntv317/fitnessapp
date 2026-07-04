import type {
  BodyWeightEntry,
  Exercise,
  ExerciseInput,
  PageOptions,
  Plan,
  PlanDay,
  PlanDetail,
  PlanExerciseDetail,
  ResolvedImportPayload,
  WeeklyStats,
  WorkoutLog,
  WorkoutLogWithExercise,
} from '@/core/database/types';

/**
 * The abstraction every high-level consumer (TanStack Query hooks, screens)
 * depends on. They must NOT import expo-sqlite or the concrete class directly —
 * inject this interface so tests can substitute a mock without touching the UI.
 */
export interface IWorkoutRepository {
  getExerciseByName(name: string): Promise<Exercise | null>;
  getExerciseByCatalogId(catalogId: string): Promise<Exercise | null>;
  getAllExercises(): Promise<Exercise[]>;
  getAllDays(): Promise<{ dayTag: string; exercises: Exercise[] }[]>;
  upsertExercise(input: ExerciseInput): Promise<Exercise>;

  deleteLog(logId: number): Promise<void>;

  /** Create an empty workout log for an exercise on a given day; returns logId. */
  createLog(exerciseId: number, timestamp: number, dayTag: string | null): Promise<number>;
  /** Append a single set to an existing log and increment that day's weekly counter. */
  appendSet(logId: number, exerciseId: number, setOrder: number, reps: number, weight: number, dayTag: string | null, rpe?: number | null, note?: string | null): Promise<void>;
  /** Get today's log id for an exercise on a given day, or null if none exists. */
  getTodayLogId(exerciseId: number, dayTag: string | null): Promise<number | null>;
  /** Edit an already-logged set's values. Does not affect weekly progress. */
  updateSet(logId: number, setOrder: number, reps: number, weight: number, rpe?: number | null, note?: string | null): Promise<void>;
  /** Delete one logged set, compacting order and rolling back its weekly count. */
  deleteSet(logId: number, setOrder: number): Promise<void>;

  /** Sets logged in the given week, keyed by weeklyKey(exerciseId, dayTag). */
  getWeeklyProgress(weekStart: number): Promise<Map<string, number>>;

  /** Aggregate volume/sets/days-trained for the week starting at weekStart. */
  getWeeklyStats(weekStart: number): Promise<WeeklyStats>;

  // ── Body weight ───────────────────────────────────────────────────────────

  logBodyWeight(weightKg: number, timestamp: number): Promise<BodyWeightEntry>;
  /** Latest entries, newest first. */
  getBodyWeightHistory(limit: number): Promise<BodyWeightEntry[]>;
  deleteBodyWeight(id: number): Promise<void>;

  /** Cursor-paginated history for one exercise, newest first. */
  getHistory(exerciseId: number, options: PageOptions): Promise<WorkoutLog[]>;

  /** All recent logs across every exercise, newest first, with exercise name + day tag. */
  getAllHistory(options: PageOptions): Promise<WorkoutLogWithExercise[]>;

  /**
   * Atomically ingest a validated, catalog-resolved AI plan import.
   * The ENTIRE batch commits or rolls back — a bad row must not leave partial data.
   */
  importBatch(payload: ResolvedImportPayload, timestamp: number): Promise<void>;

  /** Delete logged sessions and weekly progress, keeping exercises, days, and plan. */
  clearHistory(): Promise<void>;

  /** Wipe every exercise, day, log, and set — a full reset to an empty database. */
  clearAllData(): Promise<void>;

  // ── Plans ─────────────────────────────────────────────────────────────────

  getPlans(): Promise<Plan[]>;
  getPlanDetail(planId: number): Promise<PlanDetail | null>;
  createPlan(name: string): Promise<Plan>;
  renamePlan(planId: number, name: string): Promise<void>;
  deletePlan(planId: number): Promise<void>;
  /** Deactivates every other plan and activates this one. */
  setActivePlan(planId: number): Promise<void>;

  addPlanDay(planId: number, name: string): Promise<PlanDay>;
  renamePlanDay(planDayId: number, name: string): Promise<void>;
  deletePlanDay(planDayId: number): Promise<void>;

  addPlanExercise(
    planDayId: number,
    exerciseId: number,
    options: { targetSets: number; repMin?: number | null; repMax?: number | null },
  ): Promise<PlanExerciseDetail>;
  updatePlanExercise(
    id: number,
    options: { targetSets?: number; repMin?: number | null; repMax?: number | null },
  ): Promise<void>;
  removePlanExercise(id: number): Promise<void>;
  reorderPlanExercises(planDayId: number, orderedIds: number[]): Promise<void>;
}
