/**
 * Modes de scan Marina — résolution automatique et déterministe.
 *
 * Le mode n'est PAS choisi par l'utilisateur : il est déduit du nombre d'URLs
 * réellement découvertes sur le domaine (sitemap + map + CMS). L'objectif est
 * de tenir dans le budget d'exécution d'un run tout en restant honnête sur la
 * couverture atteinte, qui est affichée dans l'introduction du rapport.
 *
 * Seuils (bornes hautes incluses) :
 *   - deep      : <= 120 URLs  → crawl quasi exhaustif (120 pages max)
 *   - standard  : <= 1000 URLs → crawl large (150 pages max)
 *   - sample    : > 1000 URLs  → échantillon par gabarit (60 pages max)
 */

export type MarinaScanMode = 'deep' | 'standard' | 'sample';

export interface ScanModeResolution {
  mode: MarinaScanMode;
  maxPages: number;
  /** Nombre d'URLs découvertes ayant servi à la décision (null si inconnu). */
  discoveredUrls: number | null;
  /** Couverture théorique = maxPages / discoveredUrls, en % (null si inconnu). */
  coveragePct: number | null;
  /** Raison lisible de la bascule, journalisée et affichée dans le rapport. */
  reason: string;
}

export const SCAN_MODE_THRESHOLDS = {
  deepMaxUrls: 120,
  standardMaxUrls: 1000,
} as const;

export const SCAN_MODE_LIMITS: Record<MarinaScanMode, number> = {
  deep: 120,
  standard: 150,
  sample: 60,
};

export function resolveScanMode(discoveredUrls: number | null | undefined): ScanModeResolution {
  const n = typeof discoveredUrls === 'number' && discoveredUrls > 0 ? discoveredUrls : null;

  let mode: MarinaScanMode;
  if (n === null) {
    mode = 'standard';
  } else if (n <= SCAN_MODE_THRESHOLDS.deepMaxUrls) {
    mode = 'deep';
  } else if (n <= SCAN_MODE_THRESHOLDS.standardMaxUrls) {
    mode = 'standard';
  } else {
    mode = 'sample';
  }

  const maxPages = SCAN_MODE_LIMITS[mode];
  const coveragePct = n ? Math.min(100, Math.round((maxPages / n) * 100)) : null;

  const reason = n === null
    ? `Volume du site non déterminé au moment de la détection : mode standard appliqué par défaut (${maxPages} pages).`
    : mode === 'deep'
      ? `${n} URLs découvertes (≤ ${SCAN_MODE_THRESHOLDS.deepMaxUrls}) : le site tient dans un crawl quasi exhaustif.`
      : mode === 'standard'
        ? `${n} URLs découvertes (≤ ${SCAN_MODE_THRESHOLDS.standardMaxUrls}) : crawl large plafonné à ${maxPages} pages pour tenir dans le budget d'exécution.`
        : `${n} URLs découvertes (> ${SCAN_MODE_THRESHOLDS.standardMaxUrls}) : un crawl intégral ne tient pas dans un run, on échantillonne ${maxPages} pages représentatives des gabarits du site.`;

  return { mode, maxPages, discoveredUrls: n, coveragePct, reason };
}

export function scanModeLabel(mode: MarinaScanMode, lang = 'fr'): string {
  const labels: Record<MarinaScanMode, [string, string, string]> = {
    deep: ['Approfondi', 'Deep', 'Profundo'],
    standard: ['Standard', 'Standard', 'Estándar'],
    sample: ['Échantillon', 'Sample', 'Muestra'],
  };
  const [fr, en, es] = labels[mode];
  return lang === 'en' ? en : lang === 'es' ? es : fr;
}

/** Phrase méthodologique insérée dans l'introduction du rapport. */
export function scanModeSentence(res: ScanModeResolution, lang = 'fr'): string {
  const label = scanModeLabel(res.mode, lang);
  const cov = res.coveragePct !== null ? ` Couverture visée : ${res.coveragePct} % des URLs découvertes.` : '';
  if (lang === 'en') {
    const covEn = res.coveragePct !== null ? ` Target coverage: ${res.coveragePct}% of discovered URLs.` : '';
    return `Scan mode: <strong>${label}</strong> (${res.maxPages} pages max), selected automatically from the site's real size.${covEn}`;
  }
  if (lang === 'es') {
    const covEs = res.coveragePct !== null ? ` Cobertura objetivo: ${res.coveragePct} % de las URL descubiertas.` : '';
    return `Modo de escaneo: <strong>${label}</strong> (máx. ${res.maxPages} páginas), seleccionado automáticamente según el tamaño real del sitio.${covEs}`;
  }
  return `Mode de scan retenu : <strong>${label}</strong> (${res.maxPages} pages maximum), sélectionné automatiquement d'après la taille réelle du site. ${res.reason}${cov}`;
}
