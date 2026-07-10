import { mergeLibraryExercise } from '@/features/library/hooks/useLibraryExercise';
import { getById, displayName, displayInstructions } from '@/features/library/services/ExerciseCatalog';
import type { Exercise } from '@/core/database/types';

// A real bundled catalog entry so displayName/displayInstructions localization is exercised.
const CATALOG_ID = 'Barbell_Bench_Press_-_Medium_Grip';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 1,
    name: 'Bench Press',
    defaultRestSeconds: 150,
    isCompound: true,
    isCustom: false,
    dayTag: null,
    targetSets: 3,
    catalogId: CATALOG_ID,
    muscleGroup: null,
    instructions: null,
    imageUris: null,
    repMin: null,
    repMax: null,
    ...overrides,
  };
}

describe('mergeLibraryExercise', () => {
  const cat = getById(CATALOG_ID)!;

  it('exists in the bundled catalog', () => {
    expect(cat).toBeDefined();
  });

  it('shows the localized catalog name for an untouched link (no DB row)', () => {
    const view = mergeLibraryExercise(cat, undefined);
    expect(view.name).toBe(displayName(cat));
    expect(view.hasOverride).toBe(false);
  });

  it('shows the localized catalog name for a plain link (is_custom = 0) even though a row exists', () => {
    const dbRow = makeExercise({ isCustom: false, name: 'Bench Press' });
    const view = mergeLibraryExercise(cat, dbRow);
    expect(view.name).toBe(displayName(cat));
    expect(view.isCompound).toBe(cat.mechanic === 'compound');
    expect(view.hasOverride).toBe(false);
  });

  it('shows the DB name for a saved override (is_custom = 1)', () => {
    const dbRow = makeExercise({ isCustom: true, name: 'My Custom Bench' });
    const view = mergeLibraryExercise(cat, dbRow);
    expect(view.name).toBe('My Custom Bench');
    expect(view.hasOverride).toBe(true);
  });

  it('falls back to catalog instructions when the DB column is null', () => {
    const dbRow = makeExercise({ isCustom: true, instructions: null });
    const view = mergeLibraryExercise(cat, dbRow);
    expect(view.instructions).toEqual(displayInstructions(cat));
  });

  it('uses non-null DB instructions over the catalog', () => {
    const dbRow = makeExercise({ isCustom: true, instructions: ['Step 1'] });
    const view = mergeLibraryExercise(cat, dbRow);
    expect(view.instructions).toEqual(['Step 1']);
  });
});
