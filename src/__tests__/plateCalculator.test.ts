import { calculatePlates, type PlateResult } from '@/core/utils/plateCalculator';

describe('plateCalculator', () => {
  describe('calculatePlates', () => {
    it('should return exact weight when exact match exists', () => {
      const result = calculatePlates(100, 20, [20, 10, 5, 2.5]);

      expect(result.exact).toBe(true);
      expect(result.achievable).toBeCloseTo(100, 1);
      // Greedy reuses the largest plate: 40/side = 20 + 20.
      expect(result.plates).toEqual([20, 20]);
    });

    it('should return empty plates when target equals bar weight', () => {
      const result = calculatePlates(20, 20, [20, 10, 5]);

      expect(result.plates).toEqual([]);
      expect(result.achievable).toBeCloseTo(20, 1);
      expect(result.exact).toBe(true);
    });

    it('should return largest plates first', () => {
      // 45/side across mixed sizes exercises the descending order.
      const result = calculatePlates(110, 20, [20, 10, 5, 2.5, 1.25]);

      for (let i = 1; i < result.plates.length; i++) {
        expect(result.plates[i - 1]).toBeGreaterThanOrEqual(result.plates[i]);
      }
    });

    it('should use greedy approach with largest available plates', () => {
      const result = calculatePlates(60, 20, [15, 10, 5]);

      // 60 - 20 = 40 per pair of sides, 40 / 2 = 20 per side
      // Greedy: 15 (remaining 5), 5 (remaining 0)
      expect(result.plates).toContain(15);
      expect(result.plates).toContain(5);
    });

    it('should handle non-exact weight', () => {
      const result = calculatePlates(65.5, 20, [20, 10, 5]);

      // 65.5 - 20 = 45.5, 45.5 / 2 = 22.75 per side
      // Greedy: 20 (remaining 2.75), 10 (remaining 12.75, skip), 5 (remaining 17.75, skip)
      // Can't match exactly
      expect(result.exact).toBe(false);
    });

    it('should handle weight below bar weight', () => {
      const result = calculatePlates(10, 20, [20, 10, 5]);

      expect(result.plates).toEqual([]);
      expect(result.achievable).toBe(20);
    });

    it('should accumulate plates correctly', () => {
      const result = calculatePlates(140, 20, [25, 20, 10, 5, 2.5]);

      // 140 - 20 = 120, 120 / 2 = 60 per side
      // Greedy: 25 (rem 35), 25 (rem 10), 10 (rem 0)
      expect(result.achievable).toBeCloseTo(140, 1);
      expect(result.exact).toBe(true);
    });

    it('should handle standard Olympic plates', () => {
      const standardPlates = [25, 20, 15, 10, 5, 2.5, 1.25];
      const result = calculatePlates(155, 20, standardPlates);

      // 155 - 20 = 135, 135 / 2 = 67.5 per side
      // Greedy: 25 (42.5), 25 (17.5), 15 (2.5), 2.5 (0)
      expect(result.exact).toBe(true);
    });

    it('should handle floating point precision', () => {
      const result = calculatePlates(110.25, 20, [20, 10, 5, 2.5]);

      // 110.25 - 20 = 90.25, 90.25 / 2 = 45.125 per side
      // Greedy: 20 (25.125), 20 (5.125), 5 (0.125 - too small)
      expect(result.exact).toBe(false);
    });

    it('should handle plates in unsorted order', () => {
      const result = calculatePlates(100, 20, [2.5, 5, 10, 20]);

      // Should sort internally
      expect(result.plates[0]).toBeGreaterThanOrEqual(result.plates[1]);
    });

    it('should return plates per side, not total', () => {
      const result = calculatePlates(80, 20, [10, 5]);

      // 80 - 20 = 60, 60 / 2 = 30 per side
      // Greedy: 10 (20), 10 (10), 10 (0)
      expect(result.plates).toEqual([10, 10, 10]);
      expect(result.achievable).toBeCloseTo(80, 1); // 20 + (10 * 2) + (10 * 2) + (10 * 2)
    });

    it('should handle single plate size', () => {
      const result = calculatePlates(120, 20, [25]);

      // 120 - 20 = 100, 100 / 2 = 50 per side
      // Greedy: 25 (25), 25 (0)
      expect(result.plates).toEqual([25, 25]);
      expect(result.exact).toBe(true);
    });

    it('should handle fractional bar weight', () => {
      const result = calculatePlates(105.5, 15, [20, 10, 5, 2.5]);

      // 45.25/side: 20 + 20 + 5 = 45 reachable (0.25 unloadable) → 105, not exact.
      expect(result.plates).toEqual([20, 20, 5]);
      expect(result.achievable).toBeCloseTo(105, 1);
      expect(result.exact).toBe(false);
    });

    it('should work with very small plates', () => {
      const result = calculatePlates(25.5, 20, [1.25, 0.5]);

      // 25.5 - 20 = 5.5, 5.5 / 2 = 2.75 per side
      // Greedy: 1.25 (1.5), 1.25 (0.25), 0.5 (neg, skip)
      expect(result.exact).toBe(false);
    });

    it('should match within tolerance for exact check', () => {
      const result = calculatePlates(100.0001, 20, [20, 10, 5, 2.5]);

      // Within 0.001 tolerance
      expect(result.exact).toBe(true);
    });

    it('should track multiple uses of same plate', () => {
      const result = calculatePlates(170, 20, [25, 20, 10, 5]);

      // 170 - 20 = 150, 150 / 2 = 75 per side
      // Greedy: 25 (50), 25 (25), 25 (0)
      const plate25Count = result.plates.filter((p) => p === 25).length;
      expect(plate25Count).toBeGreaterThan(1);
    });
  });
});
