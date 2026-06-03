import type { SQLiteDatabase } from 'expo-sqlite';
import type { IWorkoutRepository } from './IWorkoutRepository';
import type {
  AIExerciseDTO,
  Exercise,
  ExerciseInput,
  ExerciseRow,
  LogWorkoutInput,
  PageOptions,
  WorkoutLog,
  WorkoutLogRow,
  WorkoutLogWithExercise,
  WorkoutSetRow,
} from '@/core/database/types';

type ExerciseWithDay = ExerciseRow & { day_tag: string | null };

/**
 * The ONLY place raw SQL and expo-sqlite live (Single Responsibility).
 * All methods use the async API — no *Sync calls, no legacy callbacks.
 */
export class WorkoutRepository implements IWorkoutRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  // Correlated subquery that resolves the primary day name for an exercise aliased "e".
  private static readonly DAY_TAG_SQL = `(
    SELECT wd.name
    FROM ExerciseDays ed
    JOIN WorkoutDays wd ON wd.id = ed.day_id
    WHERE ed.exercise_id = e.id
    ORDER BY ed.sort_order ASC, ed.rowid ASC
    LIMIT 1
  )`;

  // ── Mappers ──────────────────────────────────────────────────────────────

  private static toExercise(row: ExerciseWithDay): Exercise {
    return {
      id: row.id,
      name: row.name,
      defaultRestSeconds: row.default_rest_seconds,
      isCompound: row.is_compound === 1,
      isCustom: row.is_custom === 1,
      dayTag: row.day_tag ?? null,
      targetSets: row.target_sets,
    };
  }

  // ── Exercises ─────────────────────────────────────────────────────────────

  async getExerciseByName(name: string): Promise<Exercise | null> {
    const row = await this.db.getFirstAsync<ExerciseWithDay>(
      `SELECT e.*, ${WorkoutRepository.DAY_TAG_SQL} AS day_tag FROM Exercises e WHERE e.name = ?;`,
      [name],
    );
    return row ? WorkoutRepository.toExercise(row) : null;
  }

  async getAllExercises(): Promise<Exercise[]> {
    const rows = await this.db.getAllAsync<ExerciseWithDay>(
      `SELECT e.*, ${WorkoutRepository.DAY_TAG_SQL} AS day_tag FROM Exercises e ORDER BY e.name ASC;`,
    );
    return rows.map(WorkoutRepository.toExercise);
  }

  async getExercisesByDay(dayTag: string): Promise<Exercise[]> {
    const rows = await this.db.getAllAsync<ExerciseWithDay>(
      `SELECT e.*, ${WorkoutRepository.DAY_TAG_SQL} AS day_tag
       FROM Exercises e
       JOIN ExerciseDays ed ON ed.exercise_id = e.id
       JOIN WorkoutDays wd ON wd.id = ed.day_id
       WHERE wd.name = ?
       ORDER BY ed.sort_order ASC, e.id ASC;`,
      [dayTag],
    );
    return rows.map(WorkoutRepository.toExercise);
  }

  async getAllDays(): Promise<{ dayTag: string; exercises: Exercise[] }[]> {
    type Row = ExerciseRow & { day_name: string };
    const rows = await this.db.getAllAsync<Row>(
      `SELECT e.*, wd.name AS day_name
       FROM WorkoutDays wd
       JOIN ExerciseDays ed ON ed.day_id = wd.id
       JOIN Exercises e ON e.id = ed.exercise_id
       ORDER BY wd.id ASC, ed.sort_order ASC, e.id ASC;`,
    );
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
    const REST_ISOLATION = 90;
    const restSeconds =
      input.defaultRestSeconds ??
      (input.isCompound ? REST_COMPOUND : REST_ISOLATION);

    const patchedInput = { ...input, defaultRestSeconds: restSeconds };

    // target_sets: insert the given value (or fall back to 3); on conflict only
    // overwrite when a value was explicitly provided, else keep the existing one.
    const target = input.targetSets ?? null;
    const row = await this.db.getFirstAsync<ExerciseRow>(
      `INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom, target_sets)
       VALUES (?, ?, ?, ?, COALESCE(?, 3))
       ON CONFLICT(name) DO UPDATE SET
         default_rest_seconds = excluded.default_rest_seconds,
         is_compound          = excluded.is_compound,
         is_custom            = excluded.is_custom,
         target_sets          = COALESCE(?, Exercises.target_sets)
       RETURNING *;`,
      [
        patchedInput.name,
        patchedInput.defaultRestSeconds,
        patchedInput.isCompound ? 1 : 0,
        patchedInput.isCustom ? 1 : 0,
        target,
        target,
      ],
    );
    if (!row) throw new Error(`upsertExercise failed for "${input.name}"`);

    if (patchedInput.dayTag) {
      await this.db.runAsync(
        `INSERT OR IGNORE INTO WorkoutDays (name) VALUES (?);`,
        [patchedInput.dayTag],
      );
      await this.db.runAsync(
        `INSERT OR IGNORE INTO ExerciseDays (exercise_id, day_id, sort_order)
         SELECT ?, id, 0 FROM WorkoutDays WHERE name = ?;`,
        [row.id, patchedInput.dayTag],
      );
    }

    const dayRow = await this.db.getFirstAsync<{ day_tag: string | null }>(
      `SELECT ${WorkoutRepository.DAY_TAG_SQL} AS day_tag FROM Exercises e WHERE e.id = ?;`,
      [row.id],
    );
    return WorkoutRepository.toExercise({ ...row, day_tag: dayRow?.day_tag ?? null });
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  async logWorkout(input: LogWorkoutInput): Promise<number> {
    let logId = 0;
    await this.db.withTransactionAsync(async () => {
      const header = await this.db.runAsync(
        'INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (?, ?);',
        [input.exerciseId, input.timestamp],
      );
      logId = header.lastInsertRowId;
      await this.insertSets(logId, input.sets);
    });
    return logId;
  }

  async deleteLog(logId: number): Promise<void> {
    await this.db.runAsync('DELETE FROM WorkoutLogs WHERE id = ?;', [logId]);
  }

  async createLog(exerciseId: number, timestamp: number): Promise<number> {
    const result = await this.db.runAsync(
      'INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (?, ?);',
      [exerciseId, timestamp],
    );
    return result.lastInsertRowId;
  }

  async appendSet(logId: number, setOrder: number, reps: number, weight: number): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO WorkoutSets (log_id, set_order, reps, weight) VALUES (?, ?, ?, ?);',
      [logId, setOrder, reps, weight],
    );
  }

  async getTodayLogId(exerciseId: number): Promise<number | null> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const row = await this.db.getFirstAsync<{ id: number }>(
      'SELECT id FROM WorkoutLogs WHERE exercise_id = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1;',
      [exerciseId, startOfDay.getTime()],
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
      sets: (setsByLog.get(log.id) ?? []).map((s) => ({
        setOrder: s.set_order,
        reps: s.reps,
        weight: s.weight,
      })),
    }));
  }

  async getAllHistory(options: PageOptions): Promise<WorkoutLogWithExercise[]> {
    const { limit, beforeTimestamp } = options;

    type LogWithEx = WorkoutLogRow & { exercise_name: string; day_tag: string | null };

    const logRows = beforeTimestamp
      ? await this.db.getAllAsync<LogWithEx>(
          `SELECT wl.id, wl.exercise_id, wl.timestamp, e.name AS exercise_name,
                  ${WorkoutRepository.DAY_TAG_SQL} AS day_tag
           FROM WorkoutLogs wl
           JOIN Exercises e ON e.id = wl.exercise_id
           WHERE wl.timestamp < ?
           ORDER BY wl.timestamp DESC LIMIT ?;`,
          [beforeTimestamp, limit],
        )
      : await this.db.getAllAsync<LogWithEx>(
          `SELECT wl.id, wl.exercise_id, wl.timestamp, e.name AS exercise_name,
                  ${WorkoutRepository.DAY_TAG_SQL} AS day_tag
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
      })),
    }));
  }

  // ── Bulk Import ───────────────────────────────────────────────────────────

  async importBatch(payload: import('@/core/database/types').AIImportPayload, timestamp: number, mode: 'plan' | 'session'): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (let d = 0; d < payload.length; d++) {
        const dayName = payload[d].day;
        await this.db.runAsync(
          `INSERT OR IGNORE INTO WorkoutDays (name) VALUES (?);`,
          [dayName],
        );
        for (let i = 0; i < payload[d].exercises.length; i++) {
          const item = payload[d].exercises[i];
          const exercise = await this.upsertExercise({
            name: item.name,
            defaultRestSeconds: item.isCompound ? 150 : 75,
            isCompound: item.isCompound,
            isCustom: false,
            dayTag: dayName,
            targetSets: item.sets.length, // planned set count from the AI plan
          });
          // Preserve import order as sort_order
          await this.db.runAsync(
            `UPDATE ExerciseDays SET sort_order = ?
             WHERE exercise_id = ? AND day_id = (SELECT id FROM WorkoutDays WHERE name = ?);`,
            [i, exercise.id, dayName],
          );
          if (mode === 'session') {
            const header = await this.db.runAsync(
              'INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (?, ?);',
              [exercise.id, timestamp],
            );
            await this.insertSets(header.lastInsertRowId, item.sets);
          }
        }
      }
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  async clearAllData(): Promise<void> {
    // Order matters: WorkoutLogs → Exercises is ON DELETE RESTRICT, so logs must
    // go before exercises. (ExerciseDays cascades from Exercises, but we delete
    // it explicitly for clarity.)
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM WorkoutSets;
        DELETE FROM WorkoutLogs;
        DELETE FROM ExerciseDays;
        DELETE FROM Exercises;
        DELETE FROM WorkoutDays;
      `);
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async insertSets(
    logId: number,
    sets: Array<{ reps: number; weight: number }>,
  ): Promise<void> {
    for (let i = 0; i < sets.length; i++) {
      await this.db.runAsync(
        'INSERT INTO WorkoutSets (log_id, set_order, reps, weight) VALUES (?, ?, ?, ?);',
        [logId, i + 1, sets[i].reps, sets[i].weight],
      );
    }
  }
}
