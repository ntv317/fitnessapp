import { makeRepo } from './helpers/realDb';
import { weeklyKey } from '@/features/workout/utils/progress';

// Fixed week window (2024-01-01 00:00 UTC) so date()/localtime bucketing is
// deterministic. DAY0 and DAY1 sit ~2 days apart, so they land on distinct
// local calendar days in any timezone while staying inside the 7-day window.
const WEEK_START = 1704067200000;
const DAY0 = WEEK_START + 60 * 60 * 1000;
const DAY1 = WEEK_START + 48 * 60 * 60 * 1000;

describe('WorkoutRepository (real SQLite) — exercise reads', () => {
  it('getAllExercises returns mapped domain objects ordered by name', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom, target_sets, catalog_id, muscle_group)
             VALUES ('Squat', 150, 1, 0, 4, 'cat_squat', 'Quadriceps'),
                    ('Bench Press', 150, 1, 0, 3, NULL, 'Chest');`);
    const all = await repo.getAllExercises();
    expect(all.map((e) => e.name)).toEqual(['Bench Press', 'Squat']);
    const squat = all.find((e) => e.name === 'Squat')!;
    expect(squat.isCompound).toBe(true);
    expect(squat.targetSets).toBe(4);
    expect(squat.muscleGroup).toBe('Quadriceps');
    expect(squat.catalogId).toBe('cat_squat');
    expect(squat.dayTag).toBeNull();
  });

  it('getExerciseById / ByName / ByCatalogId round-trip', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom, catalog_id)
             VALUES ('Deadlift', 150, 1, 0, 'cat_dl');`);
    const byName = await repo.getExerciseByName('Deadlift');
    expect(byName?.name).toBe('Deadlift');
    const byId = await repo.getExerciseById(byName!.id);
    expect(byId?.id).toBe(byName!.id);
    const byCat = await repo.getExerciseByCatalogId('cat_dl');
    expect(byCat?.id).toBe(byName!.id);
    expect(await repo.getExerciseByName('Nope')).toBeNull();
  });

  it('day_tag correlated subquery resolves the active plan day', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Row');`);
    db.exec(`INSERT INTO Plans (name, is_active, created_at) VALUES ('P', 1, 1000);`);
    db.exec(`INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (1, 'Pull', 0);`);
    db.exec(`INSERT INTO PlanExercises (plan_day_id, exercise_id, sort_order, target_sets, rep_min, rep_max)
             VALUES (1, 1, 0, 5, 8, 12);`);
    const ex = await repo.getExerciseByName('Row');
    expect(ex?.dayTag).toBe('Pull');
  });

  it('getAllDays groups active-plan exercises by day with plan overrides', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, target_sets) VALUES ('Curl', 3), ('Press', 3);`);
    db.exec(`INSERT INTO Plans (name, is_active, created_at) VALUES ('P', 1, 1000);`);
    db.exec(`INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (1, 'Push', 0);`);
    db.exec(`INSERT INTO PlanExercises (plan_day_id, exercise_id, sort_order, target_sets, rep_min, rep_max)
             VALUES (1, 2, 0, 5, 6, 10), (1, 1, 1, 4, 10, 15);`);
    const days = await repo.getAllDays();
    expect(days).toHaveLength(1);
    expect(days[0].dayTag).toBe('Push');
    expect(days[0].exercises.map((e) => e.name)).toEqual(['Press', 'Curl']);
    expect(days[0].exercises[0].targetSets).toBe(5);
    expect(days[0].exercises[0].repMin).toBe(6);
    expect(days[0].exercises[0].repMax).toBe(10);
  });
});

describe('WorkoutRepository (real SQLite) — exercise writes', () => {
  it('upsertExercise inserts a new exercise with compound rest default', async () => {
    const { repo } = makeRepo();
    const ex = await repo.upsertExercise({ name: 'OHP', defaultRestSeconds: 150, isCompound: true, isCustom: false });
    expect(ex.id).toBeGreaterThan(0);
    expect(ex.defaultRestSeconds).toBe(150);
    expect(ex.isCompound).toBe(true);
    expect(ex.targetSets).toBe(3);
  });

  it('upsertExercise keepExistingSettings preserves rest/flags but COALESCEs catalog/muscle', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom, catalog_id, muscle_group)
             VALUES ('Bench', 999, 1, 1, NULL, NULL);`);
    const ex = await repo.upsertExercise({
      name: 'Bench',
      defaultRestSeconds: 75,
      isCompound: false,
      isCustom: false,
      catalogId: 'cat_bench',
      muscleGroup: 'Chest',
      keepExistingSettings: true,
    });
    expect(ex.defaultRestSeconds).toBe(999);
    expect(ex.isCompound).toBe(true);
    expect(ex.isCustom).toBe(true);
    expect(ex.catalogId).toBe('cat_bench');
    expect(ex.muscleGroup).toBe('Chest');
  });

  it('upsertExercise without keepExistingSettings overwrites flags', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, default_rest_seconds, is_compound, is_custom)
             VALUES ('Bench', 999, 1, 1);`);
    const ex = await repo.upsertExercise({ name: 'Bench', defaultRestSeconds: 75, isCompound: false, isCustom: false });
    expect(ex.isCompound).toBe(false);
    expect(ex.isCustom).toBe(false);
    expect(ex.defaultRestSeconds).toBe(75);
  });

  it('createCustomExercise then a duplicate name throws NameTakenError', async () => {
    const { repo } = makeRepo();
    const created = await repo.createCustomExercise({
      name: 'My Move',
      isCompound: false,
      targetSets: 4,
      muscleGroup: 'Arms',
      secondaryMuscleGroups: ['Forearms'],
      instructions: ['Do it'],
      imageFilenames: null,
    });
    expect(created.isCustom).toBe(true);
    expect(created.targetSets).toBe(4);
    expect(created.secondaryMuscleGroups).toEqual(['Forearms']);
    await expect(
      repo.createCustomExercise({ name: 'My Move', isCompound: false }),
    ).rejects.toMatchObject({ name: 'NameTakenError' });
  });

  it('updateExercise marks custom, updates fields, and blocks name collisions', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, is_compound, is_custom) VALUES ('A', 0, 0), ('B', 0, 0);`);
    const updated = await repo.updateExercise(1, { name: 'A2', targetSets: 6, instructions: ['x'] });
    expect(updated.name).toBe('A2');
    expect(updated.isCustom).toBe(true);
    expect(updated.targetSets).toBe(6);
    expect(updated.instructions).toEqual(['x']);
    await expect(repo.updateExercise(1, { name: 'B' })).rejects.toMatchObject({ name: 'NameTakenError' });
  });

  it('resetExerciseOverride clears override fields', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, is_compound, is_custom, instructions, image_uris, secondary_muscle_groups)
             VALUES ('Renamed', 1, 1, '["a"]', '["b"]', '["c"]');`);
    const reset = await repo.resetExerciseOverride(1, { name: 'Canonical', isCompound: false, muscleGroup: 'Back' });
    expect(reset.name).toBe('Canonical');
    expect(reset.isCustom).toBe(false);
    expect(reset.instructions).toBeNull();
    expect(reset.imageUris).toBeNull();
    expect(reset.secondaryMuscleGroups).toBeNull();
    expect(reset.muscleGroup).toBe('Back');
  });

  it('deleteCustomExercise blocks when logged or planned, else deletes', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Free'), ('Logged'), ('Planned');`);
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (2, 1000);`);
    db.exec(`INSERT INTO Plans (name, is_active, created_at) VALUES ('P', 1, 1);`);
    db.exec(`INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (1, 'D', 0);`);
    db.exec(`INSERT INTO PlanExercises (plan_day_id, exercise_id, sort_order) VALUES (1, 3, 0);`);
    expect(await repo.deleteCustomExercise(2)).toEqual({ blocked: true, reason: 'logged' });
    expect(await repo.deleteCustomExercise(3)).toEqual({ blocked: true, reason: 'planned' });
    expect(await repo.deleteCustomExercise(1)).toEqual({ blocked: false });
    expect(await repo.getExerciseById(1)).toBeNull();
  });
});

describe('WorkoutRepository (real SQLite) — logging, stats & history', () => {
  it('createLog inserts a log row and returns its id', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Squat');`);
    const id = await repo.createLog(1, 5000, 'Legs');
    expect(id).toBeGreaterThan(0);
    const row = db.prepare('SELECT exercise_id, timestamp, day_tag FROM WorkoutLogs WHERE id = ?').get(id);
    expect(row).toEqual({ exercise_id: 1, timestamp: 5000, day_tag: 'Legs' });
  });

  it('updateSet edits an existing set in place, matched by log_id + set_order', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Squat');`);
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (1, 5000);`);
    db.exec(`INSERT INTO WorkoutSets (log_id, set_order, reps, weight) VALUES (1, 0, 5, 100);`);
    await repo.updateSet(1, 0, 8, 120, 7.5, 'harder');
    const row = db.prepare('SELECT reps, weight, rpe, note FROM WorkoutSets WHERE log_id = 1 AND set_order = 0').get();
    expect(row).toEqual({ reps: 8, weight: 120, rpe: 7.5, note: 'harder' });
  });

  it('getWeeklyProgress maps rows keyed by exercise + day tag', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('A'), ('B');`);
    db.exec(`INSERT INTO WeeklyProgress (exercise_id, day_tag, week_start, sets_done)
             VALUES (1, 'Push', 1000, 4), (2, '', 1000, 2);`);
    const map = await repo.getWeeklyProgress(1000);
    expect(map.get(weeklyKey(1, 'Push'))).toBe(4);
    expect(map.get(weeklyKey(2, null))).toBe(2);
    expect(await (await repo.getWeeklyProgress(9999)).size).toBe(0);
  });

  it('getWeeklyStats aggregates volume, set count, and distinct training days', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('A');`);
    // two logs on distinct days within the week, one log outside it
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (1, ${DAY0}), (1, ${DAY1}), (1, ${WEEK_START - 1});`);
    db.exec(`INSERT INTO WorkoutSets (log_id, set_order, reps, weight) VALUES
             (1, 0, 5, 100), (1, 1, 5, 100), (2, 0, 10, 50), (3, 0, 5, 999);`);
    const stats = await repo.getWeeklyStats(WEEK_START);
    expect(stats.volumeKg).toBe(5 * 100 + 5 * 100 + 10 * 50);
    expect(stats.totalSets).toBe(3);
    expect(stats.daysTrained).toBe(2);
  });

  it('getWeeklyStats returns zeros when nothing logged in the window', async () => {
    const { repo } = makeRepo();
    expect(await repo.getWeeklyStats(WEEK_START)).toEqual({ volumeKg: 0, totalSets: 0, daysTrained: 0 });
  });

  it('getWeeklyMuscleVolume groups by muscle (Other for null) and orders by volume desc', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name, muscle_group) VALUES ('Bench', 'Chest'), ('Nameless', NULL);`);
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp) VALUES (1, ${DAY0}), (2, ${DAY0});`);
    db.exec(`INSERT INTO WorkoutSets (log_id, set_order, reps, weight) VALUES (1, 0, 10, 100), (2, 0, 10, 200);`);
    const vol = await repo.getWeeklyMuscleVolume(WEEK_START);
    expect(vol).toEqual([
      { muscleGroup: 'Other', volumeKg: 2000 },
      { muscleGroup: 'Chest', volumeKg: 1000 },
    ]);
  });

  it('getTodayLogId finds today\'s log with a null-safe day tag match', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('A');`);
    const today = Date.now();
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp, day_tag) VALUES
             (1, ${today - 1000}, NULL), (1, ${today}, 'Push');`);
    expect(await repo.getTodayLogId(1, 'Push')).toBe(2);
    expect(await repo.getTodayLogId(1, null)).toBe(1);
    expect(await repo.getTodayLogId(1, 'Pull')).toBeNull();
  });

  it('getHistory pages a single exercise newest-first with its sets attached', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Squat');`);
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp, day_tag) VALUES (1, 100, 'Legs'), (1, 200, 'Legs'), (1, 300, 'Legs');`);
    db.exec(`INSERT INTO WorkoutSets (log_id, set_order, reps, weight, rpe, note) VALUES
             (3, 0, 5, 140, 8, 'top'), (3, 1, 5, 140, NULL, NULL), (2, 0, 8, 100, NULL, NULL);`);
    const page1 = await repo.getHistory(1, { limit: 2 });
    expect(page1.map((l) => l.timestamp)).toEqual([300, 200]);
    expect(page1[0].sets).toEqual([
      { setOrder: 0, reps: 5, weight: 140, rpe: 8, note: 'top' },
      { setOrder: 1, reps: 5, weight: 140, rpe: null, note: null },
    ]);
    const page2 = await repo.getHistory(1, { limit: 2, beforeTimestamp: 200 });
    expect(page2.map((l) => l.timestamp)).toEqual([100]);
  });

  it('getAllHistory joins the exercise name and resolves the active plan day tag', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Row'), ('Curl');`);
    // Row is on the active plan's "Pull" day; its log has no explicit tag.
    db.exec(`INSERT INTO Plans (name, is_active, created_at) VALUES ('P', 1, 1);`);
    db.exec(`INSERT INTO PlanDays (plan_id, name, sort_order) VALUES (1, 'Pull', 0);`);
    db.exec(`INSERT INTO PlanExercises (plan_day_id, exercise_id, sort_order) VALUES (1, 1, 0);`);
    db.exec(`INSERT INTO WorkoutLogs (exercise_id, timestamp, day_tag) VALUES (1, 100, NULL), (2, 200, 'Arms');`);
    db.exec(`INSERT INTO WorkoutSets (log_id, set_order, reps, weight) VALUES (2, 0, 12, 20);`);
    const all = await repo.getAllHistory({ limit: 10 });
    expect(all.map((l) => [l.exerciseName, l.timestamp, l.dayTag])).toEqual([
      ['Curl', 200, 'Arms'],
      ['Row', 100, 'Pull'],
    ]);
    expect(all[0].sets).toEqual([{ setOrder: 0, reps: 12, weight: 20, rpe: null, note: null }]);
  });
});
