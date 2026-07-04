import { est1RM, detectPR } from '@/features/workout/utils/pr';
import type { WorkoutLog, WorkoutSet } from '@/core/database/types';

describe('pr utilities', () => {
  describe('est1RM', () => {
    it('should return 0 for zero or negative weight', () => {
      expect(est1RM(0, 5)).toBe(0);
      expect(est1RM(-10, 5)).toBe(0);
    });

    it('should return 0 for zero or negative reps', () => {
      expect(est1RM(100, 0)).toBe(0);
      expect(est1RM(100, -5)).toBe(0);
    });

    it('should return weight for 1 rep', () => {
      expect(est1RM(100, 1)).toBeCloseTo(100 * (1 + 1 / 30), 2);
    });

    it('should use Brzycki formula: weight * (1 + reps/30)', () => {
      const weight = 100;
      const reps = 10;
      const expected = weight * (1 + reps / 30);

      expect(est1RM(weight, reps)).toBeCloseTo(expected, 2);
    });

    it('should handle fractional weights', () => {
      const result = est1RM(65.5, 5);

      expect(result).toBeCloseTo(65.5 * (1 + 5 / 30), 2);
    });

    it('should scale with reps', () => {
      const weight = 100;
      const low = est1RM(weight, 5);
      const high = est1RM(weight, 15);

      expect(high).toBeGreaterThan(low);
    });

    it('should handle very high reps', () => {
      const result = est1RM(100, 50);

      expect(result).toBeCloseTo(100 * (1 + 50 / 30), 2);
    });
  });

  describe('detectPR', () => {
    const createSet = (weight: number, reps: number) => ({ weight, reps });
    const createLog = (sets: Array<{ weight: number; reps: number }>, overrides?: Partial<WorkoutLog>): WorkoutLog => ({
      id: 1,
      exerciseId: 1,
      timestamp: Date.now(),
      dayTag: null,
      sets: sets.map((s, i) => ({
        setOrder: i,
        reps: s.reps,
        weight: s.weight,
        rpe: null,
        note: null,
      })),
      ...overrides,
    });

    it('should return false for empty history', () => {
      const current = [createSet(100, 5)];

      expect(detectPR(current, [])).toBe(false);
    });

    it('should return true when current best exceeds history best', () => {
      const current = [createSet(110, 5)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(true);
    });

    it('should return false when current equals history best', () => {
      const current = [createSet(100, 5)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(false);
    });

    it('should return false when current is less than history best', () => {
      const current = [createSet(90, 5)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(false);
    });

    it('should use estimated 1RM for comparison, not just weight', () => {
      // 90 kg x 10 reps ≈ 120 kg 1RM
      // 100 kg x 5 reps ≈ 116.67 kg 1RM
      const current = [createSet(90, 10)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(true);
    });

    it('should find max across multiple sets in current', () => {
      const current = [createSet(80, 5), createSet(100, 5), createSet(90, 5)];
      const history = [createLog([createSet(95, 5)])];

      expect(detectPR(current, history)).toBe(true);
    });

    it('should find max across multiple logs in history', () => {
      const current = [createSet(105, 5)];
      const history = [
        createLog([createSet(90, 5)]),
        createLog([createSet(100, 5)]),
        createLog([createSet(95, 5)]),
      ];

      expect(detectPR(current, history)).toBe(true);
    });

    it('should find max across multiple sets within history logs', () => {
      const current = [createSet(105, 5)];
      const history = [
        createLog([createSet(80, 5), createSet(90, 5)]),
        createLog([createSet(100, 5), createSet(95, 5)]),
      ];

      expect(detectPR(current, history)).toBe(true);
    });

    it('should return false when current best is just below history', () => {
      const current = [createSet(99, 5)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(false);
    });

    it('should handle zero weight reps', () => {
      const current = [createSet(0, 5)];
      const history = [createLog([createSet(10, 5)])];

      expect(detectPR(current, history)).toBe(false);
    });

    it('should return false when currentBest is 0 or negative', () => {
      const current = [createSet(0, 0)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(false);
    });

    it('should handle multiple sets in current with varying reps', () => {
      const current = [
        createSet(80, 8),
        createSet(90, 5),
        createSet(75, 10),
      ];
      // 90 x 5 = 90 * (1 + 5/30) = 105 est 1RM
      const history = [createLog([createSet(100, 5)])];
      // 100 x 5 = 100 * (1 + 5/30) = 116.67 est 1RM

      expect(detectPR(current, history)).toBe(false);
    });

    it('should handle fractional weights', () => {
      const current = [createSet(100.5, 5)];
      const history = [createLog([createSet(100, 5)])];

      expect(detectPR(current, history)).toBe(true);
    });

    it('should be consistent', () => {
      const current = [createSet(105, 5)];
      const history = [createLog([createSet(100, 5)])];

      const result1 = detectPR(current, history);
      const result2 = detectPR(current, history);

      expect(result1).toBe(result2);
    });

    it('should work with real gym weights', () => {
      // Realistic scenario: PR on bench press
      const current = [
        createSet(100, 2),
        createSet(97.5, 4),
        createSet(95, 5),
      ];
      const history = [
        createLog([
          createSet(100, 1),
          createSet(97.5, 3),
          createSet(95, 4),
        ]),
      ];

      expect(detectPR(current, history)).toBe(true);
    });
  });
});
