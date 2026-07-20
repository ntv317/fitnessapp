import { formatRepRange, clampReps } from '@/features/workout/utils/repRange';

describe('repRange utilities', () => {
  describe('formatRepRange', () => {
    it('should format range "8-12 reps"', () => {
      expect(formatRepRange(8, 12, 'reps')).toBe('8-12 reps');
    });

    it('should format equal min/max as single value', () => {
      expect(formatRepRange(5, 5, 'reps')).toBe('5 reps');
    });

    it('should return empty string for null/undefined range', () => {
      expect(formatRepRange(null, null, 'reps')).toBe('');
      expect(formatRepRange(undefined, undefined, 'reps')).toBe('');
    });

    it('should handle null min, use max', () => {
      expect(formatRepRange(null, 10, 'reps')).toBe('10 reps');
    });

    it('should handle null max, use min', () => {
      expect(formatRepRange(8, null, 'reps')).toBe('8 reps');
    });

    it('should handle undefined min, use max', () => {
      expect(formatRepRange(undefined, 10, 'reps')).toBe('10 reps');
    });

    it('should handle undefined max, use min', () => {
      expect(formatRepRange(8, undefined, 'reps')).toBe('8 reps');
    });

    it('should handle null/undefined mix', () => {
      expect(formatRepRange(null, undefined, 'reps')).toBe('');
      expect(formatRepRange(undefined, null, 'reps')).toBe('');
    });

    it('should format reverse range (unlikely but handled)', () => {
      expect(formatRepRange(12, 8, 'reps')).toBe('12-8 reps');
    });

    it('should format single digit ranges', () => {
      expect(formatRepRange(1, 3, 'reps')).toBe('1-3 reps');
    });

    it('should format large ranges', () => {
      expect(formatRepRange(10, 50, 'reps')).toBe('10-50 reps');
    });

    it('should be consistent', () => {
      const result1 = formatRepRange(8, 12, 'reps');
      const result2 = formatRepRange(8, 12, 'reps');

      expect(result1).toBe(result2);
    });
  });

  describe('clampReps', () => {
    it('should return unchanged reps within range', () => {
      expect(clampReps(10, 8, 12)).toBe(10);
    });

    it('should clamp to min when below', () => {
      expect(clampReps(5, 8, 12)).toBe(8);
    });

    it('should clamp to max when above', () => {
      expect(clampReps(15, 8, 12)).toBe(12);
    });

    it('should return reps when equal to min', () => {
      expect(clampReps(8, 8, 12)).toBe(8);
    });

    it('should return reps when equal to max', () => {
      expect(clampReps(12, 8, 12)).toBe(12);
    });

    it('should return unchanged when repMin is null', () => {
      expect(clampReps(5, null, 12)).toBe(5);
    });

    it('should return unchanged when repMax is null', () => {
      expect(clampReps(15, 8, null)).toBe(15);
    });

    it('should return unchanged when both bounds are null', () => {
      expect(clampReps(100, null, null)).toBe(100);
    });

    it('should return unchanged when both bounds are undefined', () => {
      expect(clampReps(100, undefined, undefined)).toBe(100);
    });

    it('should handle undefined repMin', () => {
      expect(clampReps(15, undefined, 12)).toBe(12);
    });

    it('should handle undefined repMax', () => {
      expect(clampReps(5, 8, undefined)).toBe(8);
    });

    it('should handle single rep', () => {
      expect(clampReps(1, 1, 1)).toBe(1);
    });

    it('should handle zero reps', () => {
      expect(clampReps(0, 5, 10)).toBe(5);
    });

    it('should handle large rep values', () => {
      expect(clampReps(150, 100, 200)).toBe(150);
      expect(clampReps(250, 100, 200)).toBe(200);
    });
  });
});
