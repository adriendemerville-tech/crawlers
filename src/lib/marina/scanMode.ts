/**
 * Le champ `scan_mode` est stocké soit comme chaîne ('deep' | 'standard' | 'sample'),
 * soit comme objet détaillé { mode, reason, maxPages, coveragePct, discoveredUrls }
 * selon la version du job Marina. On normalise toujours vers une chaîne pour
 * éviter de rendre un objet dans le JSX (React error #31).
 */
export function normalizeScanMode(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const mode = (value as { mode?: unknown }).mode;
    if (typeof mode === 'string') return mode;
  }
  return null;
}
