/**
 * roiWeighting.ts — Couche ROI diffuse (impact × effort) appliquée aux plans
 * d'action des rapports (Marina, audit stratégique).
 *
 * Objectif : ne pas ajouter une nouvelle section « matrice ROI », mais
 * *pondérer* ce qui existe déjà — ordre des actions, libellés, phrases d'intro
 * et de conclusion — pour qu'un lecteur non technique sache où est le
 * rendement, sans changer la structure du rapport.
 *
 * 100 % déterministe : aucun appel LLM, donc aucun coût token.
 *
 * Règle non négociable : un blocage `critical` reste devant, quel que soit son
 * ROI apparent. Le ROI ordonne à l'intérieur d'un même niveau de gravité.
 */

export type RoiTier = 'quick_win' | 'structural' | 'foundation';

export interface RoiAnnotation {
  /** 0-100 : poids business estimé (gravité, levier de catégorie, échelle). */
  impact: number;
  /** Effort en jours-homme estimés (0.5 à 10). */
  effort: number;
  /** Rendement relatif = impact / effort, normalisé. */
  roi: number;
  tier: RoiTier;
  tier_label: string;
  effort_label: string;
  roi_note: string;
}

export interface RoiScorable {
  title: string;
  description?: string;
  severity?: string;
  category?: string;
  pages_affected?: number;
  /** Lot 5 : écart relatif au seuil mesuré (0 = au seuil, 1 = 100 % sous le seuil). */
  gap_ratio?: number;
  /** Lot 5 : volume de recherche mensuel du cluster visé. */
  keyword_volume?: number;
  /** Lot 5 : position moyenne mesurée sur la requête / le cluster visé. */
  current_position?: number;
}

export interface RoiContext {
  /** Nombre de pages réellement analysées (échelle du site). */
  pagesAnalyzed?: number | null;
  /** Données propriétaires : un domaine qui capte déjà des impressions
   *  rentabilise plus vite une action d'optimisation qu'un domaine muet. */
  hasOwnerPerformance?: boolean;
}

// Base de gravité volontairement basse : elle doit laisser de la place aux
// modulateurs mesurés (écart au seuil, volume, position, périmètre). Une base à
// 100 saturait le score et rendait toutes les actions « impact 100/100 ».
const SEVERITY_IMPACT: Record<string, number> = {
  critical: 58,
  important: 40,
  suggestion: 24,
  optional: 20,
  low: 14,
};

const QUICK_PATTERNS = [
  'title', 'balise', 'meta', 'description', 'alt', 'canonical', 'robots',
  'schema', 'json-ld', 'jsonld', 'ancre', 'lien interne', 'maillage',
  'réponse directe', '40 mots', 'h1', 'sitemap', 'breadcrumb', 'fil d',
];
const HEAVY_PATTERNS = [
  'refonte', 'migration', 'architecture', 'core web vitals', 'performance',
  'temps de chargement', 'netlinking', 'backlink', 'autorité', 'hébergement',
  'javascript', 'rendu', 'refondre', 'silo', 'restructur',
];
const MEDIUM_PATTERNS = [
  'contenu', 'article', 'rédaction', 'réécri', 'page', 'cocon', 'redirection',
  'duplicat', 'thin', 'cannibalis', 'e-e-a-t', 'auteur',
];

const LEVERAGE: Array<[RegExp, number]> = [
  [/indexation|robots|canonical|crawl/i, 15],
  [/technique|performance|vitals/i, 8],
  [/geo|aeo|citab|ia\b/i, 10],
  [/contenu|editorial|éditorial/i, 6],
  [/autorit|backlink|netlinking/i, 4],
];

function haystack(item: RoiScorable): string {
  return `${item.title || ''} ${item.description || ''} ${item.category || ''}`.toLowerCase();
}

/** Effort en jours-homme, déduit du vocabulaire de l'action. */
export function estimateEffort(item: RoiScorable): number {
  const h = haystack(item);
  if (HEAVY_PATTERNS.some((p) => h.includes(p))) return 8;
  if (QUICK_PATTERNS.some((p) => h.includes(p))) return 1;
  if (MEDIUM_PATTERNS.some((p) => h.includes(p))) return 3;
  return 3;
}

/** Impact business 0-100. */
export function estimateImpact(item: RoiScorable, ctx: RoiContext = {}): number {
  const sev = String(item.severity || 'suggestion').toLowerCase();
  let impact = SEVERITY_IMPACT[sev] ?? 35;
  const label = `${item.category || ''} ${item.title || ''}`;
  for (const [re, bonus] of LEVERAGE) {
    if (re.test(label)) { impact += bonus; break; }
  }
  const pages = Number(item.pages_affected || 0);
  const scale = ctx.pagesAnalyzed || 0;
  if (pages > 0 && scale > 0) {
    impact += Math.min(15, Math.round((pages / scale) * 15));
  }
  // Lot 5 — l'impact ne peut plus être une constante de gravité : il est modulé
  // par le signal réellement mesuré (écart au seuil, volume, position).
  const gap = Number(item.gap_ratio);
  if (Number.isFinite(gap) && gap > 0) {
    // Un écart de 100 % au seuil vaut +20 ; un écart de 10 % ne vaut que +2.
    impact += Math.min(20, Math.round(gap * 20));
  }
  const volume = Number(item.keyword_volume || 0);
  if (volume > 0) {
    // Échelle logarithmique : 100 rech./mois → +6, 10 000 → +12.
    impact += Math.min(12, Math.round(Math.log10(volume) * 3));
  }
  const pos = Number(item.current_position || 0);
  if (pos > 0) {
    // Positions 4-20 : zone de gain maximal. Top 3 ou au-delà de 30 : gain faible.
    if (pos >= 4 && pos <= 20) impact += 10;
    else if (pos <= 3) impact += 2;
    else if (pos <= 30) impact += 5;
  }
  // Un domaine qui capte déjà des impressions transforme plus vite une
  // optimisation en trafic mesurable.
  if (ctx.hasOwnerPerformance) impact += 5;
  // Plafond 97 : aucune action ne peut afficher un impact « parfait ».
  return Math.max(5, Math.min(97, impact));
}

function effortLabel(days: number): string {
  if (days <= 1) return 'Effort faible (~1 j)';
  if (days <= 3) return 'Effort moyen (~3 j)';
  return 'Effort lourd (1 à 2 semaines)';
}

const TIER_LABEL: Record<RoiTier, string> = {
  quick_win: 'Gain rapide',
  structural: 'Chantier rentable',
  foundation: 'Investissement de fond',
};

export function scoreRoi(item: RoiScorable, ctx: RoiContext = {}): RoiAnnotation {
  const impact = estimateImpact(item, ctx);
  const effort = estimateEffort(item);
  const roi = Math.round((impact / effort) * 10) / 10;
  const tier: RoiTier = roi >= 45 ? 'quick_win' : roi >= 18 ? 'structural' : 'foundation';
  const note =
    tier === 'quick_win'
      ? `Rendement élevé : impact ${impact}/100 pour un effort d'environ ${effort} j.`
      : tier === 'structural'
      ? `Rendement correct : impact ${impact}/100 pour environ ${effort} j de travail.`
      : `Rendement différé : impact ${impact}/100 mais environ ${effort} j de travail, à planifier.`;
  return {
    impact,
    effort,
    roi,
    tier,
    tier_label: TIER_LABEL[tier],
    effort_label: effortLabel(effort),
    roi_note: note,
  };
}

const SEV_BAND: Record<string, number> = { critical: 3, important: 2, suggestion: 1, optional: 1, low: 0 };

/**
 * Annote et réordonne une liste d'actions : les blocages critiques restent en
 * tête, puis à gravité égale les meilleurs rendements passent devant. Les
 * `rank` sont réattribués pour rester cohérents avec l'affichage.
 */
export function applyRoiWeighting<T extends RoiScorable & { rank?: number }>(
  items: T[] | null | undefined,
  ctx: RoiContext = {},
): Array<T & { roi: RoiAnnotation }> {
  if (!Array.isArray(items) || items.length === 0) return [];
  const annotated = items.map((it, idx) => ({ ...it, roi: scoreRoi(it, ctx), _idx: idx }));
  annotated.sort((a, b) => {
    const band = (SEV_BAND[String(b.severity || '').toLowerCase()] ?? 1)
      - (SEV_BAND[String(a.severity || '').toLowerCase()] ?? 1);
    if (band !== 0) return band;
    if (b.roi.roi !== a.roi.roi) return b.roi.roi - a.roi.roi;
    return a._idx - b._idx;
  });
  return annotated.map((it, i) => {
    const { _idx, ...rest } = it as typeof it & { _idx: number };
    return { ...(rest as T & { roi: RoiAnnotation }), rank: i + 1 };
  });
}

export interface RoiSummary {
  quickWins: number;
  structural: number;
  foundation: number;
  quickWinDays: number;
  topQuickWins: string[];
  /** Phrase prête à insérer en intro / synthèse / conclusion. */
  sentence: string;
}

export function summarizeRoi(
  items: Array<{ title: string; roi?: RoiAnnotation }>,
  lang = 'fr',
): RoiSummary {
  const withRoi = items.filter((i) => i.roi);
  const quick = withRoi.filter((i) => i.roi!.tier === 'quick_win');
  const structural = withRoi.filter((i) => i.roi!.tier === 'structural');
  const foundation = withRoi.filter((i) => i.roi!.tier === 'foundation');
  const quickWinDays = Math.round(quick.reduce((a, i) => a + i.roi!.effort, 0) * 10) / 10;
  const topQuickWins = quick.slice(0, 3).map((i) => i.title);

  const isEn = lang === 'en';
  const isEs = lang === 'es';
  let sentence: string;
  if (!withRoi.length) {
    sentence = isEn
      ? 'No pending action to weight by return on effort.'
      : isEs
      ? 'Ninguna acción pendiente que ponderar por rendimiento.'
      : "Aucune action en attente à pondérer par rendement.";
  } else if (quick.length) {
    sentence = isEn
      ? `${quick.length} of the ${withRoi.length} actions are quick wins (about ${quickWinDays} day(s) of work in total) and carry most of the short-term return; ${foundation.length} are longer-term investments.`
      : isEs
      ? `${quick.length} de las ${withRoi.length} acciones son ganancias rápidas (unos ${quickWinDays} día(s) de trabajo) y concentran el rendimiento a corto plazo.`
      : `${quick.length} des ${withRoi.length} actions sont des gains rapides — environ ${quickWinDays} jour${quickWinDays > 1 ? 's' : ''} de travail au total — et concentrent l'essentiel du rendement à court terme ; ${foundation.length} relèvent d'un investissement de fond, à planifier.`;
  } else {
    sentence = isEn
      ? `The ${withRoi.length} pending actions are all structural: expect no immediate quick win, plan the effort.`
      : isEs
      ? `Las ${withRoi.length} acciones pendientes son estructurales: planifique el esfuerzo.`
      : `Les ${withRoi.length} actions en attente sont toutes structurelles : aucun gain immédiat à attendre, l'effort doit être planifié.`;
  }

  return {
    quickWins: quick.length,
    structural: structural.length,
    foundation: foundation.length,
    quickWinDays,
    topQuickWins,
    sentence,
  };
}

export const ROI_TIER_STYLE: Record<RoiTier, { bg: string; fg: string }> = {
  // Palette Crawlers : or, violet, gris — jamais de bleu IA.
  quick_win: { bg: '#fef3c7', fg: '#7c5b00' },
  structural: { bg: '#ede9fe', fg: '#5b21b6' },
  foundation: { bg: '#f3f4f6', fg: '#374151' },
};
