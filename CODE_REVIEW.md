# Code Review Backlog — 2026-06-12

Verified findings from a full-project review. Each item is self-contained: pick one,
paste it into a Claude Code session, and it has enough context to execute.

**Verify any fix with:** `npx tsc --noEmit`, then
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device "iPhone 17"`
and screenshot (sim UUID `141CEEF5-8FCE-4A41-85AC-99C32CCA5CB4`).

---

## P1 — Real bugs (user-visible wrong behavior)

- [x] **Deleting a workout never decrements weekly progress.**
  `WorkoutRepository.deleteLog` (src/features/workout/services/WorkoutRepository.ts:165)
  only runs `DELETE FROM WorkoutLogs` — the `WeeklyProgress` counter keeps the deleted
  sets forever, so day cards stay ticked. `useDeleteLog`
  (src/features/workout/hooks/useWorkoutLogs.ts:52) also invalidates only `['history']`,
  not `['weekly']`.
  **Fix:** in a transaction, read the log's `day_tag`, `timestamp`, and set count before
  deleting; decrement `WeeklyProgress` for `(exercise_id, day_tag, weekStartOf(timestamp))`,
  clamping at 0. Add `['weekly']` invalidation to the hook.
  **Verify:** log 2 sets, delete the log from History, day card count must drop by 2.

- [x] **Editing an already-logged set silently discards the change.**
  `appendSet` uses `INSERT OR IGNORE` on `(log_id, set_order)`
  (src/features/workout/services/WorkoutRepository.ts:180). Re-completing a set with a
  different weight/reps shows the new values in the UI but keeps the old values in the DB.
  **Fix:** `ON CONFLICT(log_id, set_order) DO UPDATE SET reps = excluded.reps,
  weight = excluded.weight`. Keep the WeeklyProgress increment gated on a *new* row only
  (check `result.changes` semantics with DO UPDATE — an updated row also reports a change,
  so detect insert-vs-update explicitly, e.g. `SELECT changes()` vs a prior existence check).
  **Verify:** complete set 1 at 50 kg, re-open the exercise, re-complete set 1 at 55 kg,
  check `WorkoutSets` in the sim DB shows 55.

- [x] **Finishing a workout from the watch is lost if the phone is unreachable.**
  `sendFinishWorkout` (ios/TRAKWatch Watch App/WatchSessionManager.swift:38) only sends
  when `isReachable`, with no error handler. `sendLoggedSet` directly above it falls back
  to `transferUserInfo` on both failure paths.
  **Fix:** mirror `sendLoggedSet`: error handler + unreachable branch both call
  `fallbackTransfer(payload)`. The phone already handles queued `userInfo` deliveries.
  **Verify:** build to paired sims, kill the phone app, finish on watch, relaunch phone app.

## P2 — Inconsistencies (wrong in edge cases)

- [x] **History "This week" filter is actually "last 7 days".**
  `applyDateFilter` (src/features/history/screens/HistoryScreen.tsx:45) uses
  `now.getDate() - 6`, while every other weekly number in the app is Monday-anchored via
  `weekStartOf` (src/core/utils/date.ts). On a Friday, History "This week" includes last
  weekend; the day cards don't.
  **Fix:** `l.timestamp >= weekStartOf(Date.now())`.

- [x] **ProgressChart metric tab hardcodes "Max kg" for lbs users.**
  src/features/history/components/ProgressChart.tsx:26 — `label: 'Max kg'` is a
  module-level constant. Chart *values* convert correctly via `fromKg`; only this label lies.
  **Fix:** compute the label where `weightUnit` is in scope: `` `Max ${weightUnit}` ``.

- [x] **Live Activity can double-request on rapid successive rests.**
  `startRestActivity` (modules/live-activity/ios/LiveActivityModule.swift) checks
  `Activity.activities` then requests; two quick calls can both see zero active and create
  two lock-screen widgets.
  **Fix:** serialize through an actor or keep a module-level `currentActivity` reference
  instead of re-scanning `Activity.activities`.

## P3 — Dead/stale code (harmless today, traps tomorrow)

- [x] **`loggedSetsThisWeek` (src/features/workout/utils/progress.ts:8)** — exported,
  never called, and keyed by exercise only. If anyone wires it up it reintroduces the
  day-bleed bug fixed on 2026-06-12. Delete it.
- [x] **`WeeklyProgressRow` and `WeeklyEntry` (src/core/database/types.ts)** — unused
  types that no longer match the day-keyed schema. Delete or add `day_tag`.
- [x] **`useLogWorkout` + `WorkoutRepository.logWorkout`** — zero consumers, and the repo
  method writes neither `day_tag` nor `WeeklyProgress`, so wiring it up later silently
  breaks both. Delete, or fix to accept `dayTag` and update the counter.
- [x] **`ios/scripts/add_widget_target.rb`** — one-time scaffolding, already applied; still
  references the removed fastlane match profile. Delete.
- [x] **Widget display name** — `INFOPLIST_KEY_CFBundleDisplayName = TRAKWidgets` in
  ios/FitnessApp.xcodeproj (both widget configs). Shows as "TRAKWidgets" in Settings.
  Rename to `LIFTREPS`.

## Suggestions (not bugs)

- **No tests exist anywhere.** Highest-value, lowest-effort start: pure-function unit
  tests for `utils/progress.ts`, `utils/pr.ts`, plate math, and `weekStartOf` (timezone /
  Monday boundaries). Repository SQL is harder (expo-sqlite needs a device) — consider
  extracting query builders or testing against the sim DB in CI later.
- **`useAutoSaveSet` caches log IDs across midnight** (logIdRef never expires). A session
  spanning midnight keeps appending to yesterday's log. Low priority; clear the ref when
  the cached log's date != today.
- **StepperInput** snaps typed values to 0.5 increments on the next +/- tap (typed 7.25 →
  7.0). Acceptable stepper behavior, but worth a decision.

## Review notes

- Scanned: workout feature (screens/hooks/services/utils), history, import, core utils,
  watchOS Swift, Live Activity module, widgets. Agent-flagged candidates were verified
  against source; 12 of 16 were discarded as false positives (e.g. `useState(Date.now)`
  is a lazy initializer, not a bug; rest-timer negative drift is guarded by a completion
  latch; `Text(timerInterval:)` renders from the wall clock and cannot drift).
- Day-isolation schema change (migration v7) and the done-checkbox hydration were fixed
  and verified on-simulator the same day; Opus-reviewed, one import-path blocker found
  and fixed. See commit history.
