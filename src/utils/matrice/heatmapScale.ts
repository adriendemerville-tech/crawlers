/**
 * Heatmap scale — maps a 0-100 score to one of 5 brand tokens.
 * Palette: violet (low) → gold (high). No IA-blue.
 * Returns Tailwind class names for bg + text.
 */

export type HeatBucket = 0 | 1 | 2 | 3 | 4;

export function scoreToBucket(score: number | null | undefined): HeatBucket {
  if (score == null || isNaN(score)) return 0;
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

export function bucketToBgClass(b: HeatBucket): string {
  return ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'][b];
}

export function bucketToTextClass(b: HeatBucket): string {
  // Buckets 3 & 4 are bright → dark text; 0-2 → light text in dark mode
  return b >= 3 ? 'text-black' : 'text-foreground';
}

export function scoreToHeatClasses(score: number | null | undefined): string {
  const b = scoreToBucket(score);
  return `${bucketToBgClass(b)} ${bucketToTextClass(b)}`;
}

/**
 * Returns the raw HSL color (for Three.js voxels, SVG, canvas).
 */
export function bucketToHsl(b: HeatBucket): string {
  const map = ['262 60% 78%', '262 70% 65%', '280 65% 55%', '25 88% 55%', '45 93% 50%'];
  return `hsl(${map[b]})`;
}
