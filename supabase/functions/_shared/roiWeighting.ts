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
}

export interface RoiContext {
  /** Nombre de pages réellement analysées (échelle du site). */
  pagesAnalyzed?: number | null;
  /** Données propriétaires : un domaine qui capte déjà des impressions
   *  rentabilise plus vite une action d'optimisation qu'un domaine muet. */
  hasOwnerPerformance?: boolean;
}

const SEVERITY_IMPACT: Record<string, number> = {
  critical: 100,
  important: 65,
  suggestion: 35,
  optional: 30,
  low: 20,
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
  // Un domaine qui capte déjà des impressions transforme plus vite une
  // optimisation en trafic mesurable.
  if (ctx.hasOwnerPerformance) impact += 5;
  return Math.max(5, Math.min(100, impact));
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
