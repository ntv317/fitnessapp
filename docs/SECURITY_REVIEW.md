# Security Review — LIFTREPS Pro Gating (2026-07-07)

## 1. Threat Model

Local-only iOS fitness app with client-side paywall (RevenueCat entitlement `pro`). The attacker model is the device owner attempting to gain free Pro access via:
- Editing local storage or database
- Deep link manipulation
- File tampering

Accepted limitation: without a backend server, a determined owner can patch the binary. The goal is removing trivial bypasses, not implementing DRM. The security posture focuses on raising the bar above accidental or casual circumvention.

## 2. Findings and Resolutions

All critical and medium issues were identified and fixed the same day.

### CRITICAL — Spoofable Entitlement Cache
**Location**: `src/core/context/PremiumContext.tsx`

**Issue**: The `@fitness/isPro` flag was persisted in plaintext AsyncStorage, granting Pro status offline or when RevenueCat was unconfigured. An attacker could manually set this flag.

**Resolution**: 
- Removed the mirrored AsyncStorage flag entirely
- Entitlement now sourced exclusively from RevenueCat SDK, which maintains its own persisted CustomerInfo cache
- Legacy key purged on context mount
- Development override available via `DEV_FORCE_PRO` in `src/core/config/revenuecat.ts`, compiled out of release builds (guarded by `__DEV__`)

### CRITICAL — Deep-Link Bypass of Backup Paywall
**Location**: `src/features/backup/screens/BackupScreen.tsx` and `src/features/backup/hooks/useBackups.ts`

**Issue**: Deep link `trakfitness://backup` bypassed the Settings-row entitlement gate, allowing direct access to the backup feature.

**Resolution**:
- BackupScreen now redirects to `/paywall` when user lacks Pro entitlement
- `useCreateBackup` and `useRestoreBackup` hooks throw errors without entitlement
- Backup functionality is now unreachable without Pro status

### MEDIUM — Watch Inbound Ungated
**Location**: `src/features/workout/hooks/useWatchSync.ts`

**Issue**: Phone accepted workout data (logged sets) from the watch for non-Pro users, allowing Pro features to function after watch-side access.

**Resolution**:
- Watch sync listeners drop inbound payloads when entitlement is definitively non-Pro
- Listeners remain registered during entitlement resolution to prevent dropped sets during the transition window

### LOW — Unvalidated Backup File Names
**Location**: `modules/icloud-backup/ios/ICloudBackupModule.swift`

**Issue**: The native module did not validate backup file names before passing to iCloud APIs.

**Resolution**:
- `uploadBackup`, `downloadBackup`, and `deleteBackup` now reject:
  - Empty names
  - Names equal to `.` or `..` (directory traversal)
  - Names containing `/` (path separator)

## 2b. Reliability Findings (Opus deep review of the restore path, fixed same day)

- **HIGH — Non-atomic database swap**: `replaceDatabaseFile` deleted `fitness.db` before moving the restored file in; a crash between the two steps destroyed the database. Fixed: sidecars are removed first (already checkpointed by close), then the main file is swapped atomically via `FileManager.replaceItemAt` (`moveItem` fallback when no destination exists).
- **HIGH — Writes during restore**: in-flight repository mutations could hit the closed connection mid-swap. Fixed: `useRestoreBackup` suspends the repository (unmounting all consumers) before the swap and reopens on settle, so a failed restore also reopens the previous database.
- **MEDIUM — Restore/backup race**: auto-backup on backgrounding could snapshot and reopen the database during a restore. Fixed: a module-level restoring lock in `BackupService` makes `createBackup` fail fast and rejects concurrent restores.
- **MEDIUM — Watch lock unasserted when RevenueCat is unconfigured**: with an empty API key, `applyCustomerInfo` never ran and the watch kept its last `premiumRequired` state. Fixed: `PremiumContext` asserts the lock whenever entitlement cannot be positively confirmed.
- Verified safe by the same review: VACUUM INTO snapshot consistency and stale-snapshot handling, WAL sidecar cleanup, restore version guard and its staging-path resolution, migration-on-reopen for older backups, ubiquity-container calls kept off the main thread, and backup pruning order.

## 3. Checked and Found Safe

- **SQL queries**: All parameterized across WorkoutRepository, migrations, and AI import path (Zod-validated before parameterization)
- **VACUUM snapshots**: Uses app-constant paths only
- **Secrets**: RevenueCat public key is a placeholder (empty); no credentials committed
- **Feature gates**: Rest-timer override and progression hints correctly gated behind entitlement
- **Display-only surfaces**: Remaining Pro gates are in UI layers; bypass leaks no sensitive data

## 4. Data Protection Decisions

### Local Database
- Relies on iOS sandbox + default Data Protection class
- SQLCipher: not used (unsupported by expo-sqlite; breaks VACUUM INTO snapshots)
- NSFileProtectionComplete: not used (breaks background auto-backup)

### iCloud Backups
- Encrypted in transit and at rest via Apple's iCloud infrastructure
- Under Advanced Data Protection (user-enabled): end-to-end encrypted with on-device keys
- No app-layer encryption applied (reliance on Apple's guarantee)

## 4b. Follow-up Review (2026-07-07, second pass)

Full-app re-review. No new critical issues. Findings fixed same day:

- **MEDIUM — Watch cold-start unlock**: `WorkoutState.premiumRequired` defaulted to `false` and the watch never read `WCSession.receivedApplicationContext` at activation, so relaunching the watch app reset it to unlocked (phone still dropped inbound sets). Fixed: persisted context is applied in `activationDidCompleteWith` (with stale `isResting` stripped) and the default flipped to locked-until-confirmed.
- **LOW — Application-context clobbering**: `PremiumContext` (entitlement flag only) and `sendWorkoutState` (full snapshot, no flag) each replaced the whole `applicationContext` dict, so the persisted context only ever held one writer's keys. Fixed: `WatchSessionHandler` merges into the last-sent context (seeded from `WCSession.applicationContext`).
- **LOW — WeeklyProgress week mismatch**: `appendSet` credited the week of `Date.now()` while deletes debit the week of `log.timestamp`; a set appended just after a week rollover left a phantom count. Fixed: appends now use the log's week.
- **LOW — Migrations v5/v6 not re-entry safe**: a kill between those blocks and the final `PRAGMA user_version` bricked the DB on relaunch (duplicate table/column errors); v5's multi-statement rebuild was also non-transactional. Fixed: both blocks are guarded by index/column existence checks and run in transactions, matching v8/v9/v11.
- **LOW — Unbounded AI-import values**: Zod schema accepted arbitrarily long names and e.g. `sets: 1e9` (which becomes a progress denominator). Fixed: caps added (name ≤ 80, sets ≤ 20, reps ≤ 100, ≤ 30 exercises/day, ≤ 14 days).
- **LOW — getDatabase() race**: concurrent first calls could open two connections. Fixed: the open promise is memoized (reset on failure).
- **App Store risk — hardcoded paywall claims**: "SAVE 44%", "7-day free trial", and USD fallback prices were hardcoded. Fixed: trial badge derives from `introPrice`, savings computed from real package prices, and missing offerings show "—" with a disabled CTA instead of fake prices.

Hardening added in the same pass: a local `fitness-pre-restore.db` snapshot (VACUUM INTO) is taken before every restore swap so a mistaken restore is recoverable; the notification permission prompt moved from app launch to the first rest-timer start; undownloaded iCloud backups list as "In iCloud" instead of 0.0 MB.

## 5. Device Migration

- **Purchases**: Restored via RevenueCat `restorePurchases()` using Apple ID receipt; covers subscriptions and lifetime purchases
- **Workout data**: Restored via the iCloud backup feature
- **Creator device**: Uses RevenueCat promotional entitlement, not code-level bypass
