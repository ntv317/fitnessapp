import type { AIImportPayload, ResolvedImportPayload } from '@/core/database/types';
import type { CatalogExercise } from '@/features/library/types';
import { GROUP_ORDER, groupOf, type MuscleGroup } from '@/features/library/utils/muscleGroups';

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Fold diacritics (NFD + strip combining marks) so accented Latin script
    // still normalizes sensibly, same technique as ExerciseCatalog.fold().
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    // Punctuation → space (not removed) so "Bench-Press" matches "Bench Press".
    // Unicode-aware: strips punctuation/symbols but keeps letters from any
    // script (Cyrillic, Thai, …) instead of collapsing them to "".
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Gym shorthand the catalog spells out. Values may be multi-word — they are
// re-split into tokens after substitution ("ohp" → "overhead press" → two
// tokens). Keep these conservative: a wrong alias mislabels a real exercise.
const ALIASES: Record<string, string> = {
  db: 'dumbbell',
  dbs: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  bw: 'bodyweight',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
};

// Dropped from both sides before comparison — symmetric, so it never changes
// which side "wins", only removes noise words the catalog and AI disagree on.
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'with', 'and', 'to', 'for', 'your', 'on']);

// When a candidate covers every query token but adds extras, those extras are
// only acceptable for an IMPORT link if they're minor variant descriptors
// (grip/stance/count) — same movement, same muscle group. Any other extra
// (machine, smith, cable, decline, incline, reverse, rear, deficit, ball, …)
// is a different exercise, so we'd rather miss than mislabel. Kept as an
// allow-list: an unknown extra word defaults to "significant" → reject.
const MINOR_EXTRAS = new Set([
  'grip', 'medium', 'wide', 'close', 'narrow', 'standard', 'regular',
  'alternate', 'alternating', 'single', 'one', 'two', 'arm', 'arms',
  'side',
]);

function tokenize(name: string): string[] {
  return normalizeName(name)
    .split(' ')
    .flatMap((w) => (ALIASES[w] ?? w).split(' '))
    .filter((w) => w && !STOPWORDS.has(w));
}

interface Indexed {
  exact: Map<string, CatalogExercise>;
  tokenized: { ex: CatalogExercise; toks: Set<string>; nName: string }[];
}

let indexed: Indexed | null = null;

function getIndex(): Indexed {
  if (!indexed) {
    // Deferred require: parsing the ~0.8MB catalog JSON must not happen until
    // the first import actually runs (see ExerciseCatalog module note).
    const { getAll } = require('@/features/library/services/ExerciseCatalog') as typeof import('@/features/library/services/ExerciseCatalog');
    const all = getAll();
    indexed = {
      exact: new Map(all.map((e) => [normalizeName(e.name), e])),
      tokenized: all.map((e) => ({
        ex: e,
        toks: new Set(tokenize(e.name)),
        nName: normalizeName(e.name),
      })),
    };
  }
  return indexed;
}

export function findCatalogMatch(name: string): CatalogExercise | null {
  return getIndex().exact.get(normalizeName(name)) ?? null;
}

/**
 * Strict token match: every meaningful token the AI wrote must appear in the
 * candidate, then prefer the most specific (fewest extra tokens) candidate.
 * Requires ≥2 query tokens so a bare "Curl" or "Press" can't latch onto an
 * arbitrary variant. Returns null when nothing fully covers the query — a
 * miss is safer than a wrong link, which would rename the stored exercise and
 * mislabel its muscle group.
 */
function findStrictMatch(name: string): CatalogExercise | null {
  const exact = getIndex().exact.get(
    tokenize(name).join(' '), // exact after alias expansion, e.g. "Incline DB Press"
  );
  if (exact) return exact;

  const q = new Set(tokenize(name));
  if (q.size < 2) return null;

  let best: { ex: CatalogExercise; extra: number; len: number; nName: string } | null = null;
  for (const { ex, toks, nName } of getIndex().tokenized) {
    let covered = true;
    for (const t of q) {
      if (!toks.has(t)) {
        covered = false;
        break;
      }
    }
    if (!covered) continue;
    // Every token the candidate adds beyond the query must be a minor variant
    // descriptor — otherwise it's a materially different exercise.
    let onlyMinorExtras = true;
    for (const t of toks) {
      if (!q.has(t) && !MINOR_EXTRAS.has(t)) {
        onlyMinorExtras = false;
        break;
      }
    }
    if (!onlyMinorExtras) continue;
    const extra = toks.size - q.size; // candidate tokens beyond the query
    const len = nName.length;
    if (
      !best ||
      extra < best.extra ||
      (extra === best.extra && len < best.len) ||
      (extra === best.extra && len === best.len && nName < best.nName)
    ) {
      best = { ex, extra, len, nName };
    }
  }
  return best?.ex ?? null;
}

// Import-time exact-or-alias-or-strict-fuzzy. Used by resolveImport, so a match
// here rewrites the stored name to the catalog's canonical form and links its
// catalog_id — hence the conservative full-coverage rule in findStrictMatch.
export function findImportMatch(name: string): CatalogExercise | null {
  return findCatalogMatch(name) ?? findStrictMatch(name);
}

/**
 * Loosest match, for display-only fallbacks (images/instructions on the logging
 * screen where nothing is persisted): exact → strict → any catalog name that
 * contains the query as a whole-word phrase (e.g. "Bench Press" →
 * "Bench Press - With Bands"). Never used to rename or relink a stored row.
 */
export function findClosestCatalogMatch(name: string): CatalogExercise | null {
  const strict = findImportMatch(name);
  if (strict) return strict;

  const q = tokenize(name).join(' ');
  if (q.length < 4) return null;
  let best: CatalogExercise | null = null;
  let bestKey = '';
  let bestStarts = false;
  for (const { ex, nName } of getIndex().tokenized) {
    const key = tokenize(nName).join(' ');
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
 * Matched exercises take the catalog's canonical name, mechanic + muscle group
 * (the catalog is more reliable than the AI's flags); unmatched ones keep the
 * AI's values so they can still be browsed under their group in the library.
 */
export function resolveImport(payload: AIImportPayload): ResolvedImportPayload {
  return payload.map((day) => ({
    day: day.day,
    exercises: day.exercises.map((e) => {
      const match = findImportMatch(e.name);
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
