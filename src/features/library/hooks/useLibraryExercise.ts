import { useMemo } from 'react';
import { useExercises } from '@/features/workout/hooks/useExercises';
import { getById, getByGroup, displayName, displayInstructions } from '../services/ExerciseCatalog';
import { groupOf, groupsOf, type MuscleGroup } from '../utils/muscleGroups';
import type { CatalogExercise } from '../types';
import type { Exercise } from '@/core/database/types';

export interface LibraryExerciseView {
  catalogId: string;
  name: string;
  isCompound: boolean;
  muscleGroup: string | null;
  secondaryMuscleGroups: string[] | null;
  instructions: string[];
  imageUris: string[] | null;
  catalogImages: string[];
  hasOverride: boolean;
}

/**
 * Overlays a saved DB row (if any) on top of a catalog entry. A row only wins
 * on fields it is allowed to override — `is_custom` rows carry a real user
 * edit, plain catalog links (`is_custom = 0`) keep showing localized catalog
 * data even though a row exists (e.g. after "Start logging").
 */
export function mergeLibraryExercise(cat: CatalogExercise, dbRow: Exercise | undefined): LibraryExerciseView {
  const overridden = !!dbRow?.isCustom;
  const primary = overridden ? dbRow!.muscleGroup : groupOf(cat.primaryMuscles);
  const catalogSecondary = groupsOf([...cat.primaryMuscles, ...cat.secondaryMuscles]).filter(
    (g) => g !== primary,
  );
  return {
    catalogId: cat.id,
    name: overridden ? dbRow!.name : displayName(cat),
    isCompound: overridden ? dbRow!.isCompound : cat.mechanic === 'compound',
    muscleGroup: primary,
    secondaryMuscleGroups: overridden ? dbRow!.secondaryMuscleGroups : catalogSecondary,
    instructions: dbRow?.instructions ?? displayInstructions(cat),
    imageUris: dbRow?.imageUris ?? null,
    catalogImages: cat.images,
    hasOverride: overridden,
  };
}

/** DB rows keyed by catalogId, built once per exercise-list change — never `.find` per catalog item. */
export function useCatalogIdMap(): Map<string, Exercise> {
  const { data: exercises } = useExercises();
  return useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const e of exercises ?? []) {
      if (e.catalogId !== null) map.set(e.catalogId, e);
    }
    return map;
  }, [exercises]);
}

export function useLibraryExercise(catalogId: string): LibraryExerciseView | undefined {
  const cat = getById(catalogId);
  const map = useCatalogIdMap();
  return cat ? mergeLibraryExercise(cat, map.get(catalogId)) : undefined;
}

export function useLibraryExercises(group: MuscleGroup): LibraryExerciseView[] {
  const map = useCatalogIdMap();
  return useMemo(
    () => getByGroup(group).map((cat) => mergeLibraryExercise(cat, map.get(cat.id))),
    [group, map],
  );
}
