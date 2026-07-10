import { makeRepo } from './helpers/realDb';

// checkNameAvailable does a full-table scan and compares names with the JS-side
// normalizeName, so it's exercised against a real in-memory SQLite (the repo
// now queries through Drizzle, which can't be hand-mocked per-method).
describe('WorkoutRepository.checkNameAvailable', () => {
  it('flags a collision regardless of case or punctuation', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Bench Press');`);
    expect(await repo.checkNameAvailable('bench press')).toBe(false);
    expect(await repo.checkNameAvailable('Bench-Press')).toBe(false);
    expect(await repo.checkNameAvailable('BENCH   PRESS')).toBe(false);
  });

  it('allows a genuinely different name', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Bench Press');`);
    expect(await repo.checkNameAvailable('Incline Bench Press')).toBe(true);
  });

  it('excludes the given id, so editing an exercise to its own name is allowed', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Bench Press');`);
    expect(await repo.checkNameAvailable('Bench Press', 1)).toBe(true);
    expect(await repo.checkNameAvailable('bench press', 1)).toBe(true);
  });

  it('does not collapse distinct non-Latin names into a false collision', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Жим лёжа');`);
    expect(await repo.checkNameAvailable('Приседания')).toBe(true);
  });

  it('still flags a genuine non-Latin duplicate', async () => {
    const { repo, db } = makeRepo();
    db.exec(`INSERT INTO Exercises (name) VALUES ('Жим лёжа');`);
    expect(await repo.checkNameAvailable('жим лёжа')).toBe(false);
  });
});
