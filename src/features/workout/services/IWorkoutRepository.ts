import type {
  AIImportPayload,
  Exercise,
  ExerciseInput,
  PageOptions,
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
  getAllExercises(): Promise<Exercise[]>;
  getExercisesByDay(dayTag: string): Promise<Exercise[]>;
  getAllDays(): Promise<{ dayTag: string; exercises: Exercise[] }[]>;
  upsertExercise(input: ExerciseInput): Promise<Exercise>;

  deleteLog(logId: number): Promise<void>;

  /** Create an empty workout log for an exercise on a given day; returns logId. */
  createLog(exerciseId: number, timestamp: number, dayTag: string | null): Promise<number>;
  /** Append a single set to an existing log and increment that day's weekly counter. */
  appendSet(logId: number, exerciseId: number, setOrder: number, reps: number, weight: number, dayTag: string | null): Promise<void>;
  /** Get today's log id for an exercise on a given day, or null if none exists. */
  getTodayLogId(exerciseId: number, dayTag: string | null): Promise<number | null>;

  /** Sets logged in the given week, keyed by weeklyKey(exerciseId, dayTag). */
  getWeeklyProgress(weekStart: number): Promise<Map<string, number>>;

  /** Cursor-paginated history for one exercise, newest first. */
  getHistory(exerciseId: number, options: PageOptions): Promise<WorkoutLog[]>;

  /** All recent logs across every exercise, newest first, with exercise name + day tag. */
  getAllHistory(options: PageOptions): Promise<WorkoutLogWithExercise[]>;

  /**
   * Atomically ingest a validated AI batch.
   * The ENTIRE batch commits or rolls back — a bad row must not leave partial data.
   */
  importBatch(payload: AIImportPayload, timestamp: number, mode: 'plan' | 'session'): Promise<void>;

  /** Wipe every exercise, day, log, and set — a full reset to an empty database. */
  clearAllData(): Promise<void>;

}
