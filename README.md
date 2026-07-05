# LIFTREPS — Gym Workout Tracker & Lifting Log for iOS

**LIFTREPS** is a fast, offline-first workout tracker for iPhone and Apple Watch:
log sets and reps in two taps, follow your weekly split, run rest timers on the
lock screen (Live Activity) and your wrist, and track strength progress per
exercise. No account, no ads — all data stays on-device.

🌐 [Website](https://ntv317.github.io/fitnessapp/) ·
🔒 [Privacy policy](https://ntv317.github.io/fitnessapp/privacy-policy.html) ·
📲 App Store — coming soon

Built with React Native / Expo, TypeScript, SQLite, and a native watchOS companion.

## Architecture

Feature-first, 4-layer separation of concerns:

```
UI Layer → State Layer (TanStack Query) → Domain Layer (Repository) → Storage (SQLite)
```

```
src/
├── core/
│   ├── database/      # SQLite singleton, migrations, shared types
│   ├── theme/         # Colors, spacing, typography tokens
│   ├── utils/         # date & format helpers
│   ├── context/       # RepositoryContext (DI without expo-sqlite leaking upward)
│   └── providers/     # AppProviders (QueryClient + RepositoryContext)
│
└── features/
    ├── workout/       # Log screen, ExercisePicker, LogSetRow, hooks, WorkoutRepository
    ├── history/       # History screen, ProgressChart, LogCard
    ├── timer/         # RestTimer component + useRestTimer (background-resilient)
    └── import/        # DataImportScreen, ImportService (Zod + ACID batch)

app/
└── (tabs)/            # Expo Router tab navigation
```

## Getting started

```bash
npm install
npx expo start
npx expo run:ios   # requires Xcode
```

## Rest defaults

- **Compound exercises**: 2 min 30 s (150 s)
- **Isolation exercises**: 1 min 30 s (90 s)

The timer fires a local notification when the rest period ends — even if the app is backgrounded.

## AI Import

Open the **Import** tab, copy the built-in prompt, paste it into ChatGPT or Claude with your
goals filled in, then paste the JSON response back to import your workout atomically.
