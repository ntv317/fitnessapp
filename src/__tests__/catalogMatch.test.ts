import {
  normalizeName,
  normalizeGroup,
  findImportMatch,
  findClosestCatalogMatch,
  resolveImport,
} from '@/features/import/services/catalogMatch';

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

    it('keeps non-Latin letters instead of collapsing them to empty', () => {
      expect(normalizeName('Жим лёжа')).toBe('жим лежа');
      expect(normalizeName('ท่าสควอท')).toBe('ทาสควอท');
      expect(normalizeName('Đẩy Tạ Đòn')).toBe('day ta don');
    });

    it('distinguishes two different non-Latin names', () => {
      expect(normalizeName('Жим лёжа')).not.toBe(normalizeName('Приседания'));
      expect(normalizeName('ท่าสควอท')).not.toBe(normalizeName('ท่าเดดลิฟท์'));
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

  describe('findImportMatch', () => {
    it('matches an exact catalog name', () => {
      expect(findImportMatch('Incline Dumbbell Press')?.name).toBe('Incline Dumbbell Press');
    });

    it('expands equipment abbreviations (DB → Dumbbell)', () => {
      expect(findImportMatch('Incline DB Press')?.name).toBe('Incline Dumbbell Press');
    });

    it('expands movement abbreviations (RDL → Romanian Deadlift)', () => {
      expect(findImportMatch('RDL')?.name).toBe('Romanian Deadlift');
    });

    it('links a partial name to a covering catalog variant', () => {
      // No plain "Barbell Bench Press" exists — it should still link to a
      // barbell bench press variant rather than miss.
      const m = findImportMatch('Barbell Bench Press');
      expect(m).not.toBeNull();
      expect(normalizeName(m!.name)).toContain('barbell bench press');
    });

    it('picks the most specific (fewest-extra-token) covering variant', () => {
      // "Romanian Deadlift" must win over "Romanian Deadlift from Deficit".
      expect(findImportMatch('Romanian Deadlift')?.name).toBe('Romanian Deadlift');
    });

    it('refuses to guess from a single bare token', () => {
      expect(findImportMatch('Curl')).toBeNull();
      expect(findImportMatch('Press')).toBeNull();
    });

    it('returns null when no catalog entry covers the query', () => {
      expect(findImportMatch('Zercher Zottman Widowmaker')).toBeNull();
    });
  });

  describe('findClosestCatalogMatch (display fallback)', () => {
    it('falls back to a phrase-substring variant when strict misses', () => {
      // "Bench Press" alone: loose display match may surface any bench-press
      // variant so the logging screen can show an image.
      const m = findClosestCatalogMatch('Bench Press');
      expect(m).not.toBeNull();
      expect(normalizeName(m!.name)).toContain('bench press');
    });
  });

  describe('resolveImport (catalog linking)', () => {
    it('links an abbreviated exercise to the catalog and canonicalises its name', () => {
      const [day] = resolveImport([
        { day: 'PUSH', exercises: [{ name: 'Incline DB Press', isCompound: false, sets: 3 }] },
      ]);
      expect(day.exercises[0].name).toBe('Incline Dumbbell Press');
      expect(day.exercises[0].catalogId).not.toBeNull();
      expect(day.exercises[0].muscleGroup).not.toBeNull();
    });

    it('keeps an unmatched exercise with the AI-provided name and no catalog link', () => {
      const [day] = resolveImport([
        {
          day: 'PUSH',
          exercises: [
            { name: 'Zercher Zottman Widowmaker', isCompound: true, sets: 3, muscleGroup: 'Chest' },
          ],
        },
      ]);
      expect(day.exercises[0].name).toBe('Zercher Zottman Widowmaker');
      expect(day.exercises[0].catalogId).toBeNull();
      expect(day.exercises[0].muscleGroup).toBe('Chest');
    });
  });
});
