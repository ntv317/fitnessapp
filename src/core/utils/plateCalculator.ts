export interface PlateResult {
  plates: number[];      // plates per side, largest-first
  achievable: number;    // actual total weight (may differ from target if not exact)
  exact: boolean;
}

/**
 * Greedy plate calculator.
 * Plates are always loaded in pairs (one per side), so each plate used reduces
 * the remaining load by 2× its value. Returns the largest-first breakdown per
 * side plus the exact total achievable.
 */
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): PlateResult {
  const sorted = [...availablePlates].sort((a, b) => b - a);
  let remaining = (targetWeight - barWeight) / 2;
  const plates: number[] = [];

  for (const plate of sorted) {
    while (remaining >= plate - 0.0001) {
      plates.push(plate);
      remaining = Math.round((remaining - plate) * 10000) / 10000;
    }
  }

  const achievable = barWeight + plates.reduce((s, p) => s + p, 0) * 2;
  return { plates, achievable, exact: Math.abs(achievable - targetWeight) < 0.001 };
}
