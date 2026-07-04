# TRAK Improvement Plan — Progress Tracker

Tick boxes as sub-steps are completed and verified. Source plan: approved 2026-07-04.

## Model assignment per phase

| Phase | Implement | Review |
|---|---|---|
| 0. Tracker doc `docs/IMPROVEMENT_PLAN.md` | Haiku (markdown, mechanical) | main session sanity-read |
| 1a–1e. Import rework + migration v10 | Sonnet (main session) | Opus review (DB schema change → mandatory per policy) |
| 1f. `docs/AI_IMPORT_MAPPING.md` | Haiku (docs from finished code) | main session verifies field names against code |
| 2. Rep ranges UI | Sonnet (main session) | self-check (2–4 files, simple) |
| 3. Weekly stats dashboard | Sonnet (main session; Stitch design first) | self-check (new feature, 4–10 files) |
| 4. Body weight + migration v11 | Sonnet (main session; Stitch design first) | Opus review of migration + repo methods only |
| 5. Notes/RPE + migration v12 | Sonnet (main session) | Opus review of migration + appendSet/updateSet changes only |
| 6. Tests | Haiku (writing tests for designed pure functions) | main session always verifies (run tests + read diff) before done |

---

## Phase 0 — Progress tracker

- [x] Create `docs/IMPROVEMENT_PLAN.md` with condensed checkboxes and model assignments

---

## Phase 1 — AI import rework (plan-only, catalog matching, rep ranges)

- [x] 1a: Migration v10 (`src/core/database/migrations.ts`): add `muscle_group` column to Exercises, add index on Plans(is_active); update types in `src/core/database/types.ts`
- [x] 1b: New import schema (`src/core/database/types.ts`): remove `weight`, add `repMin`/`repMax`/`muscleGroup` to AIExerciseSchema with reps→repMin/repMax fallback
- [x] 1c: Rewrite `importBatch` (`src/features/workout/services/WorkoutRepository.ts`): remove session-mode branch, upsert with `keepExistingSettings: true`, set rep_min/rep_max in PlanExercises; catalog matching lives in `src/features/import/services/catalogMatch.ts` (resolveImport, called by ImportService)
- [x] 1d: Update `DataImportScreen` (`src/features/import/screens/DataImportScreen.tsx`): remove mode toggle, update prompt template with new JSON format, fix query invalidations
- [x] 1e: `MuscleGroupListScreen` / `GroupExercisesScreen` (`src/features/library/`): show custom exercises (muscle_group = target and catalog_id IS NULL) alongside catalog exercises
- [x] 1f: Write `docs/AI_IMPORT_MAPPING.md`: field-by-field table (name, isCompound, sets, repMin/repMax, muscleGroup, catalog_id match) and what is NOT touched
- [x] Verify 1 (2026-07-04): tsc clean; app builds & boots; migration v10 verified on device (user_version=10, muscle_group column, existing plan intact); resolveImport + upsert SQL verified against real catalog + scratch DB; Opus review passed after 2 fixes (re-entry-safe ALTER, is_custom keepExistingSettings guard). On-device paste-import tap-through left for manual check: `npm run type-check` passes; `npx expo run:ios` builds; test with catalog + custom exercises in import JSON; confirm plan created, catalog exercise shows image, custom appears under muscle group, PlanExercises has rep_min/rep_max

---

## Phase 2 — Rep ranges end-to-end

- [x] 2a: Verify repo mappers expose repMin/repMax in `getAllDays`/`getPlanDetail` (`src/features/workout/services/WorkoutRepository.ts`)
- [x] 2b: `PlanEditorScreen` (`src/features/plans/`): add rep-range editing (stepper pair or "8–12" field) next to target-sets control per exercise
- [x] 2c: `WorkoutLogScreen` and `ExerciseDetailScreen`: render "3 × 8–12" when range exists, clamp suggested reps into [repMin, repMax]
- [x] Verify 2 (2026-07-04): tsc clean; simulator screenshots confirm ranges in plan editor ("2 SETS · 8-12 REPS") and detail header ("COMPOUND • 8-12 REPS"), prefill clamped: `npm run type-check` passes; screenshot simulator showing rep ranges in plan editor and detail screen

---

## Phase 3 — Weekly stats dashboard

- [x] 3a: Generate Stitch design (project `11182437524249099917`, design system `assets/046e64142ae3494c82599ce53615374d`)
- [x] 3b: New repo method `getWeeklyStats(weekStart)` computing volumeKg, totalSets, daysTrained, perDay; add hook `useWeeklyStats(weekStart)` with query key `['stats', weekStart]`
- [x] 3c: Invalidate `['stats', weekStart]` alongside `['weekly']` in mutations (useWorkoutLogs.ts, data-clearing paths)
- [x] 3d: New screen `src/features/history/screens/WeeklyStatsScreen.tsx` + route `app/stats.tsx`; entry row on `ProfileScreen` ("This Week"); cards for volume (with unit conversion), sets vs plan, days trained, deltas vs previous week
- [x] Verify 3 (2026-07-04): tsc clean; simulator screenshot shows live data (1150 kg volume, 4/12 planned sets, 2 of 2 days, per-day bars); stats invalidation wired into all 4 logging mutations + staleTime 0 refetch on open

---

## Phase 4 — Body weight tracking (migration v11)

- [x] 4a: Generate Stitch design
- [x] 4b: Migration v11 (`src/core/database/migrations.ts`): create BodyWeightLogs table with timestamp and weight_kg columns + index
- [x] 4c: Repo methods: `logBodyWeight(weightKg, timestamp)`, `getBodyWeightHistory(limit)`, `deleteBodyWeight(id)`; hook `useBodyWeight` (key `['bodyweight']`)
- [x] 4d: Screen `src/features/settings/screens/BodyWeightScreen.tsx` + route `app/bodyweight.tsx`: log entry with current-unit input (convert to kg before insert), chart trend (reuse ProgressChart), list with swipe-delete
- [x] 4e: Add profile row entry linking to BodyWeightScreen
- [x] Verify 4 (2026-07-04): tsc clean; migration v11 verified on device (user_version=11); seeded entries render trend chart + deltas + delete; Opus review passed (no fixes) incl. single-pass kg conversion and chart edge cases

---

## Phase 5 — Set notes / RPE (migration v12)

- [x] 5a: Migration v12 (`src/core/database/migrations.ts`): add rpe (REAL, 1–10 range check) and note (TEXT) columns to WorkoutSets
- [x] 5b: Extend `appendSet`/`updateSet` with optional `rpe`, `note` params in repo (`src/features/workout/services/WorkoutRepository.ts`) and IWorkoutRepository; passthrough via useAutoSaveSet hook
- [x] 5c: `SetInputCard` (`src/features/workout/components/detail/`): collapsed-by-default "RPE / note" affordance (stepper 6–10 step 0.5, one-line note); do NOT send to watch
- [x] 5d: Show RPE badge + note in logged-sets list (ExerciseDetailScreen, HistoryScreen) when present
- [x] Verify 5 (2026-07-04): tsc clean; migration v12 verified on device (user_version=12); seeded set stores rpe=8 + note; RPE/Note toggle renders; Opus review passed (no fixes) incl. edit round-trip preserving rpe/note

---

## Phase 6 — Tests

- [x] 6a: Add `jest` + `jest-expo` to package.json, add `npm test` script
- [x] 6b: Unit tests for ImportService (parse, clean, validate, smart quotes, reps→repMin/repMax), catalog name normalization/matching, weekStartOf (Mon boundary, DST), progress utils, plate math, PR detection
- [x] Verify 6 (2026-07-04): `npm test` → 123 passed, 7 suites (ImportService, catalogMatch, weekStartOf, progress, repRange, plateCalculator, PR); tsc clean. Fixed jest/jest-expo to Expo-pinned ~29.7/~54; normalizeName improved to punctuation→space (verified real-catalog matches unchanged)

---

## Explicitly out of scope

- Session/log AI import — removed, not reworked.
- Export/share, PR notifications, templates/favorites, watch changes, `is_custom` cleanup, day_tag denormalization refactor — noted in review, deferred.
