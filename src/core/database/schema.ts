import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
  unique,
  primaryKey,
  check,
} from 'drizzle-orm/sqlite-core';

/**
 * Drizzle description of the LIVE schema as produced by migrations.ts at
 * DATABASE_VERSION = 14. This file does NOT own migrations — the hand-rolled
 * PRAGMA user_version migrator remains the single source of schema truth. These
 * definitions exist only so the query layer can talk to the existing tables
 * type-safely. Column names/types must match the migrated DB exactly; the
 * constraints/indexes are modelled to match too so `drizzle-kit introspect` can
 * be diffed against this file. Keys are snake_case on purpose so query results
 * match the row shapes the existing mappers consume.
 */

export const exercises = sqliteTable(
  'Exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    default_rest_seconds: integer('default_rest_seconds').notNull().default(90),
    is_compound: integer('is_compound').notNull().default(0),
    is_custom: integer('is_custom').notNull().default(0),
    target_sets: integer('target_sets').notNull().default(3),
    catalog_id: text('catalog_id'),
    muscle_group: text('muscle_group'),
    instructions: text('instructions'),
    image_uris: text('image_uris'),
    secondary_muscle_groups: text('secondary_muscle_groups'),
  },
  (t) => [
    check('exercises_is_compound_bool', sql`${t.is_compound} IN (0, 1)`),
    check('exercises_is_custom_bool', sql`${t.is_custom} IN (0, 1)`),
    uniqueIndex('idx_exercises_catalog')
      .on(t.catalog_id)
      .where(sql`${t.catalog_id} IS NOT NULL`),
  ],
);

export const workoutLogs = sqliteTable(
  'WorkoutLogs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    exercise_id: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    timestamp: integer('timestamp').notNull(),
    day_tag: text('day_tag'),
  },
  (t) => [
    index('idx_logs_exercise').on(t.exercise_id),
    index('idx_logs_timestamp').on(t.timestamp),
  ],
);

export const workoutSets = sqliteTable(
  'WorkoutSets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    log_id: integer('log_id')
      .notNull()
      .references(() => workoutLogs.id, { onDelete: 'cascade' }),
    set_order: integer('set_order').notNull(),
    reps: integer('reps').notNull(),
    weight: real('weight').notNull(),
    rpe: real('rpe'),
    note: text('note'),
  },
  (t) => [
    check('workout_sets_reps_nonneg', sql`${t.reps} >= 0`),
    check('workout_sets_weight_nonneg', sql`${t.weight} >= 0`),
    check('workout_sets_rpe_range', sql`${t.rpe} IS NULL OR (${t.rpe} >= 1 AND ${t.rpe} <= 10)`),
    unique('WorkoutSets_log_order_unique').on(t.log_id, t.set_order),
    index('idx_sets_log').on(t.log_id),
  ],
);

export const weeklyProgress = sqliteTable(
  'WeeklyProgress',
  {
    exercise_id: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    day_tag: text('day_tag').notNull().default(''),
    week_start: integer('week_start').notNull(),
    sets_done: integer('sets_done').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.exercise_id, t.day_tag, t.week_start] }),
    index('idx_weekly_week').on(t.week_start),
  ],
);

export const plans = sqliteTable(
  'Plans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    is_active: integer('is_active').notNull().default(0),
    created_at: integer('created_at').notNull(),
  },
  (t) => [
    check('plans_is_active_bool', sql`${t.is_active} IN (0, 1)`),
    index('idx_plans_active').on(t.is_active),
  ],
);

export const planDays = sqliteTable(
  'PlanDays',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    plan_id: integer('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
  },
  (t) => [
    unique('PlanDays_plan_name_unique').on(t.plan_id, t.name),
    index('idx_plan_days_plan').on(t.plan_id),
  ],
);

export const planExercises = sqliteTable(
  'PlanExercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    plan_day_id: integer('plan_day_id')
      .notNull()
      .references(() => planDays.id, { onDelete: 'cascade' }),
    exercise_id: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    sort_order: integer('sort_order').notNull().default(0),
    target_sets: integer('target_sets').notNull().default(3),
    rep_min: integer('rep_min'),
    rep_max: integer('rep_max'),
  },
  (t) => [
    unique('PlanExercises_day_ex_unique').on(t.plan_day_id, t.exercise_id),
    index('idx_plan_ex_day').on(t.plan_day_id),
  ],
);

export const bodyWeightLogs = sqliteTable(
  'BodyWeightLogs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    timestamp: integer('timestamp').notNull(),
    weight_kg: real('weight_kg').notNull(),
  },
  (t) => [
    check('body_weight_logs_weight_pos', sql`${t.weight_kg} > 0`),
    index('idx_bodyweight_ts').on(t.timestamp),
  ],
);
