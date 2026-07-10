import Database from 'better-sqlite3';
import type { SQLiteDatabase } from 'expo-sqlite';
import { WorkoutRepository } from '@/features/workout/services/WorkoutRepository';

/**
 * Real-SQLite test harness for WorkoutRepository. Once the repository talks to
 * SQLite through Drizzle, hand-mocking individual db methods no longer works
 * (Drizzle drives `prepareSync`), so repository tests run against a real
 * in-memory engine instead. better-sqlite3's `.raw(true)` returns positional
 * arrays, matching how the native expo-sqlite driver maps result rows — so
 * joins that select same-named columns across tables behave identically here.
 *
 * The SQL and result-mapping are exercised for real; only the driver differs
 * from production (expo-sqlite on device), which is covered by simulator runs.
 */

// Exact final-state (DATABASE_VERSION = 14) schema, transcribed from migrations.ts.
export const SCHEMA_DDL = `
CREATE TABLE Exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  is_compound INTEGER NOT NULL DEFAULT 0 CHECK (is_compound IN (0,1)),
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0,1)),
  target_sets INTEGER NOT NULL DEFAULT 3,
  catalog_id TEXT DEFAULT NULL,
  muscle_group TEXT DEFAULT NULL,
  instructions TEXT DEFAULT NULL,
  image_uris TEXT DEFAULT NULL,
  secondary_muscle_groups TEXT DEFAULT NULL
);
CREATE UNIQUE INDEX idx_exercises_catalog ON Exercises (catalog_id) WHERE catalog_id IS NOT NULL;
CREATE TABLE WorkoutLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  day_tag TEXT DEFAULT NULL,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id) ON DELETE RESTRICT
);
CREATE INDEX idx_logs_exercise ON WorkoutLogs (exercise_id);
CREATE INDEX idx_logs_timestamp ON WorkoutLogs (timestamp);
CREATE TABLE WorkoutSets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id INTEGER NOT NULL,
  set_order INTEGER NOT NULL,
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight REAL NOT NULL CHECK (weight >= 0),
  rpe REAL DEFAULT NULL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  note TEXT DEFAULT NULL,
  FOREIGN KEY (log_id) REFERENCES WorkoutLogs (id) ON DELETE CASCADE,
  UNIQUE (log_id, set_order)
);
CREATE INDEX idx_sets_log ON WorkoutSets (log_id);
CREATE TABLE WeeklyProgress (
  exercise_id INTEGER NOT NULL REFERENCES Exercises(id) ON DELETE CASCADE,
  day_tag TEXT NOT NULL DEFAULT '',
  week_start INTEGER NOT NULL,
  sets_done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exercise_id, day_tag, week_start)
);
CREATE INDEX idx_weekly_week ON WeeklyProgress (week_start);
CREATE TABLE Plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_plans_active ON Plans (is_active);
CREATE TABLE PlanDays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES Plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (plan_id, name)
);
CREATE INDEX idx_plan_days_plan ON PlanDays (plan_id);
CREATE TABLE PlanExercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_day_id INTEGER NOT NULL REFERENCES PlanDays(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES Exercises(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3,
  rep_min INTEGER,
  rep_max INTEGER,
  UNIQUE (plan_day_id, exercise_id)
);
CREATE INDEX idx_plan_ex_day ON PlanExercises (plan_day_id);
CREATE TABLE BodyWeightLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  weight_kg REAL NOT NULL CHECK (weight_kg > 0)
);
CREATE INDEX idx_bodyweight_ts ON BodyWeightLogs (timestamp);
`;

// Shim shaped like the client drizzle-orm/expo-sqlite expects: prepareSync ->
// executeSync / executeForRawResultSync -> getAllSync / getFirstSync.
function makeClient(db: Database.Database): SQLiteDatabase {
  const client = {
    prepareSync(sql: string) {
      return {
        executeSync(params: unknown[] = []) {
          let ran: Database.RunResult | null = null;
          const run = () => (ran ??= db.prepare(sql).run(...(params as never[])));
          return {
            get changes() {
              return Number(run().changes);
            },
            get lastInsertRowId() {
              return Number(run().lastInsertRowid);
            },
            getAllSync() {
              return db.prepare(sql).all(...(params as never[]));
            },
            getFirstSync() {
              return db.prepare(sql).get(...(params as never[])) ?? undefined;
            },
          };
        },
        executeForRawResultSync(params: unknown[] = []) {
          const stmt = db.prepare(sql);
          stmt.raw(true);
          const rows = stmt.all(...(params as never[]));
          return { getAllSync: () => rows };
        },
      };
    },
  };
  return client as unknown as SQLiteDatabase;
}

export function makeRepo(): { repo: WorkoutRepository; db: Database.Database } {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_DDL);
  const repo = new WorkoutRepository(makeClient(db));
  return { repo, db };
}
