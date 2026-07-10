import { useTranslation } from 'react-i18next';
import { getById, displayName } from '../services/ExerciseCatalog';

interface NamedExercise {
  name: string;
  catalogId: string | null;
  isCustom: boolean;
}

/**
 * Maps a DB exercise to its display name in the active app language.
 * DB rows keep the English name as the stable identity; catalog-linked
 * exercises translate at display time, custom ones show verbatim.
 */
export function useExerciseDisplayName(): (exercise: NamedExercise) => string {
  useTranslation();
  return (exercise) => {
    if (exercise.isCustom || !exercise.catalogId) return exercise.name;
    const catalogExercise = getById(exercise.catalogId);
    return catalogExercise ? displayName(catalogExercise) : exercise.name;
  };
}
