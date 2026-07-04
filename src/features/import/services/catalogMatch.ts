import type { AIImportPayload, ResolvedImportPayload } from '@/core/database/types';
import type { CatalogExercise } from '@/features/library/types';
import { GROUP_ORDER, groupOf, type MuscleGroup } from '@/features/library/utils/muscleGroups';

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Punctuation → space (not removed) so "Bench-Press" matches "Bench Press".
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let nameIndex: Map<string, CatalogExercise> | null = null;

function getIndex(): Map<string, CatalogExercise> {
  if (!nameIndex) {
    // Deferred require: parsing the ~0.8MB catalog JSON must not happen until
    // the first import actually runs (see ExerciseCatalog module note).
    const { getAll } = require('@/features/library/services/ExerciseCatalog') as typeof import('@/features/library/services/ExerciseCatalog');
    nameIndex = new Map(getAll().map((e) => [normalizeName(e.name), e]));
  }
  return nameIndex;
}

export function findCatalogMatch(name: string): CatalogExercise | null {
  return getIndex().get(normalizeName(name)) ?? null;
}

// Common gym shorthand the catalog spells out ("Incline DB Press" →
// "Incline Dumbbell Press").
const ALIASES: Record<string, string> = { db: 'dumbbell', bb: 'barbell' };

/**
 * Looser match for display-only fallbacks (images/instructions on the logging
 * screen): exact first, else the shortest catalog name containing the query as
 * a whole-word phrase (e.g. "Bench Press" → "Bench Press - With Bands").
 * Import resolution must keep using findCatalogMatch — a near match must never
 * rename or relink a stored exercise.
 */
export function findClosestCatalogMatch(name: string): CatalogExercise | null {
  const q = normalizeName(name)
    .split(' ')
    .map((w) => ALIASES[w] ?? w)
    .join(' ');
  const index = getIndex();
  const exact = index.get(q);
  if (exact) return exact;
  if (q.length < 4) return null;
  let best: CatalogExercise | null = null;
  let bestKey = '';
  let bestStarts = false;
  for (const [key, ex] of index) {
    if (!` ${key} `.includes(` ${q} `)) continue;
    const starts = key.startsWith(q);
    if (
      !best ||
      (starts && !bestStarts) ||
      (starts === bestStarts && key.length < bestKey.length)
    ) {
      best = ex;
      bestKey = key;
      bestStarts = starts;
    }
  }
  return best;
}

export function normalizeGroup(input: string | undefined): MuscleGroup | null {
  if (!input) return null;
  const q = input.trim().toLowerCase();
  return GROUP_ORDER.find((g) => g.toLowerCase() === q) ?? null;
}

/**
 * Enrich a validated AI payload with catalog links before persistence.
 * Matched exercises take the catalog's mechanic + muscle group (the catalog is
 * more reliable than the AI's flags); unmatched ones keep the AI's values so
 * they can still be browsed under their group in the library.
 */
export function resolveImport(payload: AIImportPayload): ResolvedImportPayload {
  return payload.map((day) => ({
    day: day.day,
    exercises: day.exercises.map((e) => {
      const match = findCatalogMatch(e.name);
      return {
        // Canonical catalog name on match: Exercises.name is UNIQUE and
        // case-sensitive, so keeping the AI's casing could create a second row
        // with the same catalog_id and trip idx_exercises_catalog.
        name: match?.name ?? e.name.trim(),
        isCompound: match?.mechanic ? match.mechanic === 'compound' : e.isCompound,
        sets: e.sets,
        repMin: e.repMin ?? e.reps ?? null,
        repMax: e.repMax ?? e.reps ?? null,
        muscleGroup: match ? groupOf(match.primaryMuscles) : normalizeGroup(e.muscleGroup),
        catalogId: match?.id ?? null,
      };
    }),
  }));
}
