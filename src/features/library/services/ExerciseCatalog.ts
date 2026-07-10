import i18n from 'i18next';
import type { CatalogExercise } from '../types';
import { GROUP_ORDER, groupOf, type MuscleGroup } from '../utils/muscleGroups';
import { catalogL10n } from './catalogL10n';

// Bundled snapshot of free-exercise-db (public domain). Prefer importing this
// module lazily (a deferred `require` inside a function, not a top-level
// import) from any call site that isn't already library-feature code — e.g.
// WorkoutLogScreen's muscle-group labels — so the ~0.8MB JSON only parses
// once something actually needs a catalog lookup. Rebuild via
// scripts/build-exercise-catalog.mjs.
import catalogJson from '../data/exercises.json';

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
// Fallback if jsdelivr ever breaks:
// https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/

const catalog = catalogJson as CatalogExercise[];

let byId: Map<string, CatalogExercise> | null = null;
let groupBuckets: Map<MuscleGroup, CatalogExercise[]> | null = null;

function index(): { byId: Map<string, CatalogExercise>; groupBuckets: Map<MuscleGroup, CatalogExercise[]> } {
  if (!byId || !groupBuckets) {
    byId = new Map(catalog.map((e) => [e.id, e]));
    groupBuckets = new Map();
    for (const e of catalog) {
      const group = groupOf(e.primaryMuscles);
      if (!group) continue;
      if (!groupBuckets.has(group)) groupBuckets.set(group, []);
      groupBuckets.get(group)!.push(e);
    }
  }
  return { byId, groupBuckets };
}

/** Catalog name in the active app language, falling back to English per exercise. */
export function displayName(e: CatalogExercise): string {
  return catalogL10n()?.[e.id]?.name ?? e.name;
}

/** Instructions in the active app language, falling back to English per exercise. */
export function displayInstructions(e: CatalogExercise): string[] {
  const localized = catalogL10n()?.[e.id]?.instructions;
  return localized && localized.length > 0 ? localized : e.instructions;
}

function sortByDisplayName(list: CatalogExercise[]): CatalogExercise[] {
  const lang = i18n.language;
  return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b), lang));
}

const sortedGroupCache = new Map<string, CatalogExercise[]>();
const sortedAllCache = new Map<string, CatalogExercise[]>();

export function getMuscleGroups(): { group: MuscleGroup; count: number }[] {
  const { groupBuckets } = index();
  return GROUP_ORDER.map((group) => ({ group, count: groupBuckets.get(group)?.length ?? 0 })).filter(
    (g) => g.count > 0,
  );
}

export function getByGroup(group: MuscleGroup): CatalogExercise[] {
  const key = `${i18n.language}:${group}`;
  let sorted = sortedGroupCache.get(key);
  if (!sorted) {
    sorted = sortByDisplayName(index().groupBuckets.get(group) ?? []);
    sortedGroupCache.set(key, sorted);
  }
  return sorted;
}

export function getById(catalogId: string): CatalogExercise | undefined {
  return index().byId.get(catalogId);
}

/** Full catalog, name-sorted in the active language — for browsable pickers before the user types. */
export function getAll(): CatalogExercise[] {
  const lang = i18n.language;
  let sorted = sortedAllCache.get(lang);
  if (!sorted) {
    sorted = sortByDisplayName(catalog);
    sortedAllCache.set(lang, sorted);
  }
  return sorted;
}

// Diacritic-insensitive matching, so Vietnamese typed without tones still hits
// ("dua ta" matches "đưa tạ"); harmless for the other languages.
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

export function matchesQuery(e: CatalogExercise, query: string): boolean {
  const q = fold(query.trim());
  return !q || fold(displayName(e)).includes(q) || fold(e.name).includes(q);
}

export function search(query: string): CatalogExercise[] {
  if (!query.trim()) return [];
  return getAll().filter((e) => matchesQuery(e, query));
}

export function imageUrl(imagePath: string): string {
  return CDN_BASE + imagePath;
}
