import { dayProgress, weeklyKey, DEFAULT_TARGET_SETS, type SetProgress } from '@/features/workout/utils/progress';
import type { Exercise } from '@/core/database/types';

describe('progress utilities', () => {
  describe('weeklyKey', () => {
    it('should format key with exerciseId and dayTag', () => {
      expect(weeklyKey(42, 'Push')).toBe('42|Push');
    });

    it('should use empty string for null dayTag', () => {
      expect(weeklyKey(42, null)).toBe('42|');
    });

    it('should create unique keys for same exercise on different days', () => {
      const key1 = weeklyKey(5, 'Push');
      const key2 = weeklyKey(5, 'Pull');

      expect(key1).not.toBe(key2);
      expect(key1).toBe('5|Push');
      expect(key2).toBe('5|Pull');
    });

    it('should be consistent', () => {
      const key1 = weeklyKey(99, 'Legs');
      const key2 = weeklyKey(99, 'Legs');

      expect(key1).toBe(key2);
    });
  });

  describe('dayProgress', () => {
    const createExercise = (overrides?: Partial<Exercise>): Exercise => ({
      id: 1,
      name: 'Test Exercise',
      defaultRestSeconds: 120,
      isCompound: false,
      isCustom: false,
      dayTag: 'Test',
      targetSets: 3,
      catalogId: null,
      muscleGroup: null,
      repMin: null,
      repMax: null,
      ...overrides,
    });

    it('should return 0/0/0% for empty exercise list', () => {
      const result = dayProgress([], new Map(), 'Push');

      expect(result).toEqual<SetProgress>({
        done: 0,
        total: 0,
        pct: 0,
        complete: false,
      });
    });

    it('should sum targetSets for total', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
        createExercise({ id: 2, targetSets: 4 }),
      ];
      const result = dayProgress(exercises, new Map(), 'Push');

      expect(result.total).toBe(7);
    });

    it('should count logged sets up to target', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
        createExercise({ id: 2, targetSets: 2 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 2], // 2 of 3
        [weeklyKey(2, 'Push'), 2], // 2 of 2
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.done).toBe(4);
      expect(result.total).toBe(5);
    });

    it('should cap logged sets at target', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 5], // logged 5, but target is 3
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.done).toBe(3); // capped at target
      expect(result.total).toBe(3);
    });

    it('should use DEFAULT_TARGET_SETS when targetSets is 0', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 0 }),
      ];
      const logged = new Map();

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.total).toBe(DEFAULT_TARGET_SETS);
    });

    it('should calculate pct correctly', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 4 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 2],
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.pct).toBe(0.5);
    });

    it('should mark complete when done >= total', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 3],
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.complete).toBe(true);
    });

    it('should mark incomplete when done < total', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 2],
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.complete).toBe(false);
    });

    it('should treat missing logged count as 0', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
      ];
      const logged = new Map();

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.done).toBe(0);
      expect(result.total).toBe(3);
      expect(result.complete).toBe(false);
    });

    it('should track each day independently', () => {
      const exercise = createExercise({ id: 1, targetSets: 3 });
      const logged = new Map([
        [weeklyKey(1, 'Push'), 2],
        [weeklyKey(1, 'Pull'), 1],
      ]);

      const pushResult = dayProgress([exercise], logged, 'Push');
      const pullResult = dayProgress([exercise], logged, 'Pull');

      expect(pushResult.done).toBe(2);
      expect(pullResult.done).toBe(1);
    });

    it('should handle multiple exercises with mixed completion', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
        createExercise({ id: 2, targetSets: 2 }),
        createExercise({ id: 3, targetSets: 4 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 3], // complete
        [weeklyKey(2, 'Push'), 1], // partial
        [weeklyKey(3, 'Push'), 0], // none
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.done).toBe(4);
      expect(result.total).toBe(9);
      expect(result.complete).toBe(false);
    });

    it('should calculate pct as 0 when total is 0', () => {
      const result = dayProgress([], new Map(), 'Push');

      expect(result.pct).toBe(0);
    });

    it('should handle pct = 1 when fully complete', () => {
      const exercises = [
        createExercise({ id: 1, targetSets: 3 }),
      ];
      const logged = new Map([
        [weeklyKey(1, 'Push'), 3],
      ]);

      const result = dayProgress(exercises, logged, 'Push');

      expect(result.pct).toBe(1);
    });
  });
});
