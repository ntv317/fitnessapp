# AI Import Mapping

AI import is a **plan-only** operation: it creates a new workout plan structure with days and exercises, never touches workout logs or historical data. The entire import runs in a single database transaction. A new plan named "AI Import" (or "AI Import 2", "AI Import 3", etc. if the name is taken) is created and automatically set active; earlier plans are preserved and can be switched back via the plan list.

## Expected JSON Shape

The import payload is an array of days. Each day has a name and a list of exercises. Here's a realistic example:

```json
[
  {
    "day": "Monday",
    "exercises": [
      {
        "name": "Barbell Bench Press",
        "isCompound": true,
        "sets": 4,
        "repMin": 5,
        "repMax": 8,
        "muscleGroup": "Chest"
      },
      {
        "name": "Dumbbell Flye",
        "isCompound": false,
        "sets": 3,
        "reps": 12,
        "muscleGroup": "Chest"
      }
    ]
  },
  {
    "day": "Wednesday",
    "exercises": [
      {
        "name": "Barbell Squat",
        "isCompound": true,
        "sets": 5,
        "repMin": 3,
        "repMax": 5
      }
    ]
  }
]
```

## Validation Rules (Zod)

- **Day** (`day`): required string, at least 1 character
- **Exercises array**: required, at least 1 exercise per day
- **Exercise name** (`name`): required string, at least 1 character
- **isCompound**: optional boolean, defaults to `false`
- **sets**: required positive integer
- **repMin / repMax**: optional positive integers; if both provided, `repMin <= repMax` is enforced
- **reps**: optional positive integer (legacy alias; maps to both `repMin` and `repMax` if provided alone)
- **muscleGroup**: optional string

### Text Cleaning

Before parsing, the JSON string is cleaned:
1. Remove markdown code fences (`\`\`\`json` etc.)
2. Replace curly/smart quotes (`"`, `"`, `„`, `‟`) with straight quotes (`"`)
3. Replace curly/smart single quotes (`'`, `'`, `‚`, `‛`) with straight apostrophes (`'`)
4. Remove zero-width and non-breaking spaces (U+200B, U+200C, U+200D, U+FEFF)

## Catalog Matching

Immediately after validation, each exercise is matched against the bundled **free-exercise-db** catalog by normalized name (lowercase, alphanumeric only, whitespace collapsed):

- **Match found**: `catalogId` is set to the catalog entry's ID, and `isCompound` / `muscleGroup` are replaced with the catalog's authoritative values (via the exercise's `mechanic` and `primaryMuscles` fields).
- **No match**: `catalogId` remains `null`, the AI's `isCompound` flag is preserved, and `muscleGroup` is normalized case-insensitively against the library's valid groups (Abs, Back, Biceps, Calf, Chest, Forearms, Legs, Shoulders, Triceps). If the input group doesn't match any valid group, it's set to `null`.

## Field-by-Field Mapping

| Import field | Required | Transform | DB table.column |
|---|---|---|---|
| `day` | Yes | Name of the workout day | `PlanDays.name` |
| `name` | Yes | Catalog's canonical name on match, else trimmed as given | `Exercises.name` |
| `isCompound` | No (def: false) | Overridden by catalog match, else kept | `Exercises.is_compound` |
| `sets` | Yes | Target set count for this plan | `PlanExercises.target_sets` |
| `repMin` | No | Falls back to `reps` if absent | `PlanExercises.rep_min` |
| `repMax` | No | Falls back to `reps` if absent | `PlanExercises.rep_max` |
| `reps` | No (legacy) | Maps to `repMin = repMax = reps` if neither min/max provided | `PlanExercises.rep_min/rep_max` |
| `muscleGroup` | No | Catalog takes precedence; normalized case-insensitively | `Exercises.muscle_group` |
| `catalogId` | (derived) | Filled from catalog match, else `null` | `Exercises.catalog_id` |
| `default_rest_seconds` | (derived) | 150s if `isCompound`, 75s if isolation (NEW exercises only) | `Exercises.default_rest_seconds` |
| `sort_order` | (derived) | Array index within day | `PlanDays.sort_order`, `PlanExercises.sort_order` |
| `is_custom` | (derived) | Always 0 for imported exercises | `Exercises.is_custom` |

## Re-Import Semantics

Exercises are **upserted by name** with `keepExistingSettings: true`. When an exercise with the same name already exists:

- **Preserved**: its current `default_rest_seconds`, `is_compound` flag
- **Updated only if currently NULL**: `catalog_id`, `muscle_group` (catalog match fills in the missing data)
- **Always overwritten**: `is_custom` → 0 (mark as non-custom on re-import)

If the same exercise name appears **twice in the same day**, the second insert is silently ignored (`INSERT OR IGNORE`); the duplicate does not roll back the import.

## What Import NEVER Touches

- **WorkoutLogs, WorkoutSets**: no workout history is created or modified
- **WeeklyProgress**: no set counts or weekly stats are created
- **Weight data**: no user-recorded weights or user preferences
- **Legacy "session" import mode**: removed; only plan-based import is supported

---

Generated from: `types.ts`, `ImportService.ts`, `catalogMatch.ts`, `WorkoutRepository.importBatch()`, `migrations.ts` (v10)
