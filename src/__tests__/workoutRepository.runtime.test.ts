import { makeRepo } from './helpers/realDb';

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
