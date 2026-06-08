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

## Coding Behaviour

**Think before coding.**
State assumptions explicitly. If multiple interpretations exist, surface them — don't pick silently. If something is unclear, stop and ask before writing a line.

**Simplicity first.**
Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible scenarios. If it could be 50 lines, don't write 200.

**Surgical changes.**
Touch only what the task requires. Don't improve adjacent code, reformat, or refactor things that aren't broken. Match existing style. Remove imports/variables made unused by *your* changes; leave pre-existing dead code alone unless asked.

**Goal-driven execution.**
Before multi-step tasks, state a brief plan with a verifiable check per step. Run TSC, build, and screenshot after every non-trivial change. Don't report done until verified.

## Design

**Use Stitch** (MCP: `mcp__stitch__*`) for any new screen or significant UI redesign **before** writing code:
1. Call `mcp__stitch__generate_screen_from_text` with the project ID `11182437524249099917` and design system `assets/046e64142ae3494c82599ce53615374d`
2. Review the generated screenshot to validate layout and visual hierarchy
3. Implement in React Native matching the Stitch output — dark background, Kinetic Mono tokens, brick-orange primary

Always generate Stitch designs for: new screens, redesigned cards, onboarding flows, celebration/summary states.

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
