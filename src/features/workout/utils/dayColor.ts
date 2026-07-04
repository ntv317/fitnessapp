// Kinetic Mono accent set — on-palette, one per training day.
const PALETTE = ['#a83300', '#0058bc', '#006b27', '#b3560a', '#6d4faf'];

/**
 * Deterministic color for a plan day name. Hash-based (not position-based) so
 * a day keeps the same color in the Log tab and in History even after the
 * plan that created it is edited, reordered, or deleted.
 */
export function dayColorForTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
