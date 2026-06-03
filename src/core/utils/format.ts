/** Format weight: removes trailing .0 for whole numbers (e.g. 100.0 -> "100", 52.5 -> "52.5") */
export function formatWeight(kg: number): string {
  return kg % 1 === 0 ? String(kg) : kg.toFixed(1);
}

/** Seconds -> "mm:ss" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pluralise a word simply */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
