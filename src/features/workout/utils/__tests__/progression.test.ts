import { suggestProgression, type SetLike } from '@/features/workout/utils/progression';

describe('suggestProgression', () => {
  describe('empty or invalid sets', () => {
    it('should return null for empty sets array', () => {
      const result = suggestProgression([], 8, 12, 2.5);

      expect(result).toBeNull();
    });

    it('should return null when all sets have weight <= 0', () => {
      const sets: SetLike[] = [
        { weight: 0, reps: 10 },
        { weight: -5, reps: 8 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toBeNull();
    });

    it('should return null when all sets have reps <= 0', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 0 },
        { weight: 95, reps: -3 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toBeNull();
    });

    it('should return null when all sets are completely invalid (weight and reps <= 0)', () => {
      const sets: SetLike[] = [
        { weight: 0, reps: 0 },
        { weight: -10, reps: -5 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toBeNull();
    });
  });

  describe('top-weight sets at or above repMax', () => {
    it('should increase weight and reset to repMin when all top-weight sets >= repMax', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 12 },
        { weight: 100, reps: 13 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });

    it('should increase weight with custom repMin and repMax', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 7 },
        { weight: 100, reps: 7 },
      ];
      const result = suggestProgression(sets, 5, 7, 1.25);

      expect(result).toEqual({ weightKg: 101.25, reps: 5, increased: true });
    });

    it('should use default repMin=8 and repMax=12 when null', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 12 },
        { weight: 100, reps: 12 },
      ];
      const result = suggestProgression(sets, null, null, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });

    it('should not increase when one top-weight set is below repMax', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 12 },
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, null, null, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 12, increased: false });
    });

    it('should use default repMin=8 when undefined', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 12 },
      ];
      const result = suggestProgression(sets, undefined, 12, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });

    it('should use default repMax=12 when undefined', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 12 },
      ];
      const result = suggestProgression(sets, 8, undefined, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });

    it('should add the correct increment value', () => {
      const sets: SetLike[] = [{ weight: 100, reps: 12 }];
      const result = suggestProgression(sets, 8, 12, 5);

      expect(result?.weightKg).toBe(105);
    });

    it('should handle single top-weight set at repMax', () => {
      const sets: SetLike[] = [{ weight: 100, reps: 12 }];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });
  });

  describe('mixed sets (some top-weight below repMax)', () => {
    it('should keep same weight and increment lowest reps by 1', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 10 },
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 11, increased: false });
    });

    it('should find the lowest reps among top-weight sets', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 8 },
        { weight: 100, reps: 9 },
        { weight: 100, reps: 10 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 9, increased: false });
    });

    it('should cap reps at repMax when lowest + 1 would exceed it', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 11 },
        { weight: 100, reps: 12 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 12, increased: false });
    });

    it('should cap reps exactly at repMax', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 12, increased: false });
    });
  });

  describe('warmup sets do not affect top-weight decision', () => {
    it('should ignore lower-weight warmup sets', () => {
      const sets: SetLike[] = [
        { weight: 80, reps: 5 },
        { weight: 90, reps: 5 },
        { weight: 100, reps: 10 },
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 11, increased: false });
    });

    it('should use only the maximum weight for top-weight decision', () => {
      const sets: SetLike[] = [
        { weight: 50, reps: 15 },
        { weight: 75, reps: 13 },
        { weight: 100, reps: 8 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 9, increased: false });
    });

    it('should work with many warmup sets and one top-weight', () => {
      const sets: SetLike[] = [
        { weight: 20, reps: 15 },
        { weight: 40, reps: 12 },
        { weight: 60, reps: 10 },
        { weight: 80, reps: 8 },
        { weight: 100, reps: 12 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });
  });

  describe('filtering out invalid sets', () => {
    it('should ignore sets with weight = 0 and use valid sets only', () => {
      const sets: SetLike[] = [
        { weight: 0, reps: 10 },
        { weight: 100, reps: 10 },
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 11, increased: false });
    });

    it('should ignore sets with reps = 0 and use valid sets only', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 0 },
        { weight: 100, reps: 10 },
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 11, increased: false });
    });

    it('should work when only some sets are valid', () => {
      const sets: SetLike[] = [
        { weight: 0, reps: 5 },
        { weight: 100, reps: -1 },
        { weight: 100, reps: 12 },
        { weight: 100, reps: 12 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });
  });

  describe('edge cases', () => {
    it('should handle single valid set', () => {
      const sets: SetLike[] = [{ weight: 100, reps: 10 }];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 11, increased: false });
    });

    it('should handle single set at repMax', () => {
      const sets: SetLike[] = [{ weight: 100, reps: 12 }];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 8, increased: true });
    });

    it('should handle floating-point weights', () => {
      const sets: SetLike[] = [
        { weight: 99.75, reps: 12 },
        { weight: 99.75, reps: 12 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.25);

      expect(result).toEqual({ weightKg: 102, reps: 8, increased: true });
    });

    it('should handle very small increment', () => {
      const sets: SetLike[] = [{ weight: 100, reps: 12 }];
      const result = suggestProgression(sets, 8, 12, 0.25);

      expect(result?.weightKg).toBeCloseTo(100.25, 2);
    });

    it('should increase when repMin = repMax and the target rep is hit', () => {
      const sets: SetLike[] = [{ weight: 100, reps: 10 }];
      const result = suggestProgression(sets, 10, 10, 2.5);

      expect(result).toEqual({ weightKg: 102.5, reps: 10, increased: true });
    });

    it('should handle multiple sets at same weight with different reps', () => {
      const sets: SetLike[] = [
        { weight: 100, reps: 8 },
        { weight: 100, reps: 9 },
        { weight: 100, reps: 10 },
        { weight: 100, reps: 11 },
      ];
      const result = suggestProgression(sets, 8, 12, 2.5);

      expect(result).toEqual({ weightKg: 100, reps: 9, increased: false });
    });
  });
});
