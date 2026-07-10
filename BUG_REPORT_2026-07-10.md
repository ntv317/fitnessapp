# Bug Report — Whole-Project Review, 2026-07-10

Findings from a 5-domain parallel review (data layer, hooks/state, screens/UI,
WatchSync/Swift, services/utils), verified against source. Each item is
self-contained so a fresh session can pick it up directly without any prior
conversation context.

**Baseline at time of writing:** `npx tsc --noEmit` clean, `npx jest` 200/200
passing (11 suites), ESLint has no config in this repo (pre-existing, not a
regression).

**Verify any fix with:**
- `npx tsc --noEmit`
- `npx jest`
- Repository-level fixes must extend the real-SQLite harness tests in
  `src/__tests__/workoutRepository.runtime.test.ts` (harness:
  `src/__tests__/helpers/realDb.ts`).
- UI/watch items: relaunch on simulator `141CEEF5-8FCE-4A41-85AC-99C32CCA5CB4`,
  bundle id `io.liftr.app`, and screenshot.
- Watch items additionally need the watchOS simulator or a physical
  Apple Watch — WCSession behavior (application context vs. live message,
  cold start) does not fully reproduce on the phone simulator alone.

**Project rules the fixer must respect:**
- Weight stored as **kg** in the DB; convert with `toKg()` / `fromKg()` at
  display only.
- Rest times: compound = 150s, isolation = 75s.
- Never import `expo-sqlite` or `WorkoutRepository` directly in screens — use
  hooks.
- Drizzle ORM for single-statement queries; raw `db` for multi-statement
  transactions.
- All user-facing strings go through i18n (en/vi/th/ru).
- No comments unless the WHY is non-obvious.
- Surgical changes only — don't refactor adjacent code.

---

## P1 — Confirmed HIGH

- [x] **1. Watch "Finish Workout" is silently dropped.**
  `modules/watch-sync/ios/WatchSyncModule.swift:87-88` emits `onFinishWorkout`
  on the JS event bridge, and it's declared in the native module's type at
  `modules/watch-sync/index.ts:17`. But `src/features/workout/hooks/useWatchSync.ts`
  only wires listeners for `onSetLogged` and `onSkipRest` — there is no
  `onFinishWorkout` subscriber anywhere in `src/`. Tapping "Finish Workout" on
  the watch does nothing on the phone.
  **Fix:** add an `onFinishWorkout` option to `useWatchSync` following the
  existing ref-based listener pattern used for `onSetLogged`/`onSkipRest`
  (`useWatchSync.ts:51-64`, `76-82`: a `useRef` holding the latest callback,
  subscribed once via `WatchSync.addListener`), then pass a callback from
  `ExerciseDetailScreen` that runs the same finish-workout flow as the
  in-app button.

- [x] **2. Non-Latin exercise names collide, rejecting every second custom exercise.**
  `normalizeName` (`src/features/import/services/catalogMatch.ts:5-12`) does
  `.replace(/[^a-z0-9\s]/g, ' ')` — for a name with no ASCII letters (e.g.
  Cyrillic "Жим лёжа", Thai, or accented Vietnamese) this strips every
  character, leaving `""`. `checkNameAvailable`
  (`src/features/workout/services/WorkoutRepository.ts:296-302`) compares
  `normalizeName(candidate) === normalizeName(existing)`; once two non-Latin
  names both normalize to `""`, the second one is always flagged as taken.
  `ExerciseFormScreen.tsx:145` surfaces this as `nameTaken` on save. The same
  empty-string collapse also guts AI-import matching for vi/th/ru names in
  `catalogMatch.ts`.
  **Fix:** reuse the existing diacritic-folding approach already used for
  search, `fold()` in `src/features/library/services/ExerciseCatalog.ts:90-92`
  (`s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')`).
  Change `normalizeName` to fold diacritics/combining marks instead of
  deleting non-ASCII letters outright, so Cyrillic/Thai characters survive
  normalization instead of collapsing to empty. Add runtime tests with
  Cyrillic, Thai, and Vietnamese exercise names to
  `workoutRepository.runtime.test.ts`.

- [x] **3. kg↔lb round-trip drifts the stored weight on note-only edits.**
  `UnitContext.tsx:94-95`: `fromKg` rounds to the nearest 0.5 lb
  (`roundHalf(kg * LB_PER_KG)`), but `toKg` converts back exactly
  (`v * KG_PER_LB`) — the pair is not a true inverse in lb mode.
  `SetInputCard.tsx:73` seeds `weightText` from the lossy `fromKg(editing.weightKg)`
  when opening the edit form. `SetInputCard.tsx:121` always recomputes
  `typedWeightKg = toKg(parseFloat(weightText) || 0)`, and `handlePrimary`
  (`:130-140`) always passes `typedWeightKg` to `onUpdate` at `:136` —
  regardless of whether the user touched the weight field. Scenario: user in
  lb mode opens a 100 kg set (displays as 220.5 lb rounded), edits only the
  note, taps save — the set is rewritten as `220.5 lb → kg` ≈ 100.017 kg
  instead of 100. This breaks exact-weight grouping (`weight === topWeight`)
  in `src/features/workout/services/progression.ts:29-30` and PR detection in
  `pr.ts`.
  **Fix:** `SetInputCard` already tracks `touchedSinceSeedRef` (set on any
  weight/reps keystroke, `:66`, `:97`). In `handlePrimary`, when `editing` and
  `!touchedSinceSeedRef.current`, pass `editing.weightKg` (the original,
  untouched value) instead of the round-tripped `typedWeightKg`.

- [x] **4. `useClearHistory` / `useClearAllData` never invalidate `['weekly']`.**
  `src/features/workout/hooks/useExercises.ts:121-125` (`useClearHistory`) and
  `:135-140` (`useClearAllData`) invalidate `exercises`/`history`/`stats`
  (and `bodyweight` for the latter) but not `weekly` — every log mutation in
  `useWorkoutLogs.ts` (e.g. lines 55-57, 71-73, 86-88, 138-140) invalidates
  `history`/`weekly`/`stats` together. After clearing history or all data,
  the Log tab's weekly progress ring keeps showing stale counts until an
  unrelated refetch happens to touch it.
  **Fix:** add `qc.invalidateQueries({ queryKey: ['weekly'] })` to both
  `onSuccess` handlers.

---

## P2 — Confirmed MEDIUM

- [x] **5. Rest timer: notification double-fire + inactive/background elapsed handling.**
  `src/features/workout/hooks/useRestTimer.ts:109-141`. The `AppState`
  listener treats both `'background'` and `'inactive'` as the same "leaving"
  branch (`:111`), calling `scheduleNotif(cur)` on each. iOS commonly
  transitions `active → inactive → background` on a single backgrounding
  event (e.g. Control Center, incoming call), so `scheduleNotif` can fire
  twice for one rest period, scheduling duplicate notifications. Separately,
  only `next === 'active'` (`:121`) reconciles elapsed time and resumes
  ticking — if the app is ever observed going directly to `'inactive'` without
  a following `'active'` in between (some interruption flows), the timer
  state and the scheduled notification can disagree on remaining time.
  **Fix:** track a `hasLeftRef` boolean set on first entry to
  background/inactive and cleared on `'active'`; only call `scheduleNotif`
  when `!hasLeftRef.current`, then set it. Treat `'inactive'` from a
  `hasLeftRef.current === true` state as a no-op (already scheduled/reconciled).

- [x] **6. `priorSession` is not scoped by `dayTag`, unlike `todayLog`.**
  `ExerciseDetailScreen.tsx:388` computes `todayLog` filtering on both the
  time window and `(l.dayTag ?? null) === dayTag`. `:389` computes
  `priorSession = history.find((l) => l !== todayLog)` with no `dayTag`
  filter at all. For an exercise logged on multiple plan days (or once via a
  plan day and once freeform), the "prior session" shown for progression /
  prefill can come from the wrong day, showing weights/reps that don't match
  the day the user is actually on.
  **Fix:** filter `priorSession` by the same `(l.dayTag ?? null) === dayTag`
  condition used for `todayLog`.

- [x] **7. `useAutoSaveSet` can create duplicate logs under concurrent calls.**
  `src/features/workout/hooks/useWorkoutLogs.ts:102-140`. `resolveLogId`
  (`:107-116`) reads `logIdRef.current.get(cacheKey)`, and if absent, calls
  `getTodayLogId` then `createLog` if that's also empty. `saveSet` (`:118-140`)
  only consults the ref synchronously before awaiting `resolveLogId` — two
  near-simultaneous `saveSet` calls for the same exercise/day (e.g. rapid
  double-tap, or the watch and phone both logging within the same tick) can
  both observe an empty `logIdRef` and both fall through to `createLog`,
  producing two `WorkoutLogs` rows for what should be one session.
  **Fix:** add an in-flight promise guard — store the `resolveLogId()`
  promise itself in a second ref keyed by `cacheKey`, and have concurrent
  callers await the same in-flight promise instead of independently calling
  `resolveLogId`.

---

## P2 — Agent-verified MEDIUM (watch runtime — validate on watchOS sim/device)

- [x] **8. Live `didReceiveApplicationContext` bypasses staleness/isResting guards.**
  `WatchSessionManager.swift`'s cold-start path (`:142-158`) clears
  `isResting` and discards contexts older than 4 hours, keeping only the
  premium lock. The live delegate callback `didReceiveApplicationContext`
  (`:161-163`) calls `self.applyUpdate(context)` directly with no such
  guards — a context pushed while the watch app is already running can
  resurrect a stale `isResting` state or an old snapshot without the
  4-hour staleness check.
  **Fix:** route `didReceiveApplicationContext` through the same
  staleness/`isResting`-reset logic used at cold start (extract it into a
  shared helper) instead of calling `applyUpdate` directly.
  **Landed fix note:** only the 4h-staleness discard was shared to the live
  path — the `isResting = false` force stays cold-start-only.
  `WatchSyncModule.swift`'s `updateState` pushes every state via both
  `sendMessage` (live, unsanitized) and `updateApplicationContext`
  (coalesced), so sharing the `isResting` force to the live path would have
  stomped a genuine live `isResting: true` moments after it arrived via the
  message channel, breaking rest-timer starts. Caught by Opus review before
  landing.

- [x] **9. Phone never pushes an idle snapshot when a workout ends.**
  `ExerciseDetailScreen.tsx:514-517` (cleanup on unmount) only calls
  `stopRestActivity()` / `cancelRestNotification()`; the finish-and-navigate
  path at `:628-637` (after a workout completes, before `router.replace` to
  summary or back) never pushes an "idle" watch state. Combined with the
  4-hour cold-start staleness window in bug #8, a watch that cold-starts
  within 4 hours of a finished workout re-displays the last in-progress
  state instead of idle.
  **Fix:** push an idle/finished watch state (via the existing
  `updateState`/`pushWatchState` mechanism) at the point the workout summary
  navigation fires, before `router.replace`.

- [x] **10. Import stance/grip tie-break picks "Seated" purely alphabetically.**
  `src/features/import/services/catalogMatch.ts` `MINOR_EXTRAS` (`:37-41`)
  allow-lists `'seated'` and `'standing'` as equally "minor" extras. When an
  AI-imported name and two catalog candidates differ only by one of these
  words (e.g. "Seated Row" vs "Standing Row" both matching a bare "Row"
  query), the matcher's ranking has no tie-break preference between them
  beyond incidental ordering, so it can silently pick the wrong variant.
  **Fix:** needs a deliberate tie-break rule (e.g. prefer the catalog's
  canonical/most-common variant, or require an exact stance match when the
  AI payload specifies one) — flagging for product/logic decision rather than
  a blind fix.
  **Landed fix:** removed `'seated'`/`'standing'` from `MINOR_EXTRAS` instead
  of adding new tie-break logic — they don't meet the set's own documented
  bar ("same movement, same muscle group": seated vs. standing changes
  muscle emphasis). Now `findStrictMatch` correctly returns no match instead
  of arbitrarily picking one, consistent with the file's stated philosophy
  ("a miss is safer than a wrong link").

---

## P3 — Design question (not a blind fix)

- [x] **11. PR detection is e1RM-only and can mask true weight PRs.**
  `src/features/workout/services/pr.ts:8-19`: `detectPR` compares estimated
  1RM (`est1RM`, `:3-6`) between the current session's best set and history's
  best set. A genuine weight PR can score lower on e1RM than a higher-rep set
  at less weight (e.g. 100kg×5 → e1RM 116.7 vs. an old 80kg×20 → e1RM 133.3):
  the heavier top-weight set is real progress but won't trigger the
  celebration. This is a product decision (what counts as a "PR" —
  weight-at-a-given-rep-range vs. pure e1RM) before any code changes.
  **User decision:** add a weight-based check alongside e1RM. **Landed fix:**
  `detectPR` now also fires when a current set's weight beats the heaviest
  weight ever lifted for at least that many reps (the comparable prior
  best) — catches the 100kg×5-after-80kg×20 case. Only fires when a
  comparable prior set exists, so a rep range never attempted before doesn't
  auto-PR.

---

## P4 — Low / latent (grouped)

- [ ] **i18n gaps — DEFERRED, not fixed this pass.** Some user-facing strings
  in `ExerciseDetailScreen.tsx`, `SetInputCard.tsx`, and `SessionHistoryList`
  are not routed through i18n — audit for hardcoded English and move to the
  en/vi/th/ru catalogs. Also see the very literal case below (now moot,
  `LogSetRow.tsx` was deleted as dead code). On closer look this is bigger
  than a P4 item — `ExerciseDetailScreen.tsx` has *zero* `t()`/i18next usage
  at all (the REST overlay, "Rest Timer" action sheet, "Set not saved" alert,
  the rest-complete notification). Full audit-and-translate-into-4-languages
  job; recommend a dedicated follow-up pass rather than folding it into a
  bug-fix batch.
- [x] **Watch LOG SET has no debounce.** `ActiveTrackingView.swift:202-205`
  `logSet()` sends immediately on tap with no debounce/disable-while-in-flight
  guard — a fast double-tap on the watch's small button can log two sets.
  **Fix:** added a 0.6s time-based guard.
- [x] **`useLastSession` is unused.** `src/features/workout/hooks/useLastSession.ts:9`
  has no callers anywhere in `src/` — dead code, safe to delete. **Deleted.**
- [x] **Dead components with a stale hardcoded unit.** `src/features/history/components/LogCard.tsx`,
  `src/features/workout/components/ExercisePicker.tsx`, and
  `src/features/workout/components/LogSetRow.tsx` have zero importers
  (confirmed via repo-wide grep) — delete all three. `LogSetRow.tsx:34` also
  hardcodes the label `"kg"` regardless of the user's unit setting, so it's
  doubly stale if ever resurrected. **All three deleted.**
- [ ] **`DatabaseLifecycleContext` no-op defaults — SKIPPED, not a real bug.**
  `src/core/context/DatabaseLifecycleContext.ts:10-13` defaults
  `suspendDatabase`/`reloadDatabase` to `() => {}`. If a consumer of
  `useDatabaseLifecycle()` ever mounts outside the real provider, restore
  operations silently no-op instead of failing loudly. Re-confirmed this only
  matters if the provider tree changes — no action taken.
- [x] **`useRestoreBackup` reloads the DB even when blocked by the Pro gate.**
  `src/features/backup/hooks/useBackups.ts:41-59` (`useRestoreBackup`).
  **Correction on re-verification:** the `!isPro` throw already ran *before*
  `suspendDatabase()` (not after, as originally described) — but `onSettled`
  still unconditionally called `reloadDatabase()` even though nothing was
  suspended for a blocked attempt. **Fix:** added a `suspendedRef`, set only
  when `suspendDatabase()` actually runs, gating the `reloadDatabase()` call
  in `onSettled`.
- [x] **Stale `default_rest_seconds 90` default in migrations.**
  `src/core/database/migrations.ts:18` — the column default is 90s but the
  app's actual rest-time rule is 150s compound / 75s isolation (enforced in
  `WorkoutRepository`, not by this column default). Cosmetic; the default is
  effectively unused since the repository always supplies an explicit value.
  **Fix:** changed default to 150 and corrected the adjacent comment (it said
  "90s for isolation", stale against the real 75s rule).
- [ ] **`realDb.ts` lazy-run shim fragility.** `src/__tests__/helpers/realDb.ts`
  — the real-SQLite test harness works but its lazy-init pattern is fragile
  to reordering; no action needed now, just a note for whoever next edits
  it.

---

## Clean areas (don't re-audit)

Drizzle conversion (all four batches), schema/migrations correctness,
multi-statement transaction boundaries, week-boundary math, plate calculator,
i18n plural forms and key parity across en/vi/th/ru, backup atomicity
(swap-then-reload sequencing), WCSession threading and native/JS fallback
paths, watch↔phone bridge unit handling (kg canonical end-to-end), navigation
param passing, list `key` usage, and the screen-level rule against importing
`expo-sqlite`/`WorkoutRepository` directly (verified with a repo-wide grep —
no violations found).
