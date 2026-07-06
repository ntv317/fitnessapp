import type { SQLiteDatabase } from 'expo-sqlite';
import { weekStartOf } from '@/core/utils/date';

export const DATABASE_VERSION = 12;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = result?.user_version ?? 0;

  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Exercises (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        name                 TEXT    NOT NULL UNIQUE,
        -- 150s (2:30) for compound, 90s (1:30) for isolation; set per-exercise on insert
        default_rest_seconds INTEGER NOT NULL DEFAULT 90,
        is_compound          INTEGER NOT NULL DEFAULT 0 CHECK (is_compound IN (0, 1)),
        is_custom            INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS WorkoutLogs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id INTEGER NOT NULL,
        timestamp   INTEGER NOT NULL,
        FOREIGN KEY (exercise_id) REFERENCES Exercises (id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS WorkoutSets (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id    INTEGER NOT NULL,
        set_order INTEGER NOT NULL,
        reps      INTEGER NOT NULL CHECK (reps >= 0),
        weight    REAL    NOT NULL CHECK (weight >= 0),
        FOREIGN KEY (log_id) REFERENCES WorkoutLogs (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_logs_exercise  ON WorkoutLogs (exercise_id);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON WorkoutLogs (timestamp);
      CREATE INDEX IF NOT EXISTS idx_sets_log       ON WorkoutSets (log_id);
    `);
    // No seed data — the exercise list is built entirely from the user's AI imports.
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(`ALTER TABLE Exercises ADD COLUMN day_tag TEXT DEFAULT NULL;`);
    version = 2;
  }

  if (version === 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS WorkoutDays (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT    NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS ExerciseDays (
        exercise_id INTEGER NOT NULL REFERENCES Exercises(id) ON DELETE CASCADE,
        day_id      INTEGER NOT NULL REFERENCES WorkoutDays(id) ON DELETE CASCADE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (exercise_id, day_id)
      );

      CREATE INDEX IF NOT EXISTS idx_exercise_days_day ON ExerciseDays (day_id);

      INSERT OR IGNORE INTO WorkoutDays (name)
        SELECT DISTINCT day_tag FROM Exercises WHERE day_tag IS NOT NULL;

      INSERT OR IGNORE INTO ExerciseDays (exercise_id, day_id, sort_order)
        SELECT e.id, wd.id, 0
        FROM Exercises e
        JOIN WorkoutDays wd ON wd.name = e.day_tag
        WHERE e.day_tag IS NOT NULL;

      ALTER TABLE Exercises DROP COLUMN day_tag;
    `);
    version = 3;
  }

  if (version === 3) {
    // Per-exercise planned set count — drives the day's set-progress denominator.
    // Existing rows default to 3; AI import populates the real value on next import.
    await db.execAsync(`ALTER TABLE Exercises ADD COLUMN target_sets INTEGER NOT NULL DEFAULT 3;`);
    version = 4;
  }

  if (version === 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS WeeklyProgress (
        exercise_id INTEGER NOT NULL REFERENCES Exercises(id) ON DELETE CASCADE,
        week_start  INTEGER NOT NULL,
        sets_done   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (exercise_id, week_start)
      );
      CREATE INDEX IF NOT EXISTS idx_weekly_week ON WeeklyProgress (week_start);
    `);

    // Backfill from existing logs — group by exercise + week so the counter
    // is accurate for all historical data from day one.
    type LogRow = { exercise_id: number; timestamp: number; set_count: number };
    const logs = await db.getAllAsync<LogRow>(
      `SELECT wl.exercise_id, wl.timestamp, COUNT(ws.id) AS set_count
       FROM WorkoutLogs wl
       JOIN WorkoutSets ws ON ws.log_id = wl.id
       GROUP BY wl.id;`,
    );
    for (const log of logs) {
      const ws = weekStartOf(log.timestamp);
      await db.runAsync(
        `INSERT INTO WeeklyProgress (exercise_id, week_start, sets_done) VALUES (?, ?, ?)
         ON CONFLICT(exercise_id, week_start) DO UPDATE SET sets_done = sets_done + excluded.sets_done;`,
        [log.exercise_id, ws, log.set_count],
      );
    }

    version = 5;
  }

  if (version === 5) {
    // Add UNIQUE(log_id, set_order) to prevent duplicate sets from a watch+phone race.
    // SQLite can't add constraints via ALTER TABLE, so we rebuild the table.
    // Re-entry safe (see v9 comment): skip when the constraint already exists,
    // and run the rebuild in one transaction so a kill mid-batch can't leave
    // WorkoutSets dropped.
    const setIndexes = await db.getAllAsync<{ origin: string; unique: number }>(
      'PRAGMA index_list(WorkoutSets);',
    );
    if (!setIndexes.some((i) => i.origin === 'u' && i.unique === 1)) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          DROP TABLE IF EXISTS WorkoutSets_new;
          CREATE TABLE WorkoutSets_new (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            log_id    INTEGER NOT NULL,
            set_order INTEGER NOT NULL,
            reps      INTEGER NOT NULL CHECK (reps >= 0),
            weight    REAL    NOT NULL CHECK (weight >= 0),
            FOREIGN KEY (log_id) REFERENCES WorkoutLogs (id) ON DELETE CASCADE,
            UNIQUE (log_id, set_order)
          );
          INSERT OR IGNORE INTO WorkoutSets_new (id, log_id, set_order, reps, weight)
            SELECT id, log_id, set_order, reps, weight FROM WorkoutSets;
          DROP TABLE WorkoutSets;
          ALTER TABLE WorkoutSets_new RENAME TO WorkoutSets;
          CREATE INDEX IF NOT EXISTS idx_sets_log ON WorkoutSets (log_id);
        `);
      });
    }
    version = 6;
  }

  if (version === 6) {
    // Day isolation: an exercise shared by two days (e.g. a press on both Push
    // and Shoulders) must track progress per day, not per exercise. Logs get a
    // day_tag, and WeeklyProgress is re-keyed to include it. Historical rows
    // are attributed to the exercise's primary day (best effort).
    // Re-entry safe (see v9 comment): each half is guarded by a column check
    // and runs transactionally.
    const logCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(WorkoutLogs);');
    if (!logCols.some((c) => c.name === 'day_tag')) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          ALTER TABLE WorkoutLogs ADD COLUMN day_tag TEXT DEFAULT NULL;

          UPDATE WorkoutLogs SET day_tag = (
            SELECT wd.name FROM ExerciseDays ed
            JOIN WorkoutDays wd ON wd.id = ed.day_id
            WHERE ed.exercise_id = WorkoutLogs.exercise_id
            ORDER BY ed.sort_order ASC, ed.rowid ASC LIMIT 1
          );
        `);
      });
    }
    const wpCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(WeeklyProgress);');
    if (!wpCols.some((c) => c.name === 'day_tag')) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          DROP TABLE IF EXISTS WeeklyProgress_new;
          CREATE TABLE WeeklyProgress_new (
            exercise_id INTEGER NOT NULL REFERENCES Exercises(id) ON DELETE CASCADE,
            day_tag     TEXT    NOT NULL DEFAULT '',
            week_start  INTEGER NOT NULL,
            sets_done   INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (exercise_id, day_tag, week_start)
          );
          INSERT INTO WeeklyProgress_new (exercise_id, day_tag, week_start, sets_done)
            SELECT wp.exercise_id,
                   COALESCE((
                     SELECT wd.name FROM ExerciseDays ed
                     JOIN WorkoutDays wd ON wd.id = ed.day_id
                     WHERE ed.exercise_id = wp.exercise_id
                     ORDER BY ed.sort_order ASC, ed.rowid ASC LIMIT 1
                   ), ''),
                   wp.week_start, wp.sets_done
            FROM WeeklyProgress wp;
          DROP TABLE WeeklyProgress;
          ALTER TABLE WeeklyProgress_new RENAME TO WeeklyProgress;
          CREATE INDEX IF NOT EXISTS idx_weekly_week ON WeeklyProgress (week_start);
        `);
      });
    }
    version = 7;
  }

  if (version === 7) {
    // Link to the bundled free-exercise-db catalog. NULL for user/AI-imported
    // exercises — those have no images/instructions and never will.
    await db.execAsync(`
      ALTER TABLE Exercises ADD COLUMN catalog_id TEXT DEFAULT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_catalog
        ON Exercises (catalog_id) WHERE catalog_id IS NOT NULL;
    `);
    version = 8;
  }

  if (version === 8) {
    // Replace the fixed WorkoutDays/ExerciseDays split with user-editable Plans:
    // a plan has named days, each day has exercises with a per-plan target set
    // count. Existing days/exercise assignments become a single "My Split" plan
    // (set active) so today's Log tab keeps working unchanged after migration.
    //
    // Idempotent by construction: if the app is killed after this transaction
    // commits but before `PRAGMA user_version = 9` lands, the next launch
    // re-enters this block against already-migrated data. CREATE/DROP use
    // IF (NOT) EXISTS, and the data-copy step is skipped entirely once
    // WorkoutDays is gone (the signal that a prior run already finished it).
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS Plans (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL UNIQUE,
          is_active  INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS PlanDays (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id    INTEGER NOT NULL REFERENCES Plans(id) ON DELETE CASCADE,
          name       TEXT    NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          UNIQUE (plan_id, name)
        );
        CREATE TABLE IF NOT EXISTS PlanExercises (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_day_id INTEGER NOT NULL REFERENCES PlanDays(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES Exercises(id) ON DELETE CASCADE,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          target_sets INTEGER NOT NULL DEFAULT 3,
          rep_min     INTEGER,
          rep_max     INTEGER,
          UNIQUE (plan_day_id, exercise_id)
        );
        CREATE INDEX IF NOT EXISTS idx_plan_days_plan ON PlanDays (plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_ex_day    ON PlanExercises (plan_day_id);
      `);

      const workoutDaysExists = await db.getFirstAsync<{ one: number }>(
        `SELECT 1 AS one FROM sqlite_master WHERE type = 'table' AND name = 'WorkoutDays';`,
      );

      type OldDay = { id: number; name: string };
      const oldDays = workoutDaysExists
        ? await db.getAllAsync<OldDay>('SELECT id, name FROM WorkoutDays ORDER BY id ASC;')
        : [];

      if (oldDays.length > 0) {
        const planResult = await db.runAsync(
          'INSERT INTO Plans (name, is_active, created_at) VALUES (?, 1, ?);',
          ['My Split', Date.now()],
        );
        const planId = planResult.lastInsertRowId;

        const dayIdMap = new Map<number, number>(); // old WorkoutDays.id -> new PlanDays.id
        for (let i = 0; i < oldDays.length; i++) {
          const dayResult = await db.runAsync(
            'INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (?, ?, ?);',
            [planId, oldDays[i].name, i],
          );
          dayIdMap.set(oldDays[i].id, dayResult.lastInsertRowId);
        }

        type OldExDay = { exercise_id: number; day_id: number; sort_order: number; target_sets: number };
        const oldExDays = await db.getAllAsync<OldExDay>(
          `SELECT ed.exercise_id, ed.day_id, ed.sort_order, e.target_sets
           FROM ExerciseDays ed JOIN Exercises e ON e.id = ed.exercise_id
           ORDER BY ed.day_id ASC, ed.sort_order ASC;`,
        );
        for (const row of oldExDays) {
          const newDayId = dayIdMap.get(row.day_id);
          if (!newDayId) continue;
          await db.runAsync(
            `INSERT INTO PlanExercises (plan_day_id, exercise_id, sort_order, target_sets)
             VALUES (?, ?, ?, ?);`,
            [newDayId, row.exercise_id, row.sort_order, row.target_sets > 0 ? row.target_sets : 3],
          );
        }
      }

      await db.execAsync(`
        DROP TABLE IF EXISTS ExerciseDays;
        DROP TABLE IF EXISTS WorkoutDays;
      `);
    });
    version = 9;
  }

  if (version === 9) {
    // Muscle group for exercises with no catalog link (AI-imported / custom),
    // so the library can list them under their group. NULL when unknown or
    // when the catalog already provides the group via catalog_id.
    //
    // ADD COLUMN has no IF NOT EXISTS and user_version only commits after all
    // blocks — if the app is killed between this ALTER and that PRAGMA, the
    // next launch re-enters here, so the column must be checked first or the
    // duplicate-column error bricks the migration.
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(Exercises);');
    if (!cols.some((c) => c.name === 'muscle_group')) {
      await db.execAsync(`ALTER TABLE Exercises ADD COLUMN muscle_group TEXT DEFAULT NULL;`);
    }
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_plans_active ON Plans (is_active);`);
    version = 10;
  }

  if (version === 10) {
    // Standalone body-weight log — weight stored as kg like everything else.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS BodyWeightLogs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        weight_kg REAL    NOT NULL CHECK (weight_kg > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_bodyweight_ts ON BodyWeightLogs (timestamp);
    `);
    version = 11;
  }

  if (version === 11) {
    // Optional per-set RPE and note. Column checks make re-entry safe (see v10).
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(WorkoutSets);');
    if (!cols.some((c) => c.name === 'rpe')) {
      await db.execAsync(
        `ALTER TABLE WorkoutSets ADD COLUMN rpe REAL DEFAULT NULL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10));`,
      );
    }
    if (!cols.some((c) => c.name === 'note')) {
      await db.execAsync(`ALTER TABLE WorkoutSets ADD COLUMN note TEXT DEFAULT NULL;`);
    }
    version = 12;
  }

  await db.execAsync(`PRAGMA user_version = ${version};`);
}
