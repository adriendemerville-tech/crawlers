/**
 * Pondération marché de la priorisation (audit stratégique).
 *
 * Problème corrigé : la roadmap exécutive était priorisée par le seul poids
 * technique du LLM. Trafic réel, positions et volumes étaient affichés mais
 * jamais utilisés pour ordonner les actions.
 *
 * Ici, tout est déterministe (zéro appel LLM, zéro coût) :
 *   score = 0.35 * opportunité de position
 *         + 0.30 * potentiel de volume / ETV
 *         + 0.20 * ROI déclaré par le LLM
 *         + 0.15 * levier de catégorie (selon l'autorité du domaine)
 */

export interface MarketWeightingContext {
  rankingOverview?: {
    total_ranked_keywords?: number;
    average_position_global?: number;
    distribution?: { top3?: number; top10?: number; top20?: number; top50?: number };
    etv?: number;
    top_keywords?: { keyword: string; position: number; volume: number }[];
  } | null;
  marketData?: { total_market_volume?: number } | null;
  authorityData?: { authority_score?: number; toxicity?: { verdict?: string } } | null;
}

export interface WeightedRoadmapItem {
  market_score: number;
  market_rationale: string;
  priority?: string;
  [k: string]: unknown;
}

const ROI_WEIGHT: Record<string, number> = { high: 100, medium: 60, low: 30 };

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Opportunité de position : un site déjà bien placé a peu à gagner en volume
 * brut, un site en page 2-3 a un potentiel de gain immédiat maximal.
 */
function positionOpportunity(ctx: MarketWeightingContext): number {
  const ro = ctx.rankingOverview;
  if (!ro || !ro.total_ranked_keywords) return 50;
  const d = ro.distribution || {};
  const total = ro.total_ranked_keywords;
  const striking = ((d.top20 || 0) - (d.top10 || 0)) + ((d.top50 || 0) - (d.top20 || 0)) * 0.5;
  const strikingRatio = total > 0 ? striking / total : 0;
  const avg = ro.average_position_global || 50;
  // Position moyenne 11-30 = zone de gain la plus rentable.
  const avgScore = avg <= 3 ? 30 : avg <= 10 ? 55 : avg <= 30 ? 100 : avg <= 60 ? 70 : 40;
  return clamp(avgScore * 0.7 + strikingRatio * 100 * 0.3);
}

/** Potentiel de volume : marché adressable et trafic estimé déjà capté. */
function volumePotential(ctx: MarketWeightingContext): number {
  const vol = ctx.marketData?.total_market_volume || 0;
  const etv = ctx.rankingOverview?.etv || 0;
  const volScore = vol <= 0 ? 50 : clamp(Math.log10(vol + 1) / 5 * 100);
  // Faible capture d'un gros marché = fort potentiel.
  const captureRatio = vol > 0 ? clamp((etv / vol) * 100, 0, 100) : 50;
  return clamp(volScore * 0.6 + (100 - captureRatio) * 0.4);
}

/**
 * Levier de catégorie : sur un domaine à faible autorité, le contenu et la
 * technique paient plus vite que l'autorité offsite ; sur un profil pollué,
 * l'axe Autorité redevient prioritaire.
 */
function categoryLeverage(category: string, ctx: MarketWeightingContext): number {
  const authority = ctx.authorityData?.authority_score ?? 40;
  const polluted = ctx.authorityData?.toxicity?.verdict === 'pollue';
  const c = (category || '').toLowerCase();
  if (c.includes('autor')) return polluted ? 95 : authority < 30 ? 35 : 65;
  if (c.includes('contenu')) return authority < 45 ? 90 : 70;
  if (c.includes('technique')) return 75;
  if (c.includes('identit')) return 70;
  if (c.includes('social')) return 55;
  return 60;
}

function priorityLabel(score: number): string {
  if (score >= 70) return 'Prioritaire';
  if (score >= 45) return 'Important';
  return 'Opportunité';
}

/**
 * Réordonne la roadmap exécutive par score marché décroissant et réécrit le
 * libellé de priorité. Retourne le tableau d'origine si rien n'est exploitable.
 */
export function applyMarketWeighting<T extends Record<string, unknown>>(
  roadmap: T[] | undefined | null,
  ctx: MarketWeightingContext,
): (T & WeightedRoadmapItem)[] {
  if (!Array.isArray(roadmap) || roadmap.length === 0) return [];

  const posOpp = positionOpportunity(ctx);
  const volPot = volumePotential(ctx);
  const ro = ctx.rankingOverview;

  const scored = roadmap.map((item) => {
    const roi = ROI_WEIGHT[String((item as any).expected_roi || '').toLowerCase()] ?? 60;
    const lev = categoryLeverage(String((item as any).category || ''), ctx);
    const score = Math.round(posOpp * 0.35 + volPot * 0.30 + roi * 0.20 + lev * 0.15);
    const parts: string[] = [];
    if (ro?.average_position_global) parts.push(`position moyenne ${Math.round(ro.average_position_global)}`);
    if (ro?.total_ranked_keywords) parts.push(`${ro.total_ranked_keywords} mots-clés positionnés`);
    if (ro?.etv) parts.push(`trafic estimé ${Math.round(ro.etv)}/mois`);
    if (ctx.marketData?.total_market_volume) parts.push(`marché ${ctx.marketData.total_market_volume} rech./mois`);
    return {
      ...(item as any),
      market_score: clamp(score),
      market_rationale: parts.length
        ? `Priorité pondérée par les données de marché : ${parts.join(', ')}.`
        : 'Priorité pondérée sans données de marché disponibles (score technique seul).',
      priority: priorityLabel(clamp(score)),
    } as T & WeightedRoadmapItem;
  });

  return scored.sort((a, b) => b.market_score - a.market_score);
}
