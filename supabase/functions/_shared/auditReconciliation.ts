/**
 * auditReconciliation.ts — Lot 4 du plan de correctifs Marina.
 *
 * Source unique de vérité pour les chiffres qui apparaissent plusieurs fois
 * dans un même rapport (périmètre, pages orphelines, scores, positions) et
 * garde-fous contre les conclusions contradictoires (« profil de liens sain »
 * face à une toxicité mesurée, score « 55/50 », carte d'identité non résolue
 * utilisée comme entrée d'arbitrage).
 *
 * 100 % déterministe : aucun appel LLM, aucune requête DB.
 */

// ─────────────────────────── Scores ───────────────────────────

/** Ramène un score dans [0, max]. Fin des « 55/50 ». */
export function clampScore(score: unknown, max: unknown, fallbackMax = 100): number | null {
  const s = Number(score);
  if (!Number.isFinite(s)) return null;
  const m = Number(max);
  const bound = Number.isFinite(m) && m > 0 ? m : fallbackMax;
  return Math.max(0, Math.min(bound, Math.round(s)));
}

/** Score normalisé sur 100 à partir d'un couple (brut, max). */
export function scoreOn100(score: unknown, max: unknown): number | null {
  const s = clampScore(score, max);
  const m = Number(max);
  if (s === null || !Number.isFinite(m) || m <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((s / m) * 100)));
}

// ─────────────────────── Arrondis unifiés ───────────────────────

/** Position SERP : toujours un entier ≥ 1 (fin de « 22 » vs « 22,1 »). */
export function roundPosition(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n));
}

/**
 * Volume de recherche : entier, arrondi à la centaine au-dessus de 1 000
 * (fin de « 3 899 » vs « 3 800 » selon la section).
 */
export function roundVolume(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1000) return Math.round(n);
  return Math.round(n / 100) * 100;
}

export function formatVolume(value: unknown, locale = 'fr-FR'): string {
  const v = roundVolume(value);
  return v === null ? 'n/d' : v.toLocaleString(locale);
}

// ───────────────────────── Périmètre ─────────────────────────

export interface PerimeterInput {
  crawledPages?: unknown;
  discoveredUrls?: unknown;
  sitemapUrls?: unknown;
  indexedPages?: unknown;
}

export interface Perimeter {
  /** Pages réellement explorées ET analysées dans ce run. */
  crawled: number | null;
  /** URLs découvertes par le crawler (liens internes suivis). */
  discovered: number | null;
  /** URLs déclarées par le sitemap. */
  sitemap: number | null;
  /** Dénominateur retenu pour la couverture : max(découvertes, sitemap). */
  reference: number | null;
  coveragePct: number | null;
  /** Phrase explicative unique, à réutiliser partout dans le rapport. */
  sentence: string;
}

function pos(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function resolvePerimeter(input: PerimeterInput): Perimeter {
  const crawled = pos(input.crawledPages);
  const discovered = pos(input.discoveredUrls);
  const sitemap = pos(input.sitemapUrls);
  const reference = [discovered, sitemap].filter((n): n is number => n !== null).length
    ? Math.max(...[discovered, sitemap].filter((n): n is number => n !== null))
    : null;
  const coveragePct =
    crawled !== null && reference !== null ? Math.min(100, Math.round((crawled / reference) * 100)) : null;

  const bits: string[] = [];
  if (crawled !== null) bits.push(`${crawled} page${crawled > 1 ? 's' : ''} explorée${crawled > 1 ? 's' : ''} et analysée${crawled > 1 ? 's' : ''}`);
  if (discovered !== null) bits.push(`${discovered} URL découvertes par le crawler`);
  if (sitemap !== null) bits.push(`${sitemap} URL déclarées au sitemap`);
  const sentence = bits.length
    ? `${bits.join(', ')}${coveragePct !== null ? ` — couverture ${coveragePct} % du périmètre connu` : ''}.`
    : `Périmètre non mesuré : aucun chiffre de crawl exploitable pour ce run.`;

  return { crawled, discovered, sitemap, reference, coveragePct, sentence };
}

// ─────────────────── Pages orphelines (SSOT) ───────────────────

/**
 * Le graphe cocoon fait foi : c'est le seul module qui construit réellement le
 * graphe de liens internes. Toute autre valeur (stratège, LLM) est ignorée.
 */
export function resolveOrphanCount(cocoonResult: any): number | null {
  const details = cocoonResult?.graph_details ?? cocoonResult?.graphDetails ?? null;
  const list = details?.orphan_pages;
  if (Array.isArray(list)) return list.length;
  const stat = Number(cocoonResult?.stats?.orphan_count);
  return Number.isFinite(stat) ? stat : null;
}

// ─────────────── Cohérence toxicité des backlinks ───────────────

export interface ToxicityState {
  score: number | null;
  verdict: 'sain' | 'a_surveiller' | 'pollue' | null;
  /** Vrai dès que la conclusion « profil sain, aucun désaveu » est interdite. */
  disavowClaimForbidden: boolean;
}

export function resolveToxicity(domainAuthority: any): ToxicityState {
  const raw = domainAuthority?.toxicity ?? null;
  const score = Number.isFinite(Number(raw?.toxicity_score)) ? Math.round(Number(raw.toxicity_score)) : null;
  const verdict = (raw?.verdict as ToxicityState['verdict']) ?? null;
  return {
    score,
    verdict,
    disavowClaimForbidden: (score !== null && score >= 35) || verdict === 'pollue' || verdict === 'a_surveiller',
  };
}

// ───────────── Carte d'identité : entrée d'arbitrage ─────────────

export interface IdentityUsability {
  usable: boolean;
  notes: string[];
}

/**
 * Un champ « non résolu » ne peut pas servir d'entrée à un arbitrage
 * (mix de gabarits, liste de concurrents) : le bloc devient une hypothèse
 * explicite au lieu d'un fait.
 */
export function assessIdentityUsability(identity: any): IdentityUsability {
  const notes: string[] = [];
  const sector = String(identity?.sector ?? '').toLowerCase();
  const model = String(identity?.commercialModel ?? identity?.commercial_model ?? '').toLowerCase();
  const unresolved = (v: string) => !v || v === 'unknown' || v === 'non résolu' || v === 'unresolved';

  if (unresolved(sector)) notes.push("Secteur non résolu : les fourchettes de mix de gabarits restent des hypothèses génériques, pas un référentiel sectoriel.");
  if (unresolved(model)) notes.push("Modèle d'affaires non résolu : aucune calibration par modèle n'est appliquée.");
  const conf = Number(identity?.confidence);
  if (Number.isFinite(conf) && conf < 0.5) notes.push(`Confiance d'identification faible (${Math.round(conf * 100)} %) : à confirmer manuellement avant tout arbitrage éditorial.`);

  return { usable: notes.length === 0, notes };
}

// ─────────────── Réconciliation du HTML final ───────────────

export interface ReconciliationFacts {
  perimeter?: Perimeter | null;
  orphanCount?: number | null;
  toxicity?: ToxicityState | null;
  /** Web Vitals mesurés : source unique de vérité pour tout le rapport. */
  webVitals?: WebVitalsFacts | null;
}

// ─────────────── Web Vitals : une valeur, un format ───────────────

export interface WebVitalsFacts {
  /** Largest Contentful Paint en millisecondes (ou en secondes si < 60). */
  lcp?: unknown;
  fcp?: unknown;
  inp?: unknown;
  tbt?: unknown;
  ttfb?: unknown;
}

/** Normalise une durée hétérogène (s ou ms) en millisecondes. */
export function toMilliseconds(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 60 ? Math.round(n * 1000) : Math.round(n);
}

/**
 * Format canonique d'une durée de Web Vital : toujours en secondes, deux
 * décimales, virgule française. Fin des « 5.5s / 5.4s / 5.48s / 5776ms »
 * pour une seule et même mesure.
 */
export function formatVitalSeconds(value: unknown, locale = 'fr-FR'): string | null {
  const ms = toMilliseconds(value);
  if (ms === null) return null;
  const seconds = ms / 1000;
  return `${seconds.toFixed(2).replace('.', locale.startsWith('fr') ? ',' : '.')} s`;
}

const VITAL_ALIASES: Array<{ key: keyof WebVitalsFacts; re: string }> = [
  { key: 'lcp', re: '(?:LCP|Largest\\s+Contentful\\s+Paint)' },
  { key: 'fcp', re: '(?:FCP|First\\s+Contentful\\s+Paint)' },
  { key: 'inp', re: '(?:INP|Interaction\\s+to\\s+Next\\s+Paint)' },
  { key: 'tbt', re: '(?:TBT|Total\\s+Blocking\\s+Time)' },
  { key: 'ttfb', re: '(?:TTFB|Time\\s+To\\s+First\\s+Byte)' },
];

/**
 * Réécrit toute mention chiffrée d'un Web Vital dans le HTML pour qu'elle
 * corresponde à la mesure retenue, au format canonique. On ne touche qu'aux
 * durées situées à proximité immédiate du nom de la métrique, jamais aux
 * seuils de référence (« sous les 2,5 s ») qui ne sont pas des mesures.
 */
export function canonicalizeWebVitals(html: string, vitals: WebVitalsFacts, locale = 'fr-FR'): string {
  let out = html || '';
  for (const { key, re } of VITAL_ALIASES) {
    const canonical = formatVitalSeconds(vitals[key], locale);
    if (!canonical) continue;
    const measured = toMilliseconds(vitals[key])!;
    const pattern = new RegExp(
      `(${re}[^<>{}]{0,80}?)(\\d{1,5}(?:[.,]\\d{1,3})?)\\s*(millisecondes|ms|secondes?|s)\\b`,
      'giu',
    );
    out = out.replace(pattern, (full, prefix: string, num: string, unit: string) => {
      const asMs = /^m/i.test(unit) ? Number(num.replace(',', '.')) : Number(num.replace(',', '.')) * 1000;
      if (!Number.isFinite(asMs)) return full;
      // Seuil de référence cité (2,5 s pour LCP, 200 ms pour INP…) : on ne le
      // remplace pas, seule la mesure du site est normalisée.
      const isThreshold = /(?:seuil|recommand|sous (?:la barre des|les)|below|inférieur)/i.test(prefix);
      if (isThreshold) return full;
      // Tolérance de 20 % : au-delà, il s'agit d'une autre mesure (autre page,
      // autre profil) et non d'un arrondi divergent.
      if (Math.abs(asMs - measured) / measured > 0.2) return full;
      return `${prefix}${canonical}`;
    });
  }
  return out;
}

const HEALTHY_LINK_CLAIMS: RegExp[] = [
  /profil (?:de liens|de backlinks|backlink)[^.<]{0,60}sain[^.<]{0,80}\./giu,
  /aucun (?:désaveu|desaveu)[^.<]{0,80}\./giu,
  /pas (?:de|besoin de) (?:désaveu|desaveu)[^.<]{0,80}\./giu,
];

/**
 * Dernier filet : réécrit dans le HTML compilé les chiffres et conclusions qui
 * contredisent la source de vérité. Les sections sont produites par plusieurs
 * fonctions (dont des LLM) : on normalise le rendu au lieu de faire confiance.
 */
export function reconcileReportHtml(html: string, facts: ReconciliationFacts): string {
  let out = html || '';

  // 1. Pages orphelines : le graphe cocoon fait foi.
  const orphan = facts.orphanCount;
  if (typeof orphan === 'number' && Number.isFinite(orphan)) {
    out = out.replace(
      /(\d[\d\s.,]*)\s*(pages?\s+orphelines?|orphan\s+pages?)/giu,
      (_m, _n, label) => `${orphan} ${label}`,
    );
  }

  // 2. Toxicité des backlinks : conclusion « profil sain / aucun désaveu »
  //    interdite dès qu'une empreinte artificielle est mesurée.
  const tox = facts.toxicity;
  if (tox?.disavowClaimForbidden) {
    const replacement = `Profil de liens à surveiller : toxicité mesurée ${tox.score ?? 'n/d'}/100${tox.verdict ? ` (verdict « ${tox.verdict.replace('_', ' ')} »)` : ''}, un examen des référents et des ancres est requis avant toute conclusion.`;
    for (const re of HEALTHY_LINK_CLAIMS) {
      out = out.replace(re, replacement);
    }
  }

  // 3. Web Vitals : une mesure = un chiffre = un format, dans tout le document.
  if (facts.webVitals) {
    out = canonicalizeWebVitals(out, facts.webVitals);
  }

  // 4. Périmètre : un seul couple (crawlées / référence) et un seul pourcentage
  //    de couverture dans tout le document (fin de « 151/151 à 100 % » puis
  //    « 184 URLs » puis « 177 / 84,7 % »).
  if (facts.perimeter) {
    out = canonicalizeCoverage(out, facts.perimeter);
    out = reconcileCannibalizationCompleteness(out, facts.perimeter);
  }

  return out;
}

// ─────────────── Couverture : un seul pourcentage ───────────────

/**
 * Réécrit toute mention de couverture (« couverture X % », « N sur M URLs »,
 * « M/N pages explorées ») avec les valeurs de la source unique de vérité.
 * Conservateur : on ne touche qu'aux motifs explicitement liés à la couverture.
 */
export function canonicalizeCoverage(html: string, p: Perimeter): string {
  let out = html || '';
  if (p.coveragePct !== null) {
    out = out.replace(
      /(couverture(?:\s+de)?\s*(?:<[^>]+>\s*)?)(\d{1,3}(?:[.,]\d{1,2})?)(\s*(?:<[^>]+>\s*)?%)/giu,
      (_m, pre: string, _n: string, post: string) => `${pre}${p.coveragePct}${post}`,
    );
    out = out.replace(
      /(\d{1,3}(?:[.,]\d{1,2})?)(\s*%\s*(?:de\s+)?couverture)/giu,
      (_m, _n: string, post: string) => `${p.coveragePct}${post}`,
    );
  }
  if (p.crawled !== null && p.reference !== null) {
    out = out.replace(
      /(\d[\d\s.,]*)\s*(?:\/|sur)\s*(\d[\d\s.,]*)(\s*(?:URLs?|pages?)\s*(?:explor|crawl|analys|découvert|decouvert))/giu,
      (_m, _a, _b, tail: string) => `${p.crawled}/${p.reference}${tail}`,
    );
  }
  return out;
}

/**
 * Un groupe de cannibalisation ne peut pas être déclaré « mesure incomplète »
 * dans un rapport qui affiche 100 % de couverture : la mesure est complète,
 * ce sont les signaux de pilier qui sont trop proches pour arbitrer.
 */
export function reconcileCannibalizationCompleteness(html: string, p: Perimeter): string {
  if (p.coveragePct !== 100) return html || '';
  return (html || '').replace(
    /Mesure\s+(?:incompl[eè]te|ni[eè]te)\s*—\s*aucune redirection prescrite/giu,
    'Signaux de pilier trop proches — aucune redirection prescrite',
  );
}

// ─────────── Multi-audiences : sections légitimes distinctes ───────────

/**
 * Une page de recrutement ou de développement en franchise répond à une
 * audience secondaire légitime : elle ne doit jamais être comptée comme une
 * dissonance sémantique ni comme une cannibalisation de l'offre commerciale.
 */
export const SECONDARY_AUDIENCE_RE =
  /\/(?:franchise[^/]*|devenir-franchise[^/]*|recrutement|recrute[^/]*|jobs?|emplois?|carriere[s]?|carriere|careers?|nous-rejoindre|rejoignez[^/]*|stage[s]?|candidature[s]?|investisseur[s]?|presse|press)(?:\/|$|\?|#)/i;

export function isSecondaryAudienceUrl(url: unknown): boolean {
  const raw = String(url ?? '');
  if (!raw) return false;
  let path = raw;
  try {
    path = new URL(raw.startsWith('http') ? raw : `https://x.invalid${raw.startsWith('/') ? '' : '/'}${raw}`).pathname;
  } catch { /* chaîne libre : on teste tel quel */ }
  return SECONDARY_AUDIENCE_RE.test(path.endsWith('/') ? path : `${path}/`);
}

/** Sépare une liste d'URLs en offre principale / audience secondaire. */
export function splitAudiences<T>(items: T[], urlOf: (item: T) => unknown): { primary: T[]; secondary: T[] } {
  const primary: T[] = [];
  const secondary: T[] = [];
  for (const it of items || []) (isSecondaryAudienceUrl(urlOf(it)) ? secondary : primary).push(it);
  return { primary, secondary };
}

// ─────────── Arithmétique : le total découle des axes ───────────

export interface WeightedAxis {
  label: string;
  score: unknown;
  max: unknown;
}

export interface WeightedTotal {
  sum: number;
  sumMax: number;
  on100: number | null;
  /** Écart entre le total publié et la somme des axes, arrondi au dixième. */
  delta: number | null;
}

/**
 * Recalcule un total depuis les axes réellement affichés. Le total publié n'est
 * conservé que s'il correspond à ±0,5 point ; sinon la somme des axes fait foi
 * et l'écart est retourné pour être nommé dans le rapport.
 */
export function reconcileWeightedTotal(axes: WeightedAxis[], publishedTotal?: unknown): WeightedTotal {
  let sum = 0;
  let sumMax = 0;
  for (const a of axes || []) {
    const max = Number(a.max);
    const bound = Number.isFinite(max) && max > 0 ? max : 100;
    sum += clampScore(a.score, bound) ?? 0;
    sumMax += bound;
  }
  const published = Number(publishedTotal);
  const delta = Number.isFinite(published) ? Math.round((published - sum) * 10) / 10 : null;
  const retained = Number.isFinite(published) && Math.abs(published - sum) <= 0.5 ? published : sum;
  return {
    sum,
    sumMax,
    on100: sumMax > 0 ? Math.max(0, Math.min(100, Math.round((retained / sumMax) * 100))) : null,
    delta,
  };
}

