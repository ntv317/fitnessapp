import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/features/library/data/exercises.json',
);

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
const raw = await res.json();

const trimmed = raw.map((e) => ({
  id: e.id,
  name: e.name,
  primaryMuscles: e.primaryMuscles ?? [],
  secondaryMuscles: e.secondaryMuscles ?? [],
  mechanic: e.mechanic,
  equipment: e.equipment,
  level: e.level,
  category: e.category,
  instructions: e.instructions ?? [],
  images: e.images ?? [],
}));

await mkdir(dirname(OUT_PATH), { recursive: true });
const json = JSON.stringify(trimmed);
await writeFile(OUT_PATH, json);
console.log(`Wrote ${trimmed.length} exercises, ${(json.length / 1024 / 1024).toFixed(2)} MB`);
