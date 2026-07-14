# LIFTREPS — App Store Readiness Audit

_Generated 2026-07-12 · Target: iOS App Store first submission (v1.0.0, build 2)_

## Verdict

The **build/config layer is in good shape**. Versions aligned to 1.0.0 and the build number
bumped to **3** (build 2 was already uploaded → "Redundant Binary Upload"). No code blockers —
1.0 ships **free with no in-app purchases**. Remaining work is App Store Connect items only you
can supply (watch screenshots, listing text, privacy answers) plus re-archiving with build 3.

Legend: ✅ done · ⚠️ needs your action in App Store Connect / Apple portal · 🔧 recommended code fix

---

## 1. In-app purchases — DISABLED for 1.0 (no action needed)

The paywall is switched **off** in code and RevenueCat is never initialized, so **no IAP must be
declared or created in App Store Connect** for this release.

- `src/core/config/revenuecat.ts` → `PAYWALL_ENABLED = false`.
- Effect (see `src/core/context/PremiumContext.tsx`): `proByDefault` is true → `isPro` is always
  true → every Pro feature is free, `Purchases.configure()` is never called, and all paywall entry
  points hide themselves (Settings routes to `/backup` not `/paywall`; the backup redirect and plan
  limit never fire).
- `react-native-purchases` stays compiled in but dormant — Apple does not require IAP declaration
  for an integrated-but-unused SDK, and no purchase data is collected at runtime.
- The `ios/Products.storekit` file is local-only and never shipped/reviewed.

> To monetize later: set `PAYWALL_ENABLED = true` + `REVENUECAT_API_KEY_IOS`, then create the
> products in App Store Connect and attach them to that version. No other code changes needed.

---

## 2. Build & config — mostly done

| Item | Status | Notes |
|---|---|---|
| App name / display name | ✅ | `LIFTREPS` (CFBundleDisplayName + app.json) |
| Bundle ID | ✅ | `io.liftr.app` |
| Version string | ✅ | Aligned to **1.0.0** across app.json, `MARKETING_VERSION` (×6), main Info.plist |
| Build number | ✅ | `2` (must be unique per upload — bump if you re-upload) |
| Code signing | ✅ | Manual, team `HF9JSGH879`, App Store profiles for app/watch/widgets |
| Encryption declaration | ✅ | `ITSAppUsesNonExemptEncryption = false` → skips export compliance |
| Privacy manifest | ✅ | `PrivacyInfo.xcprivacy` present (FileTimestamp/UserDefaults/DiskSpace/BootTime reasons) |
| App Transport Security | ✅ | `NSAllowsArbitraryLoads = false` (only local networking allowed) |
| iCloud entitlement | ✅ | CloudDocuments + container `iCloud.io.liftr.app` |
| Push / APNs | ✅ n/a | No `aps-environment` entitlement; `expo-notifications` used for **local** rest-timer notifications only |
| Live Activities | ✅ | `NSSupportsLiveActivities = true`, TRAKWidgets extension present |
| Min iOS | ✅ | `LSMinimumSystemVersion 12.0` (verify RN 0.81 floor; typically 15.1+) |

### 🔧 Recommended code fixes
1. ~~Orientation mismatch~~ ✅ **Fixed** — removed `LandscapeLeft`/`LandscapeRight` from
   `UISupportedInterfaceOrientations`; now portrait-only, matching `app.json`.
2. **User-visible "TRAK" branding on the watch.** The watchOS app still shows **"TRAK"** on its
   idle screen (from `TRAKTheme.swift`), while the phone is "LIFTREPS". This is visible to users, not
   just internal. Recommend renaming to LIFTREPS before shipping — say the word and I'll do it.
   (Separate from the invisible target/product names `TRAKWatch`/`TRAKWidgets`/`PRODUCT_NAME=FitnessApp`,
   which can wait for post-launch.)
3. **Splash asset.** `app.json` splash uses `./assets/icon.png`; an `assets/splash.png` exists but is
   unused. Confirm the intended splash.

---

## 3. Privacy — data & nutrition labels

Your on-device story is clean: SQLite is **local**, iCloud is the user's **own** container, no
analytics/crash/tracking SDKs, and RevenueCat is dormant (never configured) → **no purchase data
collected**.

### ⚠️ App Store Connect → App Privacy answers
- **Tracking:** No (`NSPrivacyTracking = false` is correct — no ATT prompt needed).
- **Purchases:** Not collected — RevenueCat is never initialized this release, so do **not** declare
  the "Purchases" data type. (Revisit if you flip `PAYWALL_ENABLED` on.)
- Likely answer: **"Data Not Collected"** for the whole app.
- Photos/Camera: used only to attach reference photos locally → not "collected" (stays on device). No label needed.
- **Privacy Policy URL is required.** `privacy-policy.html` exists in the repo but **must be publicly hosted**
  and the URL entered in App Store Connect.

---

## 4. App Store Connect metadata (⚠️ you provide)

| Field | Required | Have it? |
|---|---|---|
| App name (30 char) | Yes | "LIFTREPS" — see copy doc |
| Subtitle (30 char) | Yes | draft in `docs/app-store-listing.md` |
| Promotional text (170) | Optional | drafted |
| Description (4000) | Yes | drafted (EN); localize for vi/th/ru/zh |
| Keywords (100) | Yes | drafted |
| Support URL | Yes | ⚠️ need a public page (can be GitHub Pages) |
| Marketing URL | Optional | — |
| Screenshots 6.9" iPhone | Yes | ✅ 6 captured at 1320×2868 → `store-assets/screenshots/6.9-inch-en/` (EN only; localize later) |
| Apple Watch screenshots | Yes (watch app) | ⚠️ idle "Ready" captured (416×496) → `store-assets/screenshots/watch-46mm-en/`; **active/rest-timer screens need your real paired watch** (sim WCSession won't sync reliably) |
| App icon 1024×1024 | Yes | ✅ source is 1600² no-alpha; ASC pulls from build |
| Category | Yes | Health & Fitness (primary) |
| Age rating | Yes | fill questionnaire (expected 4+) |
| Content rights | Yes | confirm you own all content |

### Localization
App ships **6 locales** (en, vi, th, ru, zh-Hans, zh-Hant). App Store Connect listings should be
localized to match, or Apple shows English to those storefronts. Copy doc has EN + localized
name/subtitle/keywords; full description localization is a follow-up.

---

## 5. Guideline risk areas

- **2.1 Completeness** — no paywall this release; all features are free, so no "purchase shows no
  products" risk. Ensure the listing copy makes no purchase/subscription claims (removed from draft).
- **2.3.1 Accurate metadata** — since 1.0 is free, don't advertise Pro/subscriptions in screenshots or text.
- **5.1.1 Data collection** — permission strings must be specific (they are: camera/photos reference photos ✅).
- **4.2 Minimum functionality** — a fitness tracker with watch app + Live Activities clears this easily.
- **Watch app** — must launch and function standalone-ish; verify the paired-build archives with the watch target.

---

## 6. Pre-flight checklist

- [x] Version aligned to 1.0.0 / build **3** (bumped from 2 after redundant-upload error)
- [x] TypeScript clean (`tsc --noEmit` exit 0)
- [x] Privacy manifest present
- [x] Encryption compliance declared
- [x] IAP disabled for 1.0 (`PAYWALL_ENABLED = false`) — none to create
- [ ] Host privacy policy + support URL publicly  ⚠️ (privacy already at `https://ntv317.github.io/fitnessapp/privacy-policy.html`)
- [ ] (recommended) Remove landscape from Info.plist  🔧
- [ ] **Re-archive with build 3** in Xcode (Product → Archive) → validate → upload via Organizer/Transporter
- [ ] Upload screenshots (iPhone 6.9" set ready; Apple Watch still needed)
- [ ] Complete App Privacy answers → "Data Not Collected"
- [ ] Age rating questionnaire
- [ ] Submit for review

### Archive command (CLI alternative to Xcode UI)
```
cd ios
xcodebuild -workspace FitnessApp.xcworkspace -scheme FitnessApp \
  -configuration Release -archivePath build/LIFTREPS.xcarchive archive
xcodebuild -exportArchive -archivePath build/LIFTREPS.xcarchive \
  -exportPath build/export -exportOptionsPlist ExportOptions.plist
```
(`ExportOptions.plist` with `method: app-store-connect` needs creating; Xcode Organizer is simpler for a first submission.)
