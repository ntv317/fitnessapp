import type { CatalogExercise } from '../types';
import { GROUP_ORDER, groupOf, type MuscleGroup } from '../utils/muscleGroups';

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
let byGroup: Map<MuscleGroup, CatalogExercise[]> | null = null;

function index(): { byId: Map<string, CatalogExercise>; byGroup: Map<MuscleGroup, CatalogExercise[]> } {
  if (!byId || !byGroup) {
    byId = new Map(catalog.map((e) => [e.id, e]));
    byGroup = new Map();
    for (const e of catalog) {
      const group = groupOf(e.primaryMuscles);
      if (!group) continue;
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push(e);
    }
    for (const list of byGroup.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { byId, byGroup };
}

export function getMuscleGroups(): { group: MuscleGroup; count: number }[] {
  const { byGroup } = index();
  return GROUP_ORDER.map((group) => ({ group, count: byGroup.get(group)?.length ?? 0 })).filter(
    (g) => g.count > 0,
  );
}

export function getByGroup(group: MuscleGroup): CatalogExercise[] {
  return index().byGroup.get(group) ?? [];
}

export function getById(catalogId: string): CatalogExercise | undefined {
  return index().byId.get(catalogId);
}

let allSorted: CatalogExercise[] | null = null;

/** Full catalog, name-sorted — for browsable pickers before the user types. */
export function getAll(): CatalogExercise[] {
  if (!allSorted) {
    allSorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
  }
  return allSorted;
}

export function search(query: string): CatalogExercise[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAll().filter((e) => e.name.toLowerCase().includes(q));
}

export function imageUrl(imagePath: string): string {
  return CDN_BASE + imagePath;
}
