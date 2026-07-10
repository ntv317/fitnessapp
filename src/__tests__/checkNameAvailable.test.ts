import { WorkoutRepository } from '@/features/workout/services/WorkoutRepository';
import type { SQLiteDatabase } from 'expo-sqlite';

// expo-sqlite is a native module and can't run under jest's node test
// environment, so this stands in a minimal fake covering only the one method
// checkNameAvailable calls — enough to exercise the real normalizeName-based
// comparison logic without reimplementing it in the test.
function makeFakeDb(rows: { id: number; name: string }[]): SQLiteDatabase {
  return {
    getAllAsync: async (_sql: string, params: unknown[] = []) => {
      const excludeId = params[0] as number | undefined;
      return rows.filter((r) => excludeId === undefined || r.id !== excludeId);
    },
  } as unknown as SQLiteDatabase;
}

describe('WorkoutRepository.checkNameAvailable', () => {
  it('flags a collision regardless of case or punctuation', async () => {
    const repo = new WorkoutRepository(makeFakeDb([{ id: 1, name: 'Bench Press' }]));
    expect(await repo.checkNameAvailable('bench press')).toBe(false);
    expect(await repo.checkNameAvailable('Bench-Press')).toBe(false);
    expect(await repo.checkNameAvailable('BENCH   PRESS')).toBe(false);
  });

  it('allows a genuinely different name', async () => {
    const repo = new WorkoutRepository(makeFakeDb([{ id: 1, name: 'Bench Press' }]));
    expect(await repo.checkNameAvailable('Incline Bench Press')).toBe(true);
  });

  it('excludes the given id, so editing an exercise to its own name is allowed', async () => {
    const repo = new WorkoutRepository(makeFakeDb([{ id: 1, name: 'Bench Press' }]));
    expect(await repo.checkNameAvailable('Bench Press', 1)).toBe(true);
    expect(await repo.checkNameAvailable('bench press', 1)).toBe(true);
  });
});
