import { normalizeName, normalizeGroup } from '@/features/import/services/catalogMatch';

describe('catalogMatch utilities', () => {
  describe('normalizeName', () => {
    it('should lowercase input', () => {
      expect(normalizeName('BENCH PRESS')).toBe('bench press');
    });

    it('should convert punctuation to spaces', () => {
      expect(normalizeName('Bench-Press!')).toBe('bench press');
      expect(normalizeName("It's/Heavy")).toBe('it s heavy');
    });

    it('should collapse multiple spaces to single space', () => {
      expect(normalizeName('Bench   Press')).toBe('bench press');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(normalizeName('  Bench Press  ')).toBe('bench press');
    });

    it('should handle mixed case and punctuation', () => {
      expect(normalizeName('Barbell Bench-Press (Medium Grip)')).toBe('barbell bench press medium grip');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeName('')).toBe('');
    });

    it('should handle numbers', () => {
      expect(normalizeName('45° Leg Press')).toBe('45 leg press');
    });

    it('should be idempotent', () => {
      const name = 'Dumbbell Curl';
      expect(normalizeName(normalizeName(name))).toBe(normalizeName(name));
    });
  });

  describe('normalizeGroup', () => {
    it('should return "Chest" for "chest"', () => {
      expect(normalizeGroup('chest')).toBe('Chest');
    });

    it('should be case-insensitive', () => {
      expect(normalizeGroup('CHEST')).toBe('Chest');
      expect(normalizeGroup('Chest')).toBe('Chest');
      expect(normalizeGroup('ChEsT')).toBe('Chest');
    });

    it('should trim whitespace', () => {
      expect(normalizeGroup('  Chest  ')).toBe('Chest');
    });

    it('should return null for unknown group', () => {
      expect(normalizeGroup('unknown')).toBeNull();
    });

    it('should handle common groups', () => {
      expect(normalizeGroup('back')).toBe('Back');
      expect(normalizeGroup('legs')).toBe('Legs');
      expect(normalizeGroup('shoulders')).toBe('Shoulders');
      expect(normalizeGroup('biceps')).toBe('Biceps');
      expect(normalizeGroup('triceps')).toBe('Triceps');
      expect(normalizeGroup('calf')).toBe('Calf');
      expect(normalizeGroup('forearms')).toBe('Forearms');
      expect(normalizeGroup('abs')).toBe('Abs');
    });

    it('should return null for empty string', () => {
      expect(normalizeGroup('')).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(normalizeGroup(undefined)).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      expect(normalizeGroup('   ')).toBeNull();
    });
  });
});
