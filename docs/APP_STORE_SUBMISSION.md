# LIFTREPS — App Store Submission Guide

Everything needed to ship v1.0. Items marked **[YOU]** need your Apple ID /
App Store Connect access; everything else is done or scripted.

## Current state

| Item | Status |
|------|--------|
| Bundle IDs | `io.liftr.app` + `io.liftr.app.watchkitapp` + `io.liftr.app.LIFTREPSWidgets` |
| Version / build | 1.0 (build 2) |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` already set |
| App icon | 1024px dumbbell mark in `Images.xcassets` — done |
| Launch screen | Brand background `#FCF9F8` + centered logo — fixed July 5 |
| Privacy policy | Live at https://ntv317.github.io/fitnessapp/privacy-policy.html |
| Data collection | None — all data on-device SQLite |

## 1. Archive & upload **[YOU]**

Do this in Xcode (signing needs your Apple ID):

1. Open `ios/FitnessApp.xcworkspace` (not the .xcodeproj).
2. Select the **FitnessApp** scheme, destination **Any iOS Device (arm64)**.
3. For each of the three targets (FitnessApp, TRAKWatch Watch App, TRAKWidgets):
   Signing & Capabilities → team selected, "Automatically manage signing" on.
   The watch + widget targets must use App Store profiles for their own bundle IDs.
4. Product → Archive.
5. Organizer → Distribute App → App Store Connect → Upload.
6. If the upload complains about the Live Activity: confirm TRAKWidgets has the
   Push Notifications capability OFF (we only use local Live Activities) and
   `NSSupportsLiveActivities` is in the main app's Info.plist.

Known caveat from earlier CI work: the match/profile setup had issues when CI
was removed — if automatic signing fights you on the watch target, delete the
stale profiles in Xcode → Settings → Accounts and let it regenerate.

## 2. TestFlight pass **[YOU]**

Before submitting for review, run one full workout on your physical iPhone +
Watch from the TestFlight build (NOT a dev build): plan day → log sets →
rest timer + Live Activity on lock screen → watch sync → summary. The sim
and your real watch have diverged before.

## 3. App Store Connect metadata **[YOU — drafts below]**

ASO note: App Store search ranks the **name** heaviest, then **subtitle**,
then the hidden **keyword field**. Never repeat a word across the three —
Apple combines them, so every duplicate wastes a slot.

- **Name (30 chars max):** `LIFTREPS: Gym Workout Tracker` (29)
- **Subtitle (30 chars max):** `Lifting log & rest timer` (24)
- **Keyword field (100 chars max, no spaces after commas):**
  `strength,training,weight,barbell,dumbbell,reps,routine,planner,split,bodybuilding,powerlifting,5x5` (98)
- **Category:** Health & Fitness
- **Age rating:** 4+ (nothing objectionable)
- **Price:** Free (or your call)

**Description draft:**

> LIFTREPS is a no-nonsense workout logger for people who lift.
>
> Log sets in two taps, follow your weekly split, and let the rest timer run
> on your lock screen and Apple Watch — no account, no ads, no tracking. Your
> data stays on your device, with an optional backup to your own private iCloud.
>
> - Fast set logging with weight/rep steppers and plate-per-side breakdown
> - Rest timer with Live Activity on the lock screen and a watchOS companion
> - Weekly split tracking with per-day progress
> - Progress charts per exercise: weight, reps, and estimated performance
> - 870+ exercise library with photos and step-by-step instructions
> - Import a full training plan as JSON (works great with AI-generated plans)
> - Per-set RPE and notes, body-weight tracking, kg/lb support
> - Offline-first: everything is stored on your iPhone, with optional backup to your own private iCloud

- **Keywords (100 chars):**
  `workout,log,lifting,gym,tracker,sets,reps,barbell,rest timer,strength,plan,routine,progress`
- **Support URL:** https://github.com/ntv317/fitnessapp (or a dedicated page)
- **Privacy Policy URL:** https://ntv317.github.io/fitnessapp/privacy-policy.html

**App Privacy questionnaire:** select **"Data is not collected"** for
everything. The only network traffic is exercise images from a public CDN
(jsDelivr) with no identifiers — that does not count as data collection.
(The optional iCloud backup writes to the user's own private iCloud container,
not to us, so it is not "data collection" either.)

**In-App Purchases: submit as Free with NO IAPs attached.** The paywall ships
disabled (`PAYWALL_ENABLED = false`), so every feature is free and no purchase
UI appears anywhere in the app. The RevenueCat products
(`io.liftr.app.pro.monthly/yearly/lifetime`) must be left **unattached** to this
version in App Store Connect. Attaching them would send a reviewer looking for an
in-app purchase that no screen surfaces — a guaranteed Guideline 2.1 rejection.

**App Review Notes (paste into the "Notes" field):**

> This build is fully free — all features are unlocked, and there are no in-app
> purchases in the user flow.
>
> Apple Watch companion: launch the iPhone app once first. On first run the phone
> activates the paired watch app (over WatchConnectivity); opening the watch app
> before the iPhone app shows a brief "open on your iPhone" prompt by design.

## 4. Screenshots **[YOU + Claude can generate]**

Required: one set at **6.9"** (1320×2868, e.g. iPhone 17 Pro Max sim) — other
sizes scale from it. Watch screenshots recommended since the watch app is a
selling point (410×502 for Ultra).

Suggested five: ① Log tab with the weekly split, ② exercise screen with image
+ set input, ③ progress chart, ④ full-screen rest timer, ⑤ watch logging
screen. Ask Claude to boot the right sims and capture these.

## 5. Discoverability beyond App Store search

Done (July 5):
- Landing page at https://ntv317.github.io/fitnessapp/ with meta description,
  OpenGraph tags, and Schema.org `MobileApplication` + `FAQPage` JSON-LD —
  this is what Google and AI assistants (ChatGPT/Claude/Perplexity search)
  crawl and cite when someone asks for "offline workout tracker iOS".
- README rewritten with a product-facing header (GitHub is heavily crawled
  and used for retrieval by AI search).

After launch **[YOU]**:
- Add the real App Store link to the landing page badge, README, and an
  `og:image` screenshot.
- Submit to directories AI models cite: Product Hunt, AlternativeTo,
  r/weightlifting or r/fitness app threads. A handful of quality backlinks
  is what moves both Google and AI-assistant answers.
- Prompt for ratings after a finished workout (`SKStoreReviewController`) —
  rating count is a strong App Store ranking factor.

## 6. Post-launch recommendations

- **Crash reporting:** add `@sentry/react-native` (needs a free Sentry account
  + DSN) — currently there is zero visibility into field crashes.
- **Image resilience:** exercise photos hotlink jsDelivr; `expo-image` caches
  them after first view, but consider bundling the ~40 most common exercises'
  images if reviews mention missing pictures offline.
- **Reviewer note (App Review Information):** mention that the AI Import
  feature parses user-pasted JSON and makes no network calls, and that a plan
  can also be created manually in the Plans tab.
