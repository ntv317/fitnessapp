import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

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

  await db.execAsync(`PRAGMA user_version = ${version};`);
}
