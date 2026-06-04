# TRAK FitnessApp — Claude Code Instructions

## Stack
- Expo SDK 54 / React Native 0.81, TypeScript, expo-router (file-based)
- SQLite via expo-sqlite, TanStack Query for all data fetching
- WatchOS companion via native WatchSync module (custom JSI bridge)
- Design tokens: `Colors`, `Spacing`, `Radius`, `Fonts` from `@/core/theme`
- UI primitives: `AppText`, `UnitToggle`, etc. from `@/core/ui`

## Hard Rules
- Weight stored as **kg** in DB; convert with `toKg()` / `fromKg()` at display only
- Rest times: compound = 150s, isolation = 75s (enforced in WorkoutRepository)
- Never import expo-sqlite or WorkoutRepository directly in screens — use hooks
- No comments unless the WHY is non-obvious
- No emojis in code or output unless asked

## Agent Strategy

**Default (main session / Sonnet):** use for all normal coding tasks.

**Spawn Haiku** (`model: "haiku"`) for mechanical, parallel work:
- Writing or updating markdown / docs
- Reading and summarizing multiple files
- Searching for patterns across many files
- Applying the same mechanical change (rename, reformat, add import) across 5+ files
- Generating repetitive boilerplate from a clear template
- Writing tests for already-designed functions
Always verify Haiku's code output in the main session before reporting done.

**Spawn Opus** (`model: "opus"`) only for:
- Architecture decisions with significant trade-offs
- Complex multi-symptom bugs that require deep reasoning
- Reviewing large / risky changes (DB schema, WatchSync protocol, auth, 10+ files touched)

**Review policy (scale with risk):**
- 1-3 files, simple fix → no separate review; Sonnet is accurate enough
- New feature, 4-10 files → main session self-checks before reporting done
- Large refactor, DB/schema/WatchSync changes → spawn Opus to review
- Haiku wrote any code → always verify in main session before reporting done

When a task has 3+ truly independent subtasks, run Haiku agents in parallel
and synthesize results in the main session.
