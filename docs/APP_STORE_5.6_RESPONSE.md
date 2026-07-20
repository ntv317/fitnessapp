# App Review — Response & Plan of Improvements (Guideline 5.6)

> Draft statement for App Review / the Developer Code of Conduct restoration
> path. Guideline 5.6 (Developer Code of Conduct) lets a developer provide "a
> written statement detailing the improvements you plan to make"; if the plan
> is approved and the changes are confirmed, the account/app may be restored.
> Fill the bracketed fields, confirm every claim against the shipping build,
> then paste into the Resolution Center reply (or the new-app review notes).

---

**App:** LIFTREPS — Gym Workout Tracker
**Bundle ID:** io.liftr.app (watch: io.liftr.app.watchkitapp · widgets: io.liftr.app.LIFTREPSWidgets)
**Submission ID / Version:** [FILL IN]
**Date:** [FILL IN]

## Summary

Thank you for the detailed feedback under Guideline 5.6. We take the quality
bar seriously and agree the previous build did not meet it. We identified the
specific inconsistencies that made the app feel unfinished in places, fixed
them, and have tightened our pre-submission QA so the same class of issue
cannot recur. Below is exactly what was wrong, what we changed, and how we now
test.

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
- All strings are translated into all six supported languages.

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

## How we verified

- Static type check (TypeScript) passes clean.
- Full automated test suite passes (207 tests).
- Localization key parity verified programmatically across all six language
  catalogs — no missing keys.
- [FILL IN — required before resubmission] Manual pass on device/simulator in
  each of the six languages, on the smallest and largest supported iPhone and
  on Apple Watch, capturing screenshots of the workout, rest-timer, summary,
  history, and watch screens.

## How we're preventing recurrence

1. **Localization is now part of our definition of done.** No screen ships
   until every visible string is in the catalog; we run an automated key-parity
   check across all six languages before every submission.
2. **Device- and language-matrix QA before submission.** Each release is
   exercised end-to-end in all six languages across the iPhone size range and
   on Apple Watch, not English-only.
3. **No placeholder or codename content.** We audited the project for
   placeholder text and stale internal names and removed what we found; this
   audit is now a pre-submission checklist item.

We're committed to delivering a polished, consistent, reliable experience on
every supported device and language, and we appreciate the review team's time.

[Your name / team]
[Contact]
