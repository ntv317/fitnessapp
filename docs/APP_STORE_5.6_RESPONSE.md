# App Review — Response & Plan of Improvements (Guideline 5.6)

> Draft statement for App Review / the Developer Code of Conduct restoration
> path. Guideline 5.6 (Developer Code of Conduct) lets a developer provide "a
> written statement detailing the improvements you plan to make"; if the plan
> is approved and the changes are confirmed, the account/app may be restored.
> Fill the bracketed fields, confirm every claim against the shipping build,
> then paste into the Resolution Center reply (or the new-app review notes).

---

**App:** LIFTREPS — Gym Workout Tracker
**Bundle ID:** io.liftr.liftreps (watch: io.liftr.liftreps.watchkitapp · widgets: io.liftr.liftreps.LIFTREPSWidgets)
**Submission ID / Version:** [FILL IN]
**Date:** [FILL IN]

## Summary

Thank you for the detailed feedback under Guideline 5.6. We take the quality
bar seriously and agree the previous build did not meet it. Rather than patch
only the surface complaint, we ran a comprehensive self-audit across the
guidelines — quality and consistency (5.6), metadata accuracy (2.3), and
purchase/completeness (2.1/3.1) — fixed every issue we found, and tightened our
pre-submission QA so the same classes of issue cannot recur. Below is exactly
what was wrong, what we changed, and how we now test.

## What we found and fixed

### 1. Language inconsistency — core screens were not localized

The app ships six localizations (English, Vietnamese, Thai, Russian, Simplified
Chinese, Traditional Chinese). Most of the app was translated, but the primary
workout-logging screen and its rest-timer, set-entry, and history components
were still rendering hardcoded English. A customer using the app in a
non-English language would move through a fully translated app and then hit an
English screen — a jarring, unfinished experience.

**Fixed:**
- The exercise-logging screen, rest-timer overlay, set-completion/celebration
  overlay, rest-complete notification, and all alerts/action sheets now route
  every string through the app's localization system.
- The set-input card, session-history list, and progress chart were localized
  as well.
- A second review pass caught three labels still showing English on the main
  log screen in Vietnamese/Thai/Russian (the "compound/isolation" exercise-type
  tags and a "volume" chip); these are now translated too.
- All strings are translated into all six supported languages, verified by an
  automated key-parity check.

### 2. Language inconsistency — Apple Watch companion

The watchOS companion had a small number of untranslated strings and a couple
of controls that bypassed localization, so the watch showed mixed
English/translated text in non-English locales.

**Fixed:** every user-visible string in the watch app is now translated into
all six languages, and the two controls that bypassed the string catalog were
corrected.

### 3. Brand inconsistency — leftover "TRAK" name on the watch

The product is named **LIFTREPS** everywhere, but three watch screens still
displayed an earlier internal codename ("TRAK") as their wordmark. This looked
like a leftover from a different app.

**Fixed:** the watch wordmark now reads **LIFTREPS** on every screen, and the
stale codename was removed from the localization catalog.

### 4. Metadata accuracy — privacy claims vs. the iCloud backup feature

Our website and privacy policy stated the app used "no cloud" and that data
"never leaves your device." In fact the app offers an on-by-default backup of
its local database to the user's **own private iCloud** (the app's iCloud Drive
container). No data is ever sent to any server we operate, and nothing is
collected by us — but the blanket "never leaves your device" wording was
inaccurate.

**Fixed:** the privacy policy now has a dedicated iCloud-backup section, and the
privacy policy, marketing site, README, and App Store description draft were
reworded to state the truth precisely — no accounts, no servers of ours, no data
collection, with an optional backup to the user's own private iCloud. The
"Data Not Collected" App Privacy label remains correct for this build.

### 5. Purchase surface — a disabled paywall could still be reached

This build ships entirely free: every feature is unlocked and there is no
purchase UI in the normal flow. However, the (disabled) paywall screen was still
reachable via a URL scheme and would have rendered placeholder prices and a
non-functional button.

**Fixed:** the paywall route now redirects to the app when purchases are
disabled, so no non-functional purchase screen is reachable. We have also
documented that this version is submitted as **Free with no in-app purchases
attached**, so the app's purchase configuration matches what the binary
actually presents.

## How we verified

- Two independent full-codebase review passes (quality/localization, then
  metadata/completeness/privacy).
- Static type check (TypeScript) passes clean.
- Full automated test suite passes (207 tests).
- Localization key parity verified programmatically across all six language
  catalogs — no missing keys, no untranslated leaks.
- [FILL IN — required before resubmission] Manual pass on device/simulator in
  each of the six languages, on the smallest and largest supported iPhone and
  on Apple Watch, capturing screenshots of the workout, rest-timer, summary,
  history, and watch screens.

## How we're preventing recurrence

1. **Localization is part of our definition of done.** No screen ships until
   every visible string is in the catalog; an automated key-parity check across
   all six languages runs before every submission.
2. **Device- and language-matrix QA before submission.** Each release is
   exercised end-to-end in all six languages across the iPhone size range and
   on Apple Watch, not English-only.
3. **No placeholder or codename content.** We audit the project for placeholder
   text, stale internal names, and unreachable/half-finished screens; this is a
   pre-submission checklist item.
4. **Claims must match behaviour.** Privacy policy, App Privacy label, and
   marketing copy are reviewed against the actual data flows every release, so
   what we say always matches what the app does.
5. **Store configuration matches the binary.** Our submission checklist verifies
   the in-app-purchase and pricing configuration in App Store Connect matches
   the purchase surface the build actually presents.

We're committed to delivering a polished, consistent, reliable, and accurately
described experience on every supported device and language, and we appreciate
the review team's time.

[Your name / team]
[Contact]
