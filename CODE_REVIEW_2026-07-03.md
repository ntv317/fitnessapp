# Code Review — Library / Detail Redesign / Plans (Phases 1–3), 2026-07-03

Fable review of the full redesign diff (exercise library, exercise detail rewrite,
plans builder + tab restructure), including the fixes applied after the two earlier
Opus reviews. Each item is self-contained so a Sonnet session can pick it up directly.

**Verify any fix with:** `npm run type-check`, then Metro bundle
(`curl "http://127.0.0.1:8081/...entry.bundle...` or relaunch app on sim
`141CEEF5-8FCE-4A41-85AC-99C32CCA5CB4`, bundle id `io.liftr.app`) and screenshot.

---

## P1 — Real bugs (fix before shipping)

- [x] **1. Exercise detail ignores the plan's per-day target sets.**
  `ExerciseDetailScreen.tsx:315` computes
  `target = exercise.targetSets ...` where `exercise` comes from `useExercises()` →
  `getAllExercises()` (WorkoutRepository.ts:81), which selects only `Exercises.target_sets`
  and never joins `PlanExercises` — so `toExercise`'s `plan_target_sets ?? target_sets`
  override never applies here. The Log tab (via `getAllDays`) DOES use the plan's
  per-day `PlanExercises.target_sets`. Result: editing "Target Sets" in the Plan editor
  updates the Log tab card but NOT the logging screen — "N of target" label, watch
  `totalSets`, and the celebration threshold all keep using the stale base value.
  (Migrated data starts equal, so this only bites after the first plan edit.)
  **Fix:** in `ExerciseDetailScreen`, the day's plan-backed entry is already available:
  `dayExercises` (from `useAllDays()`, line ~305). Use
  `const planEntry = dayExercises.find((e) => e.id === exerciseId)` and prefer
  `planEntry?.targetSets` over `exercise.targetSets` when computing `target`.

- [x] **2. Silent data loss still reachable: stale log-id cache + swallowed save errors.**
  The Phase-2 fix (`resetLogCache`) only covers deleting today's last set *from the
  detail screen itself*. But `useDeleteLog` (History screen, `HistoryScreen.tsx`
  delete button) deletes the whole `WorkoutLogs` row while the detail screen may still
  be mounted underneath — its `useAutoSaveSet` `logIdRef` (useWorkoutLogs.ts:~95)
  still caches the dead id. Next "+" → `appendSet` hits the FK constraint → error is
  swallowed by `saveSet(...).catch(() => {})` (`ExerciseDetailScreen.tsx:433`) → UI,
  watch, rest timer, celebration all proceed but nothing persists.
  **Fix at the root, in `useAutoSaveSet.saveSet`:** on `appendSet` failure, drop the
  cached id, re-resolve via `getTodayLogId` (create if missing), retry once; if the
  retry also fails, rethrow. Then in `completeSet`, replace `.catch(() => {})` with a
  handler that resyncs the optimistic `todaySets` mirror from the server (invalidate
  history) and shows a brief error (existing undo-toast styling can be reused), so a
  real failure is never invisible.

- [x] **3. Celebration + auto-advance re-fires on every set at/above target — freeform
  extra sets are impossible.** `ExerciseDetailScreen.tsx:461`:
  `const allDone = todaySetsRef.current.length >= target` inside `endRest`. Once the
  target is met, EVERY subsequent rest-end celebrates again and `router.replace`s to
  the next exercise / summary. The approved plan said "freeform logging beyond target
  allowed, no second celebration."
  **Fix:** celebrate only on the crossing: keep a `celebratedRef = useRef(false)`
  (reset when `exerciseId` changes), and gate with
  `if (!celebratedRef.current && length >= target) { celebratedRef.current = true; ... }`.

- [x] **4. A fresh user's first plan is created inactive → Log tab stays empty with no
  path forward.** `WorkoutRepository.createPlan` (WorkoutRepository.ts:551) inserts
  `is_active = 0`. A new user (or anyone after `clearAllData`) creates a plan, builds
  days/exercises, opens Log → "No workout plan yet". Nothing hints at "Set Active".
  `deletePlan` already auto-promotes; creation should mirror it.
  **Fix:** in `createPlan`, after insert, if `SELECT COUNT(*) FROM Plans WHERE
  is_active = 1` is 0, set the new plan active (same transaction pattern as
  `deletePlan`).

---

## P2 — Should fix

- [x] **5. SetInputCard wipes in-progress typing when a background refetch lands.**
  `SetInputCard.tsx:59-68` reseeds `weightText`/`repsText` whenever
  `prefillWeightKg`/`prefillReps` change — and those change asynchronously when the
  history query resolves/refetches (most visibly: open screen, start typing while
  history is still loading; prefill arrives and replaces the user's input).
  **Fix:** add a `userEditedRef` set by the StepperInput `onChangeText` handlers and
  cleared when `loggedCount` or `editing` changes; skip the log-mode reseed while set.

- [x] **6. Unhandled promise rejections on UNIQUE violations in plan flows.**
  (a) `PlanListScreen.tsx` `handleCreate` — `createPlan.mutateAsync` throws on a
  duplicate plan name (`Plans.name UNIQUE`); the `Alert.prompt` callback is async with
  no try/catch → unhandled rejection, nothing happens for the user.
  (b) `AddExerciseSheet.tsx` `handleAdd` — `addPlanExercise.mutateAsync` throws when
  the exercise is already on that day (`UNIQUE(plan_day_id, exercise_id)`); sheet
  stays open, no feedback.
  **Fix:** wrap both in try/catch with an `Alert.alert` ("A plan with that name
  already exists" / "Already in this day"), and/or make `addPlanExercise` use
  `INSERT OR IGNORE` + report whether a row was inserted.

- [x] **7. Library "Start logging" / plan "Add Exercise" silently overwrites an existing
  same-named exercise's settings.** `upsertExercise`'s `ON CONFLICT(name) DO UPDATE`
  overwrites `default_rest_seconds` and `is_compound` unconditionally
  (WorkoutRepository.ts:~134). If the user already has an AI-imported "Bench Press"
  with a custom rest time and taps the catalog's "Bench Press", their rest
  time/compound flag is replaced by catalog defaults.
  **Fix:** for the library/plan-add call sites, preserve existing values on conflict —
  e.g. add an `ExerciseInput` flag (or pass `defaultRestSeconds: undefined`) that makes
  the upsert use `COALESCE`-style keep-existing semantics for those two columns, like
  it already does for `target_sets`/`catalog_id`.

- [x] **8. Sets logged via the library route never count toward weekly progress.**
  `LibraryExerciseScreen.handleStart/handleView` push `/exercise/[id]` with no `day`
  param → `dayTag = null` → sets save with `day_tag NULL` → `weeklyKey(id, null)`
  never matches the Log tab's `weeklyKey(id, dayName)`, even when that exercise IS in
  the active plan. User logs from the library, Log tab shows 0/N.
  **Fix (pick one, confirm with user):** resolve the exercise's active-plan day when
  no param is given (`exercise.dayTag` is already populated via `DAY_TAG_SQL` — pass it
  as the effective dayTag when `params.day` is absent), or explicitly treat
  library-launched sessions as freeform and surface that in the UI.

---

## P3 — Minor / polish / cleanup

- [x] **9. Watch gets one-set-stale suggested weight/reps during rest.** In
  `completeSet`, `pushWatchState(updated, true, rest)` uses the render-time closure's
  `prefillWeightKg/prefillReps` (computed for the set just logged, not the next one).
  Compute the next-set prefill from `updated` inside `completeSet` or re-push when
  rest starts from fresh state.
- [x] **10. Dead code:** `getExercisesByDay` / `useExercisesByDay` have zero consumers.
  Delete both (and the `IWorkoutRepository` entry) or leave a comment.
- [x] **11. `addPlanExercise` sort_order via `COUNT(*)` can duplicate after removals**
  (add A,B → remove A → add C ⇒ B and C both order 1); `reorderPlanExercises` with a
  partial id list likewise. Cosmetic (ties broken by id) — normalize orders on remove,
  or renumber the whole day on every write.
- [x] **12. `MuscleGroupListScreen` GROUP_ICONS are all the same `body-outline`
  placeholder** — the record is pointless as-is; either differentiate per group or
  collapse to a constant.
- [x] **13. `LibraryExerciseScreen` "Exercise not found" early return has no back
  button** — dead end if a stale deep link lands there.
- [x] **14. Catalog JSON (~0.8 MB) now parses on Log tab first render** —
  `WorkoutLogScreen` → `musclesForExercises` → `ExerciseCatalog` import chain defeats
  the "only import from library modules" deferral note in `ExerciseCatalog.ts`. Fine
  for now; if launch perf matters, lazy-`require` inside `musclesForExercises` and fix
  the stale comment.
- [x] **15. `startOfToday` memoized once per mount** (`ExerciseDetailScreen.tsx:318`) —
  a session left open across midnight attributes new sets to yesterday's log.
  Pre-existing pattern; recompute at log time if worth fixing.
- [x] **16. Product check: every AI import deactivates the user's current plan** —
  RESOLVED (user decision): each import now lands as its OWN plan ("AI Import",
  "AI Import 2", …) and becomes active, but no longer deletes the previous import;
  the user switches plans via Set Active in the plan list.

---

## Verified-good (don't re-investigate)

- v9 migration idempotency (re-run tested twice on a real DB copy), data integrity,
  and the live in-app migration on the simulator DB.
- `deleteSet` two-phase set_order compaction; `updateSet`; WeeklyProgress decrements.
- TanStack prefix invalidation (`['plans']` covers `['plans', id]`).
- `plan_target_sets` override inside `getAllDays`/`getExercisesByDay` (the gap is only
  `getAllExercises` — item 1).
- ProgressChart `bestReps` metric (no kg conversion applied to reps), default metrics
  unchanged for HistoryScreen.
- `dayColorForTag` determinism, `musclesForExercises` fallback, History "Other" grouping.
- Phase-2 fixes: PR detection vs `priorHistory`, setOrder-keyed optimistic mirror,
  synchronous `todaySetsRef` write, `resetLogCache` on detail-screen empty-delete.
