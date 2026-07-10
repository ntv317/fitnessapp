import type { SQLiteDatabase } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { getTableColumns, sql, eq, asc } from 'drizzle-orm';
import * as schema from '@/core/database/schema';
import { exercises, planDays, planExercises, plans } from '@/core/database/schema';
import type { IWorkoutRepository } from './IWorkoutRepository';
import type {
  BodyWeightEntry,
  CustomExerciseInput,
  Exercise,
  ExerciseInput,
  ExercisePatch,
  ExerciseRow,
  Plan,
  PlanDay,
  PlanDetail,
  PlanDayDetail,
  PlanDayRow,
  PlanExerciseDetail,
  PlanExerciseRow,
  PlanRow,
  PageOptions,
  ResolvedImportPayload,
  WeeklyStats,
  WorkoutLog,
  WorkoutLogRow,
  WorkoutLogWithExercise,
  WorkoutSetRow,
} from '@/core/database/types';
import { weekStartOf } from '@/core/utils/date';
import { weeklyKey } from '../utils/progress';
import { normalizeName } from '@/features/import/services/catalogMatch';
import { NameTakenError } from '@/core/database/types';

type ExerciseWithDay = ExerciseRow & {
  day_tag: string | null;
  plan_target_sets?: number | null;
  rep_min?: number | null;
  rep_max?: number | null;
};

/**
 * The ONLY place raw SQL and expo-sqlite live (Single Responsibility).
 * All methods use the async API — no *Sync calls, no legacy callbacks.
 */
export class WorkoutRepository implements IWorkoutRepository {
  // Drizzle wraps the SAME connection as `db` (shared underlying handle), so
  // builder queries and the raw `db` handle interleave safely. Reads and
  // single-statement writes go through `orm`; multi-statement transactions stay
  // on the raw async `db` (see IWorkoutRepository / migration plan).
  private readonly orm: ExpoSQLiteDatabase<typeof schema>;

  constructor(private readonly db: SQLiteDatabase) {
    this.orm = drizzle(db, { schema });
  }

  // Correlated subquery that resolves the active plan's day name for an
  // exercise aliased "e" (an exercise can appear on only one day per plan).
  private static readonly DAY_TAG_SQL = `(
    SELECT pd.name
    FROM PlanExercises pe
    JOIN PlanDays pd ON pd.id = pe.plan_day_id
    JOIN Plans p ON p.id = pd.plan_id AND p.is_active = 1
    WHERE pe.exercise_id = e.id
    ORDER BY pd.sort_order ASC, pe.sort_order ASC
    LIMIT 1
  )`;

  // Drizzle-select form of DAY_TAG_SQL, correlated on the outer Exercises row.
  // The correlation is written as the fully-qualified `"Exercises"."id"` on
  // purpose: in a single-table SELECT Drizzle renders columns unqualified, so a
  // `${exercises.id}` placeholder would collapse to a bare `"id"` that SQLite
  // reads as ambiguous against the subquery's own PlanExercises/PlanDays/Plans
  // id columns. `.from(exercises)` always renders the table as "Exercises".
  private static readonly DAY_TAG_COLUMN = sql<string | null>`(
    SELECT pd.name
    FROM PlanExercises pe
    JOIN PlanDays pd ON pd.id = pe.plan_day_id
    JOIN Plans p ON p.id = pd.plan_id AND p.is_active = 1
    WHERE pe.exercise_id = "Exercises"."id"
    ORDER BY pd.sort_order ASC, pe.sort_order ASC
    LIMIT 1
  )`;

  // ── Mappers ──────────────────────────────────────────────────────────────

  // plan_target_sets (when present) overrides the exercise's own target_sets —
  // the same exercise can have a different planned set count per plan/day.
  private static toExercise(row: ExerciseWithDay): Exercise {
    let instructions: string[] | null = null;
    try {
      instructions = row.instructions ? JSON.parse(row.instructions) : null;
    } catch {
      instructions = null;
    }
    let imageUris: string[] | null = null;
    try {
      imageUris = row.image_uris ? JSON.parse(row.image_uris) : null;
    } catch {
      imageUris = null;
    }
    let secondaryMuscleGroups: string[] | null = null;
    try {
      secondaryMuscleGroups = row.secondary_muscle_groups ? JSON.parse(row.secondary_muscle_groups) : null;
    } catch {
      secondaryMuscleGroups = null;
    }
    return {
      id: row.id,
      name: row.name,
      defaultRestSeconds: row.default_rest_seconds,
      isCompound: row.is_compound === 1,
      isCustom: row.is_custom === 1,
      dayTag: row.day_tag ?? null,
      targetSets: row.plan_target_sets ?? row.target_sets,
      catalogId: row.catalog_id ?? null,
      muscleGroup: row.muscle_group ?? null,
      secondaryMuscleGroups,
      instructions,
      imageUris,
      repMin: row.rep_min ?? null,
      repMax: row.rep_max ?? null,
    };
  }

  // ── Exercises ─────────────────────────────────────────────────────────────

  async getExerciseByName(name: string): Promise<Exercise | null> {
    const row = await this.orm
      .select({ ...getTableColumns(exercises), day_tag: WorkoutRepository.DAY_TAG_COLUMN })
      .from(exercises)
      .where(eq(exercises.name, name))
      .get();
    return row ? WorkoutRepository.toExercise(row) : null;
  }

  async getExerciseByCatalogId(catalogId: string): Promise<Exercise | null> {
    const row = await this.orm
      .select({ ...getTableColumns(exercises), day_tag: WorkoutRepository.DAY_TAG_COLUMN })
      .from(exercises)
      .where(eq(exercises.catalog_id, catalogId))
      .get();
    return row ? WorkoutRepository.toExercise(row) : null;
  }

  async getExerciseById(id: number): Promise<Exercise | null> {
    const row = await this.orm
      .select({ ...getTableColumns(exercises), day_tag: WorkoutRepository.DAY_TAG_COLUMN })
      .from(exercises)
      .where(eq(exercises.id, id))
      .get();
    return row ? WorkoutRepository.toExercise(row) : null;
  }

  async getAllExercises(): Promise<Exercise[]> {
    const rows = await this.orm
      .select({ ...getTableColumns(exercises), day_tag: WorkoutRepository.DAY_TAG_COLUMN })
      .from(exercises)
      .orderBy(asc(exercises.name));
    return rows.map(WorkoutRepository.toExercise);
  }

  async getAllDays(): Promise<{ dayTag: string; exercises: Exercise[] }[]> {
    const rows = await this.orm
      .select({
        ...getTableColumns(exercises),
        day_name: planDays.name,
        plan_target_sets: planExercises.target_sets,
        rep_min: planExercises.rep_min,
        rep_max: planExercises.rep_max,
      })
      .from(plans)
      .innerJoin(planDays, eq(planDays.plan_id, plans.id))
      .innerJoin(planExercises, eq(planExercises.plan_day_id, planDays.id))
      .innerJoin(exercises, eq(exercises.id, planExercises.exercise_id))
      .where(eq(plans.is_active, 1))
      .orderBy(asc(planDays.sort_order), asc(planExercises.sort_order), asc(exercises.id));
    const map = new Map<string, Exercise[]>();
    for (const row of rows) {
      const tag = row.day_name;
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(WorkoutRepository.toExercise({ ...row, day_tag: tag }));
    }
    return Array.from(map.entries()).map(([dayTag, exercises]) => ({ dayTag, exercises }));
  }

  async upsertExercise(input: ExerciseInput): Promise<Exercise> {
    const REST_COMPOUND = 150;
    const REST_ISOLATION = 75;
    const restSeconds =
      input.defaultRestSeconds ??
      (input.isCompound ? REST_COMPOUND : REST_ISOLATION);

    const patchedInput = { ...input, defaultRestSeconds: restSeconds };

    // target_sets: insert the given value (or fall back to 3); on conflict only
    // overwrite when a value was explicitly provided, else keep the existing one.
    const target = input.targetSets ?? null;
    const catalogId = input.catalogId ?? null;
    const muscleGroup = input.muscleGroup ?? null;
    // Linking a catalog/library pick to an already-existing exercise (matched by
    // name) must not clobber a rest time or compound flag the user already
    // customized — only a genuine re-import (e.g. AI import correcting a
    // categorization) should overwrite those.
    const keepExisting = input.keepExistingSettings ? 1 : 0;
    const row = await this.db.getFirstAsync<ExerciseRow>(
      `INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom, target_sets, catalog_id, muscle_group)
       VALUES (?, ?, ?, ?, COALESCE(?, 3), ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         default_rest_seconds = CASE WHEN ? THEN Exercises.default_rest_seconds ELSE excluded.default_rest_seconds END,
         is_compound          = CASE WHEN ? THEN Exercises.is_compound ELSE excluded.is_compound END,
         is_custom            = CASE WHEN ? THEN Exercises.is_custom ELSE excluded.is_custom END,
         target_sets          = COALESCE(?, Exercises.target_sets),
         catalog_id           = COALESCE(?, Exercises.catalog_id),
         muscle_group         = COALESCE(?, Exercises.muscle_group)
       RETURNING *;`,
      [
        patchedInput.name,
        patchedInput.defaultRestSeconds,
        patchedInput.isCompound ? 1 : 0,
        patchedInput.isCustom ? 1 : 0,
        target,
        catalogId,
        muscleGroup,
        keepExisting,
        keepExisting,
        keepExisting,
        target,
        catalogId,
        muscleGroup,
      ],
    );
    if (!row) throw new Error(`upsertExercise failed for "${input.name}"`);

    // Plan membership (which day, if any) is managed explicitly via
    // addPlanExercise — not implied by this call.
    const dayRow = await this.db.getFirstAsync<{ day_tag: string | null }>(
      `SELECT ${WorkoutRepository.DAY_TAG_SQL} AS day_tag FROM Exercises e WHERE e.id = ?;`,
      [row.id],
    );
    return WorkoutRepository.toExercise({ ...row, day_tag: dayRow?.day_tag ?? null });
  }

  // expo-sqlite doesn't expose a structured constraint code to JS (see
  // Exceptions.swift/SQLExceptions.kt) — only a message string containing the
  // raw sqlite errmsg — so a UNIQUE violation can only be detected by substring.
  private static isUniqueViolation(err: unknown): boolean {
    return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
  }

  private async insertExercise(params: {
    name: string;
    isCompound: boolean;
    targetSets?: number;
    catalogId: string | null;
    muscleGroup?: string | null;
    secondaryMuscleGroups?: string[] | null;
    instructions?: string[] | null;
    imageFilenames?: string[] | null;
  }): Promise<number> {
    const REST_COMPOUND = 150;
    const REST_ISOLATION = 75;
    const instructions = params.instructions ? JSON.stringify(params.instructions) : null;
    const imageUris = params.imageFilenames ? JSON.stringify(params.imageFilenames) : null;
    const secondary =
      params.secondaryMuscleGroups && params.secondaryMuscleGroups.length > 0
        ? JSON.stringify(params.secondaryMuscleGroups)
        : null;
    try {
      const result = await this.db.runAsync(
        `INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom, target_sets, catalog_id, muscle_group, secondary_muscle_groups, instructions, image_uris)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?);`,
        [
          params.name,
          params.isCompound ? REST_COMPOUND : REST_ISOLATION,
          params.isCompound ? 1 : 0,
          params.targetSets ?? 3,
          params.catalogId,
          params.muscleGroup ?? null,
          secondary,
          instructions,
          imageUris,
        ],
      );
      return result.lastInsertRowId;
    } catch (e) {
      if (WorkoutRepository.isUniqueViolation(e)) throw new NameTakenError(params.name);
      throw e;
    }
  }

  async checkNameAvailable(name: string, excludeId?: number): Promise<boolean> {
    const normalized = normalizeName(name);
    const rows = await this.db.getAllAsync<{ id: number; name: string }>(
      excludeId != null ? 'SELECT id, name FROM Exercises WHERE id != ?;' : 'SELECT id, name FROM Exercises;',
      excludeId != null ? [excludeId] : [],
    );
    return !rows.some((r) => normalizeName(r.name) === normalized);
  }

  async createCustomExercise(input: CustomExerciseInput): Promise<Exercise> {
    const id = await this.insertExercise({
      name: input.name,
      isCompound: input.isCompound,
      targetSets: input.targetSets,
      catalogId: null,
      muscleGroup: input.muscleGroup,
      secondaryMuscleGroups: input.secondaryMuscleGroups,
      instructions: input.instructions,
      imageFilenames: input.imageFilenames,
    });
    const exercise = await this.getExerciseById(id);
    if (!exercise) throw new Error(`createCustomExercise failed for "${input.name}"`);
    return exercise;
  }

  async updateExercise(id: number, patch: ExercisePatch): Promise<Exercise> {
    const sets: string[] = ['is_custom = 1'];
    const params: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      sets.push('name = ?');
      params.push(patch.name);
    }
    if (patch.isCompound !== undefined) {
      sets.push('is_compound = ?');
      params.push(patch.isCompound ? 1 : 0);
    }
    if (patch.targetSets !== undefined) {
      sets.push('target_sets = ?');
      params.push(patch.targetSets);
    }
    if (patch.muscleGroup !== undefined) {
      sets.push('muscle_group = ?');
      params.push(patch.muscleGroup);
    }
    if (patch.secondaryMuscleGroups !== undefined) {
      sets.push('secondary_muscle_groups = ?');
      params.push(
        patch.secondaryMuscleGroups && patch.secondaryMuscleGroups.length > 0
          ? JSON.stringify(patch.secondaryMuscleGroups)
          : null,
      );
    }
    if (patch.instructions !== undefined) {
      sets.push('instructions = ?');
      params.push(patch.instructions ? JSON.stringify(patch.instructions) : null);
    }
    if (patch.imageFilenames !== undefined) {
      sets.push('image_uris = ?');
      params.push(patch.imageFilenames ? JSON.stringify(patch.imageFilenames) : null);
    }
    params.push(id);
    try {
      await this.db.runAsync(`UPDATE Exercises SET ${sets.join(', ')} WHERE id = ?;`, params);
    } catch (e) {
      if (WorkoutRepository.isUniqueViolation(e)) throw new NameTakenError(patch.name ?? '');
      throw e;
    }
    const exercise = await this.getExerciseById(id);
    if (!exercise) throw new Error(`updateExercise failed for id ${id}`);
    return exercise;
  }

  async createOrUpdateCatalogOverride(catalogId: string, patch: ExercisePatch): Promise<Exercise> {
    const existing = await this.getExerciseByCatalogId(catalogId);
    if (existing) return this.updateExercise(existing.id, patch);

    if (!patch.name) throw new Error('createOrUpdateCatalogOverride requires a name to materialize a new row');
    const id = await this.insertExercise({
      name: patch.name,
      isCompound: patch.isCompound ?? false,
      targetSets: patch.targetSets,
      catalogId,
      muscleGroup: patch.muscleGroup,
      secondaryMuscleGroups: patch.secondaryMuscleGroups,
      instructions: patch.instructions,
      imageFilenames: patch.imageFilenames,
    });
    const exercise = await this.getExerciseById(id);
    if (!exercise) throw new Error(`createOrUpdateCatalogOverride failed for catalogId "${catalogId}"`);
    return exercise;
  }

  async resetExerciseOverride(
    id: number,
    canonical: { name: string; isCompound: boolean; muscleGroup: string | null },
  ): Promise<Exercise> {
    try {
      await this.db.runAsync(
        `UPDATE Exercises SET
           name = ?, is_compound = ?, muscle_group = ?,
           secondary_muscle_groups = NULL, instructions = NULL, image_uris = NULL, is_custom = 0
         WHERE id = ?;`,
        [canonical.name, canonical.isCompound ? 1 : 0, canonical.muscleGroup, id],
      );
    } catch (e) {
      if (WorkoutRepository.isUniqueViolation(e)) throw new NameTakenError(canonical.name);
      throw e;
    }
    const exercise = await this.getExerciseById(id);
    if (!exercise) throw new Error(`resetExerciseOverride failed for id ${id}`);
    return exercise;
  }

  async deleteCustomExercise(id: number): Promise<{ blocked: boolean; reason?: 'logged' | 'planned' }> {
    const logged = await this.db.getFirstAsync<{ one: number }>(
      'SELECT 1 AS one FROM WorkoutLogs WHERE exercise_id = ? LIMIT 1;',
      [id],
    );
    if (logged) return { blocked: true, reason: 'logged' };

    const planned = await this.db.getFirstAsync<{ one: number }>(
      'SELECT 1 AS one FROM PlanExercises WHERE exercise_id = ? LIMIT 1;',
      [id],
    );
    if (planned) return { blocked: true, reason: 'planned' };

    await this.db.runAsync('DELETE FROM Exercises WHERE id = ?;', [id]);
    return { blocked: false };
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  async deleteLog(logId: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const log = await this.db.getFirstAsync<{ exercise_id: number; day_tag: string | null; timestamp: number }>(
        'SELECT exercise_id, day_tag, timestamp FROM WorkoutLogs WHERE id = ?;',
        [logId],
      );
      if (!log) return;
      const { count } = (await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM WorkoutSets WHERE log_id = ?;',
        [logId],
      ))!;
      await this.db.runAsync('DELETE FROM WorkoutLogs WHERE id = ?;', [logId]);
      if (count > 0) {
        const ws = weekStartOf(log.timestamp);
        await this.db.runAsync(
          `UPDATE WeeklyProgress SET sets_done = MAX(0, sets_done - ?)
           WHERE exercise_id = ? AND day_tag = ? AND week_start = ?;`,
          [count, log.exercise_id, log.day_tag ?? '', ws],
        );
      }
    });
  }

  async createLog(exerciseId: number, timestamp: number, dayTag: string | null): Promise<number> {
    const result = await this.db.runAsync(
      'INSERT INTO WorkoutLogs (exercise_id, timestamp, day_tag) VALUES (?, ?, ?);',
      [exerciseId, timestamp, dayTag],
    );
    return result.lastInsertRowId;
  }

  async appendSet(
    logId: number,
    exerciseId: number,
    setOrder: number,
    reps: number,
    weight: number,
    dayTag: string | null,
    rpe: number | null = null,
    note: string | null = null,
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const existing = await this.db.getFirstAsync<{ one: number }>(
        'SELECT 1 AS one FROM WorkoutSets WHERE log_id = ? AND set_order = ?;',
        [logId, setOrder],
      );
      await this.db.runAsync(
        `INSERT INTO WorkoutSets (log_id, set_order, reps, weight, rpe, note) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(log_id, set_order) DO UPDATE SET
           reps = excluded.reps, weight = excluded.weight, rpe = excluded.rpe, note = excluded.note;`,
        [logId, setOrder, reps, weight, rpe, note],
      );
      if (!existing) {
        // Credit the week of the log, not of "now" — deleteSet/deleteLog
        // decrement by log week, so a set appended minutes after a week
        // rollover must land in the same bucket it will be removed from.
        const log = await this.db.getFirstAsync<{ timestamp: number }>(
          'SELECT timestamp FROM WorkoutLogs WHERE id = ?;',
          [logId],
        );
        const weekStart = weekStartOf(log?.timestamp ?? Date.now());
        await this.db.runAsync(
          `INSERT INTO WeeklyProgress (exercise_id, day_tag, week_start, sets_done) VALUES (?, ?, ?, 1)
           ON CONFLICT(exercise_id, day_tag, week_start) DO UPDATE SET sets_done = sets_done + 1;`,
          [exerciseId, dayTag ?? '', weekStart],
        );
      }
    });
  }

  /** Edit an already-logged set's values. Does not touch WeeklyProgress — the set count is unchanged. */
  async updateSet(
    logId: number,
    setOrder: number,
    reps: number,
    weight: number,
    rpe: number | null = null,
    note: string | null = null,
  ): Promise<void> {
    await this.db.runAsync(
      'UPDATE WorkoutSets SET reps = ?, weight = ?, rpe = ?, note = ? WHERE log_id = ? AND set_order = ?;',
      [reps, weight, rpe, note, logId, setOrder],
    );
  }

  /** Delete one logged set, compact ordering, and roll back its weekly count. Deletes the log if it's now empty. */
  async deleteSet(logId: number, setOrder: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const log = await this.db.getFirstAsync<{ exercise_id: number; day_tag: string | null; timestamp: number }>(
        'SELECT exercise_id, day_tag, timestamp FROM WorkoutLogs WHERE id = ?;',
        [logId],
      );
      if (!log) return;

      await this.db.runAsync(
        'DELETE FROM WorkoutSets WHERE log_id = ? AND set_order = ?;',
        [logId, setOrder],
      );
      // Two-phase shift avoids colliding with UNIQUE(log_id, set_order): SQLite's
      // UPDATE has no ORDER BY, so a single pass can't safely guarantee it visits
      // rows in ascending order. Negative values never overlap the remaining
      // positive range, so this is correct regardless of row-processing order.
      await this.db.runAsync(
        `UPDATE WorkoutSets SET set_order = -(set_order - 1)
         WHERE log_id = ? AND set_order > ?;`,
        [logId, setOrder],
      );
      await this.db.runAsync(
        `UPDATE WorkoutSets SET set_order = -set_order
         WHERE log_id = ? AND set_order < 0;`,
        [logId],
      );

      const ws = weekStartOf(log.timestamp);
      await this.db.runAsync(
        `UPDATE WeeklyProgress SET sets_done = MAX(0, sets_done - 1)
         WHERE exercise_id = ? AND day_tag = ? AND week_start = ?;`,
        [log.exercise_id, log.day_tag ?? '', ws],
      );

      const { count } = (await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM WorkoutSets WHERE log_id = ?;',
        [logId],
      ))!;
      if (count === 0) {
        await this.db.runAsync('DELETE FROM WorkoutLogs WHERE id = ?;', [logId]);
      }
    });
  }

  async getWeeklyProgress(weekStart: number): Promise<Map<string, number>> {
    const rows = await this.db.getAllAsync<{ exercise_id: number; day_tag: string; sets_done: number }>(
      `SELECT exercise_id, day_tag, sets_done FROM WeeklyProgress WHERE week_start = ?;`,
      [weekStart],
    );
    return new Map(rows.map((r) => [weeklyKey(r.exercise_id, r.day_tag || null), r.sets_done]));
  }

  async getWeeklyStats(weekStart: number): Promise<WeeklyStats> {
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
    const row = await this.db.getFirstAsync<{ volume_kg: number; total_sets: number; days_trained: number }>(
      `SELECT COALESCE(SUM(ws.weight * ws.reps), 0) AS volume_kg,
              COUNT(ws.id) AS total_sets,
              COUNT(DISTINCT date(wl.timestamp / 1000, 'unixepoch', 'localtime')) AS days_trained
       FROM WorkoutLogs wl
       JOIN WorkoutSets ws ON ws.log_id = wl.id
       WHERE wl.timestamp >= ? AND wl.timestamp < ?;`,
      [weekStart, weekEnd],
    );
    return {
      volumeKg: row?.volume_kg ?? 0,
      totalSets: row?.total_sets ?? 0,
      daysTrained: row?.days_trained ?? 0,
    };
  }

  async getWeeklyMuscleVolume(weekStart: number): Promise<{ muscleGroup: string; volumeKg: number }[]> {
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
    const rows = await this.db.getAllAsync<{ muscle_group: string; volume_kg: number }>(
      `SELECT COALESCE(e.muscle_group, 'Other') AS muscle_group,
              COALESCE(SUM(ws.weight * ws.reps), 0) AS volume_kg
       FROM WorkoutLogs wl
       JOIN WorkoutSets ws ON ws.log_id = wl.id
       JOIN Exercises e ON e.id = wl.exercise_id
       WHERE wl.timestamp >= ? AND wl.timestamp < ?
       GROUP BY COALESCE(e.muscle_group, 'Other')
       ORDER BY volume_kg DESC;`,
      [weekStart, weekEnd],
    );
    return rows.map((r) => ({ muscleGroup: r.muscle_group, volumeKg: r.volume_kg }));
  }

  async getTodayLogId(exerciseId: number, dayTag: string | null): Promise<number | null> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const row = await this.db.getFirstAsync<{ id: number }>(
      'SELECT id FROM WorkoutLogs WHERE exercise_id = ? AND timestamp >= ? AND day_tag IS ? ORDER BY timestamp DESC LIMIT 1;',
      [exerciseId, startOfDay.getTime(), dayTag],
    );
    return row?.id ?? null;
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getHistory(exerciseId: number, options: PageOptions): Promise<WorkoutLog[]> {
    const { limit, beforeTimestamp } = options;

    const logRows = beforeTimestamp
      ? await this.db.getAllAsync<WorkoutLogRow>(
          `SELECT * FROM WorkoutLogs
           WHERE exercise_id = ? AND timestamp < ?
           ORDER BY timestamp DESC LIMIT ?;`,
          [exerciseId, beforeTimestamp, limit],
        )
      : await this.db.getAllAsync<WorkoutLogRow>(
          `SELECT * FROM WorkoutLogs
           WHERE exercise_id = ?
           ORDER BY timestamp DESC LIMIT ?;`,
          [exerciseId, limit],
        );

    if (logRows.length === 0) return [];

    // Fetch all sets for this page in ONE query (avoids N+1).
    const placeholders = logRows.map(() => '?').join(', ');
    const setRows = await this.db.getAllAsync<WorkoutSetRow>(
      `SELECT * FROM WorkoutSets
       WHERE log_id IN (${placeholders})
       ORDER BY log_id, set_order ASC;`,
      logRows.map((l) => l.id),
    );

    const setsByLog = new Map<number, WorkoutSetRow[]>();
    for (const s of setRows) {
      const bucket = setsByLog.get(s.log_id) ?? [];
      bucket.push(s);
      setsByLog.set(s.log_id, bucket);
    }

    return logRows.map((log) => ({
      id: log.id,
      exerciseId: log.exercise_id,
      timestamp: log.timestamp,
      dayTag: log.day_tag ?? null,
      sets: (setsByLog.get(log.id) ?? []).map((s) => ({
        setOrder: s.set_order,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe ?? null,
        note: s.note ?? null,
      })),
    }));
  }

  async getAllHistory(options: PageOptions): Promise<WorkoutLogWithExercise[]> {
    const { limit, beforeTimestamp } = options;

    type LogWithEx = WorkoutLogRow & { exercise_name: string; day_tag: string | null };

    const logRows = beforeTimestamp
      ? await this.db.getAllAsync<LogWithEx>(
          `SELECT wl.id, wl.exercise_id, wl.timestamp, e.name AS exercise_name,
                  COALESCE(wl.day_tag, ${WorkoutRepository.DAY_TAG_SQL}) AS day_tag
           FROM WorkoutLogs wl
           JOIN Exercises e ON e.id = wl.exercise_id
           WHERE wl.timestamp < ?
           ORDER BY wl.timestamp DESC LIMIT ?;`,
          [beforeTimestamp, limit],
        )
      : await this.db.getAllAsync<LogWithEx>(
          `SELECT wl.id, wl.exercise_id, wl.timestamp, e.name AS exercise_name,
                  COALESCE(wl.day_tag, ${WorkoutRepository.DAY_TAG_SQL}) AS day_tag
           FROM WorkoutLogs wl
           JOIN Exercises e ON e.id = wl.exercise_id
           ORDER BY wl.timestamp DESC LIMIT ?;`,
          [limit],
        );

    if (logRows.length === 0) return [];

    const placeholders = logRows.map(() => '?').join(', ');
    const setRows = await this.db.getAllAsync<WorkoutSetRow>(
      `SELECT * FROM WorkoutSets WHERE log_id IN (${placeholders}) ORDER BY log_id, set_order ASC;`,
      logRows.map((l) => l.id),
    );

    const setsByLog = new Map<number, WorkoutSetRow[]>();
    for (const s of setRows) {
      const bucket = setsByLog.get(s.log_id) ?? [];
      bucket.push(s);
      setsByLog.set(s.log_id, bucket);
    }

    return logRows.map((log) => ({
      id: log.id,
      exerciseId: log.exercise_id,
      timestamp: log.timestamp,
      exerciseName: log.exercise_name,
      dayTag: log.day_tag ?? null,
      sets: (setsByLog.get(log.id) ?? []).map((s) => ({
        setOrder: s.set_order,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe ?? null,
        note: s.note ?? null,
      })),
    }));
  }

  // ── Bulk Import ───────────────────────────────────────────────────────────

  async importBatch(payload: ResolvedImportPayload, timestamp: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      // Each import lands as its OWN plan and becomes active — earlier imports
      // and hand-built plans are kept, and the user switches between them via
      // Set Active in the plan list. Plans.name is UNIQUE, so number repeat
      // imports: "AI Import", "AI Import 2", "AI Import 3", …
      let name = 'AI Import';
      for (let n = 2; ; n++) {
        const taken = await this.db.getFirstAsync<{ one: number }>(
          'SELECT 1 AS one FROM Plans WHERE name = ?;',
          [name],
        );
        if (!taken) break;
        name = `AI Import ${n}`;
      }
      await this.db.runAsync(`UPDATE Plans SET is_active = 0;`);
      const planResult = await this.db.runAsync(
        `INSERT INTO Plans (name, is_active, created_at) VALUES (?, 1, ?);`,
        [name, timestamp],
      );
      const planId = planResult.lastInsertRowId;

      // Loaded once and keyed by normalized name: an unmatched (catalogId
      // null) import whose name differs only by casing/punctuation from an
      // existing user exercise must reuse that row instead of creating a
      // near-duplicate — ON CONFLICT(name) only catches an exact match.
      const existingExercises = await this.getAllExercises();
      const byNormalizedName = new Map<string, Exercise>(
        existingExercises.map((e) => [normalizeName(e.name), e]),
      );

      for (let d = 0; d < payload.length; d++) {
        const dayName = payload[d].day;
        const dayResult = await this.db.runAsync(
          `INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (?, ?, ?);`,
          [planId, dayName, d],
        );
        const planDayId = dayResult.lastInsertRowId;

        for (let i = 0; i < payload[d].exercises.length; i++) {
          const item = payload[d].exercises[i];
          // A catalog-linked exercise may have been renamed by the user since
          // it was first imported, so its Exercises row no longer holds the
          // catalog's canonical name. Look it up by catalog_id FIRST — an
          // upsert-by-name here would take the INSERT branch and trip the
          // partial-unique index on catalog_id, rolling back the whole import.
          const existingByCatalog = item.catalogId
            ? await this.getExerciseByCatalogId(item.catalogId)
            : null;
          const existingByName = item.catalogId
            ? null
            : byNormalizedName.get(normalizeName(item.name)) ?? null;

          const exercise =
            existingByCatalog ??
            existingByName ??
            (await this.upsertExercise({
              name: item.name,
              defaultRestSeconds: item.isCompound ? 150 : 75,
              isCompound: item.isCompound,
              isCustom: item.catalogId === null,
              catalogId: item.catalogId,
              muscleGroup: item.muscleGroup,
              // A re-import must not clobber rest times or flags the user already
              // customized on an existing exercise.
              keepExistingSettings: true,
            }));
          // OR IGNORE: an AI payload can list the same exercise name twice
          // under one day. Without it, the second insert hits
          // UNIQUE(plan_day_id, exercise_id) and rolls back the whole import.
          await this.db.runAsync(
            `INSERT OR IGNORE INTO PlanExercises (plan_day_id, exercise_id, sort_order, target_sets, rep_min, rep_max)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [planDayId, exercise.id, i, item.sets, item.repMin, item.repMax],
          );
        }
      }
    });
  }

  // ── Body weight ───────────────────────────────────────────────────────────

  async logBodyWeight(weightKg: number, timestamp: number): Promise<BodyWeightEntry> {
    const result = await this.db.runAsync(
      'INSERT INTO BodyWeightLogs (timestamp, weight_kg) VALUES (?, ?);',
      [timestamp, weightKg],
    );
    return { id: result.lastInsertRowId, timestamp, weightKg };
  }

  async getBodyWeightHistory(limit: number): Promise<BodyWeightEntry[]> {
    const rows = await this.db.getAllAsync<{ id: number; timestamp: number; weight_kg: number }>(
      'SELECT * FROM BodyWeightLogs ORDER BY timestamp DESC LIMIT ?;',
      [limit],
    );
    return rows.map((r) => ({ id: r.id, timestamp: r.timestamp, weightKg: r.weight_kg }));
  }

  async deleteBodyWeight(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM BodyWeightLogs WHERE id = ?;', [id]);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  async clearHistory(): Promise<void> {
    // Keeps Exercises / Plans / PlanDays / PlanExercises. WorkoutSets cascade
    // from WorkoutLogs; WeeklyProgress is cleared explicitly since exercises remain.
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM WorkoutSets;
        DELETE FROM WorkoutLogs;
        DELETE FROM WeeklyProgress;
      `);
    });
  }

  async clearAllData(): Promise<void> {
    // Order matters: WorkoutLogs → Exercises is ON DELETE RESTRICT, so logs must
    // go before exercises. (PlanExercises cascades from Exercises, but we delete
    // it explicitly for clarity.)
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM WorkoutSets;
        DELETE FROM WorkoutLogs;
        DELETE FROM PlanExercises;
        DELETE FROM PlanDays;
        DELETE FROM Plans;
        DELETE FROM Exercises;
        DELETE FROM BodyWeightLogs;
      `);
    });
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  private static toPlan(row: PlanRow): Plan {
    return { id: row.id, name: row.name, isActive: row.is_active === 1, createdAt: row.created_at };
  }

  async getPlans(): Promise<Plan[]> {
    const rows = await this.db.getAllAsync<PlanRow>(
      'SELECT * FROM Plans ORDER BY is_active DESC, name ASC;',
    );
    return rows.map(WorkoutRepository.toPlan);
  }

  async getPlanDetail(planId: number): Promise<PlanDetail | null> {
    const planRow = await this.db.getFirstAsync<PlanRow>('SELECT * FROM Plans WHERE id = ?;', [planId]);
    if (!planRow) return null;

    const dayRows = await this.db.getAllAsync<PlanDayRow>(
      'SELECT * FROM PlanDays WHERE plan_id = ? ORDER BY sort_order ASC;',
      [planId],
    );

    type ExRow = PlanExerciseRow & { exercise_name: string };
    const exRows = dayRows.length
      ? await this.db.getAllAsync<ExRow>(
          `SELECT pe.*, e.name AS exercise_name
           FROM PlanExercises pe JOIN Exercises e ON e.id = pe.exercise_id
           WHERE pe.plan_day_id IN (${dayRows.map(() => '?').join(', ')})
           ORDER BY pe.plan_day_id ASC, pe.sort_order ASC;`,
          dayRows.map((d) => d.id),
        )
      : [];

    const exByDay = new Map<number, PlanExerciseDetail[]>();
    for (const row of exRows) {
      const bucket = exByDay.get(row.plan_day_id) ?? [];
      bucket.push({
        id: row.id,
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        sortOrder: row.sort_order,
        targetSets: row.target_sets,
        repMin: row.rep_min,
        repMax: row.rep_max,
      });
      exByDay.set(row.plan_day_id, bucket);
    }

    const days: PlanDayDetail[] = dayRows.map((d) => ({
      id: d.id,
      planId: d.plan_id,
      name: d.name,
      sortOrder: d.sort_order,
      exercises: exByDay.get(d.id) ?? [],
    }));

    return { ...WorkoutRepository.toPlan(planRow), days };
  }

  async createPlan(name: string): Promise<Plan> {
    let planId!: number;
    await this.db.withTransactionAsync(async () => {
      const result = await this.db.runAsync(
        'INSERT INTO Plans (name, is_active, created_at) VALUES (?, 0, ?);',
        [name, Date.now()],
      );
      planId = result.lastInsertRowId;
      // A brand-new user's (or post-clearAllData) first plan must become active,
      // or the Log tab stays "No workout plan yet" with no obvious way forward.
      const { count } = (await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM Plans WHERE is_active = 1;',
      ))!;
      if (count === 0) {
        await this.db.runAsync('UPDATE Plans SET is_active = 1 WHERE id = ?;', [planId]);
      }
    });
    const row = await this.db.getFirstAsync<PlanRow>('SELECT * FROM Plans WHERE id = ?;', [planId]);
    return WorkoutRepository.toPlan(row!);
  }

  async renamePlan(planId: number, name: string): Promise<void> {
    await this.db.runAsync('UPDATE Plans SET name = ? WHERE id = ?;', [name, planId]);
  }

  async deletePlan(planId: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM Plans WHERE id = ?;', [planId]);
      // Deleting the active plan must not leave the app with zero active plans
      // (that silently blanks the Log tab) — promote the newest remaining one.
      const { count } = (await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM Plans WHERE is_active = 1;',
      ))!;
      if (count === 0) {
        const next = await this.db.getFirstAsync<{ id: number }>(
          'SELECT id FROM Plans ORDER BY created_at DESC LIMIT 1;',
        );
        if (next) {
          await this.db.runAsync('UPDATE Plans SET is_active = 1 WHERE id = ?;', [next.id]);
        }
      }
    });
  }

  async setActivePlan(planId: number): Promise<void> {
    // Exclusive: withTransactionAsync alone can interleave with a second
    // concurrent call (e.g. a fast double-tap on two "Set Active" rows),
    // leaving two plans active. This blocks other writers until it commits.
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('UPDATE Plans SET is_active = 0;');
      await txn.runAsync('UPDATE Plans SET is_active = 1 WHERE id = ?;', [planId]);
    });
  }

  async addPlanDay(planId: number, name: string): Promise<PlanDay> {
    const { count } = (await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM PlanDays WHERE plan_id = ?;',
      [planId],
    ))!;
    const result = await this.db.runAsync(
      'INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (?, ?, ?);',
      [planId, name, count],
    );
    return { id: result.lastInsertRowId, planId, name, sortOrder: count };
  }

  async renamePlanDay(planDayId: number, name: string): Promise<void> {
    await this.db.runAsync('UPDATE PlanDays SET name = ? WHERE id = ?;', [name, planDayId]);
  }

  async deletePlanDay(planDayId: number): Promise<void> {
    await this.db.runAsync('DELETE FROM PlanDays WHERE id = ?;', [planDayId]);
  }

  async addPlanExercise(
    planDayId: number,
    exerciseId: number,
    options: { targetSets: number; repMin?: number | null; repMax?: number | null },
  ): Promise<PlanExerciseDetail> {
    const { count } = (await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM PlanExercises WHERE plan_day_id = ?;',
      [planDayId],
    ))!;
    const result = await this.db.runAsync(
      `INSERT INTO PlanExercises (plan_day_id, exercise_id, sort_order, target_sets, rep_min, rep_max)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [planDayId, exerciseId, count, options.targetSets, options.repMin ?? null, options.repMax ?? null],
    );
    const exercise = await this.db.getFirstAsync<{ name: string }>(
      'SELECT name FROM Exercises WHERE id = ?;',
      [exerciseId],
    );
    return {
      id: result.lastInsertRowId,
      exerciseId,
      exerciseName: exercise?.name ?? '',
      sortOrder: count,
      targetSets: options.targetSets,
      repMin: options.repMin ?? null,
      repMax: options.repMax ?? null,
    };
  }

  async updatePlanExercise(
    id: number,
    options: { targetSets?: number; repMin?: number | null; repMax?: number | null },
  ): Promise<void> {
    if (options.targetSets !== undefined) {
      await this.db.runAsync('UPDATE PlanExercises SET target_sets = ? WHERE id = ?;', [options.targetSets, id]);
    }
    if (options.repMin !== undefined) {
      await this.db.runAsync('UPDATE PlanExercises SET rep_min = ? WHERE id = ?;', [options.repMin, id]);
    }
    if (options.repMax !== undefined) {
      await this.db.runAsync('UPDATE PlanExercises SET rep_max = ? WHERE id = ?;', [options.repMax, id]);
    }
  }

  async removePlanExercise(id: number): Promise<void> {
    // Compact sort_order so a later addPlanExercise (which assigns COUNT(*) as
    // the new position) can't land on an order value another row still holds.
    // No UNIQUE(plan_day_id, sort_order) exists, so a plain decrement is safe
    // regardless of row-processing order.
    await this.db.withTransactionAsync(async () => {
      const row = await this.db.getFirstAsync<{ plan_day_id: number; sort_order: number }>(
        'SELECT plan_day_id, sort_order FROM PlanExercises WHERE id = ?;',
        [id],
      );
      if (!row) return;
      await this.db.runAsync('DELETE FROM PlanExercises WHERE id = ?;', [id]);
      await this.db.runAsync(
        'UPDATE PlanExercises SET sort_order = sort_order - 1 WHERE plan_day_id = ? AND sort_order > ?;',
        [row.plan_day_id, row.sort_order],
      );
    });
  }

  async reorderPlanExercises(planDayId: number, orderedIds: number[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await this.db.runAsync(
          'UPDATE PlanExercises SET sort_order = ? WHERE id = ? AND plan_day_id = ?;',
          [i, orderedIds[i], planDayId],
        );
      }
    });
  }

}
