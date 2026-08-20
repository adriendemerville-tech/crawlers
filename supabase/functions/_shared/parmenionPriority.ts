/**
 * parmenionPriority.ts — Échelle de priorité unique de Parménion.
 *
 * Problème résolu : trois barèmes disjoints coexistaient (surprime contenu plate
 * ×1.8 dans `cocoon-strategist`, score de conservation 0-100 dans
 * `content-pruning`, sévérité textuelle seule dans `architect_workbench`).
 * Aucun ne parlait « ROI » à l'autre, donc l'arbitrage « créer un article vs
 * fusionner deux articles qui se cannibalisent » était impossible.
 *
 * Ce module ramène tout sur l'unité commune de `roiWeighting.ts` (impact/effort)
 * et ajoute le niveau qui manquait : un score **agrégé par site**, la dette de
 * pruning. Un article à 3 clics est un constat mineur ; quinze articles à 3 clics
 * qui visent la même intention sont un seul problème de cannibalisation dont
 * chaque page n'est qu'un symptôme. Le score par page ne peut pas le voir.
 *
 * 100 % déterministe : aucun appel LLM, aucun token consommé.
 *
 * Règles non négociables :
 *  - un blocage `critical` d'indexation reste devant, quel que soit son ROI ;
 *  - les protections GSC (≥ 1 clic, position ≤ 15, ≥ 20 impressions) sont des
 *    VETOS de suppression, jamais de simples malus ;
 *  - la surprime de création ne descend jamais sous 0,8 : un gap sémantique
 *    documenté doit rester finançable.
 */
import { scoreRoi, type RoiAnnotation, type RoiScorable } from './roiWeighting.ts';
import { fetchGscPageMetrics, normalizeUrlKey, type GscPageMetrics } from './gscPages.ts';

// ───────────────────────────────────────────────────────────────
// 1. Score de conservation & décision (barème unique, ex-content-pruning)
// ───────────────────────────────────────────────────────────────

export type PruneDecision = 'keep' | 'update' | 'merge' | 'redirect' | 'delete';

export interface PrunePageInput {
  url: string;
  clicks_90d: number;
  impressions_90d: number;
  /** Position moyenne mesurée (0 = non mesurée). */
  position?: number;
  word_count: number;
  backlinks: number;
  last_modified: string | null;
  title?: string;
  http_status: number;
  /** true quand aucune donnée GSC n'est disponible pour le site. */
  metrics_missing?: boolean;
  /**
   * Meilleure position observée par une source externe (Semrush, DataForSEO)
   * quand GSC ne remonte encore rien : une position naissante hors clics est
   * un actif à défendre, pas une page morte.
   */
  external_best_position?: number | null;
  /** Volume mensuel du mot-clé associé à cette position externe. */
  external_keyword_volume?: number | null;
}


export interface PruneVerdict {
  url: string;
  conservation: number;
  decision: PruneDecision;
  reasons: string[];
  /** Protection GSC active : la page ne peut pas être supprimée/fusionnée. */
  protected: boolean;
  protection_reason?: string;
  roi: RoiAnnotation;
  priority_score: number;
  is_quick_win: boolean;
}

/** Score de conservation 0-100. Plus il est haut, plus la page mérite de rester. */
export function conservationScore(page: PrunePageInput): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (page.metrics_missing) {
    // Sans mesure de performance, on ne peut pas conclure « page muette ».
    // On neutralise les 55 points de trafic/impressions par une valeur médiane
    // pour ne jamais proposer une suppression sur une absence de données.
    score += 28;
    reasons.push('Performance non mesurée (Search Console non connectée)');
  } else {
    if (page.clicks_90d >= 50) { score += 40; reasons.push('Trafic organique solide'); }
    else if (page.clicks_90d >= 10) { score += 25; reasons.push('Trafic organique modéré'); }
    else if (page.clicks_90d >= 1) { score += 10; reasons.push('Trafic organique faible'); }
    else { reasons.push('Aucun clic organique en 90 jours'); }

    if (page.impressions_90d >= 500) score += 15;
    else if (page.impressions_90d >= 100) score += 8;
    else if (page.impressions_90d < 10) reasons.push('Quasi invisible dans les SERP');
  }

  if (page.word_count >= 1500) score += 20;
  else if (page.word_count >= 800) score += 15;
  else if (page.word_count >= 300) score += 8;
  else reasons.push(`Contenu très court (${page.word_count} mots)`);

  if (page.backlinks >= 10) { score += 15; reasons.push('Profil de liens solide'); }
  else if (page.backlinks >= 3) score += 8;
  else if (page.backlinks === 0) reasons.push('Aucun backlink');

  if (page.last_modified) {
    const daysSince = (Date.now() - new Date(page.last_modified).getTime()) / 86_400_000;
    if (daysSince <= 90) score += 10;
    else if (daysSince <= 365) score += 5;
    else reasons.push(`Non mis à jour depuis ${Math.round(daysSince / 30)} mois`);
  }

  return { score: Math.min(100, score), reasons };
}

/** Protections GSC : vetos absolus contre toute action destructive. */
export function pruneProtection(page: PrunePageInput): { protected: boolean; reason?: string } {
  if (page.metrics_missing) {
    return { protected: true, reason: 'Aucune mesure GSC : suppression interdite sans preuve' };
  }
  if (page.clicks_90d >= 1) return { protected: true, reason: `${page.clicks_90d} clic(s) sur 90 j` };
  if (page.position && page.position > 0 && page.position <= 15) {
    return { protected: true, reason: `Position moyenne ${page.position} (≤ 15)` };
  }
  if (page.impressions_90d >= 20) {
    return { protected: true, reason: `${page.impressions_90d} impressions sur 90 j` };
  }
  return { protected: false };
}

export function decidePrune(score: number, page: PrunePageInput, isProtected: boolean): PruneDecision {
  if (page.http_status >= 400) return 'delete';
  if (score >= 70) return 'keep';
  if (score >= 50) return 'update';
  // Un veto GSC ramène toujours la décision au pire vers « update ».
  if (isProtected) return 'update';
  if (score >= 25 && page.backlinks > 0) return 'redirect';
  if (score >= 25) return 'merge';
  return 'delete';
}

const DECISION_EFFORT: Record<PruneDecision, number> = {
  keep: 0.5,
  update: 2,
  merge: 1,
  redirect: 0.5,
  delete: 0.5,
};

/**
 * Convertit un verdict de pruning en ROI comparable aux tâches de création :
 * impact = 100 − conservation (plus la page est morte, plus la nettoyer rapporte),
 * effort = coût d'exécution réel de la décision.
 */
export function pruneRoi(page: PrunePageInput, ctx: { pagesAnalyzed?: number } = {}): PruneVerdict {
  const { score, reasons } = conservationScore(page);
  const protection = pruneProtection(page);
  const decision = decidePrune(score, page, protection.protected);

  const severity = score < 25 ? 'important' : score < 50 ? 'suggestion' : 'low';
  const scorable: RoiScorable = {
    title: `${decision} ${page.title || page.url}`,
    severity,
    category: 'content',
    pages_affected: 1,
    gap_ratio: Math.max(0, Math.min(1, (100 - score) / 100)),
    current_position: page.position || undefined,
  };
  const roi = scoreRoi(scorable, { pagesAnalyzed: ctx.pagesAnalyzed ?? null, hasOwnerPerformance: !page.metrics_missing });
  // On substitue l'effort réel de la décision à l'effort heuristique textuel.
  const effort = DECISION_EFFORT[decision];
  const realRoi = Math.round((roi.impact / effort) * 10) / 10;

  return {
    url: page.url,
    conservation: score,
    decision,
    reasons: protection.reason ? [...reasons, `Protégée : ${protection.reason}`] : reasons,
    protected: protection.protected,
    protection_reason: protection.reason,
    roi: { ...roi, effort, roi: realRoi, tier: realRoi >= 45 ? 'quick_win' : realRoi >= 18 ? 'structural' : 'foundation' },
    priority_score: Math.round(realRoi * 10) / 10,
    // Un quick win destructif n'existe pas : une suppression rapide ne doit
    // jamais gagner la course à la priorité par son seul rendement.
    is_quick_win: realRoi >= 45 && decision !== 'delete' && decision !== 'redirect',
  };
}

// ───────────────────────────────────────────────────────────────
// 2. Dette de pruning agrégée (niveau site)
// ───────────────────────────────────────────────────────────────

export type DebtRegime = 'healthy' | 'crowded' | 'saturated';

export interface PruningDebt {
  debt: number;
  regime: DebtRegime;
  /** Pages indexables prises en compte. */
  corpus_size: number;
  /** Pages captant au moins une impression : la vraie surface utile. */
  useful_pages: number;
  /** Part des pages indexables sans aucun clic sur 90 j (0-1). */
  mute_ratio: number;
  /** Part des pages engagées dans une grappe de cannibalisation (0-1). */
  cannibal_ratio: number;
  cannibal_clusters: number;
  /** Part du corpus dont la décision est merge/redirect/delete (0-1). */
  prunable_ratio: number;
  /** Part des clics captée par les 5 % de pages les plus fortes (0-1). */
  concentration: number;
  metrics_available: boolean;
  /** Vrai quand le corpus est trop petit pour conclure : régime forcé à `healthy`. */
  insufficient_data: boolean;
  explanation: string;
}

const MIN_CORPUS_FOR_DEBT = 12;
export const DEBT_CROWDED_THRESHOLD = 30;
export const DEBT_SATURATED_THRESHOLD = 60;

export function regimeForDebt(debt: number, insufficientData: boolean): DebtRegime {
  if (insufficientData) return 'healthy';
  if (debt >= DEBT_SATURATED_THRESHOLD) return 'saturated';
  if (debt >= DEBT_CROWDED_THRESHOLD) return 'crowded';
  return 'healthy';
}

/** Tokens significatifs d'un titre / slug, pour détecter deux pages sur la même intention. */
function contentTokens(input: string): Set<string> {
  const stop = new Set(['le', 'la', 'les', 'des', 'de', 'du', 'un', 'une', 'et', 'ou', 'pour', 'dans', 'sur', 'avec', 'comment', 'quel', 'quelle', 'the', 'and', 'for', 'with', 'best', 'meilleur', 'meilleurs', 'guide', 'top']);
  return new Set(
    String(input || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !stop.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface DebtPageInput {
  url: string;
  title?: string;
  path?: string;
  word_count?: number;
  is_indexable?: boolean;
  http_status?: number;
  page_intent?: string | null;
  near_duplicate_group?: string | null;
  last_modified?: string | null;
}

/**
 * Compte les grappes de cannibalisation : ≥ 2 pages liées soit par le groupe de
 * quasi-doublons détecté au crawl, soit par une intention identique + un
 * recouvrement lexical fort du titre/slug (Jaccard ≥ 0,55).
 */
export function detectCannibalClusters(pages: DebtPageInput[]): { clusters: number; pagesInClusters: number } {
  const groups = new Map<string, string[]>();
  const ungrouped: DebtPageInput[] = [];

  for (const p of pages) {
    if (p.near_duplicate_group) {
      const list = groups.get(`nd:${p.near_duplicate_group}`) || [];
      list.push(p.url);
      groups.set(`nd:${p.near_duplicate_group}`, list);
    } else {
      ungrouped.push(p);
    }
  }

  // Recouvrement lexical, borné pour rester O(n²) supportable sur gros corpus.
  const sample = ungrouped.slice(0, 1200);
  const tokens = sample.map((p) => contentTokens(`${p.title || ''} ${p.path || p.url}`));
  const seen = new Set<number>();
  let lexicalClusters = 0;
  let lexicalPages = 0;

  for (let i = 0; i < sample.length; i++) {
    if (seen.has(i)) continue;
    const members = [i];
    for (let j = i + 1; j < sample.length; j++) {
      if (seen.has(j)) continue;
      const sameIntent = (sample[i].page_intent || 'unknown') === (sample[j].page_intent || 'unknown');
      if (!sameIntent) continue;
      if (jaccard(tokens[i], tokens[j]) >= 0.55) members.push(j);
    }
    if (members.length >= 2) {
      lexicalClusters++;
      for (const m of members) { seen.add(m); lexicalPages++; }
    }
  }

  let ndClusters = 0;
  let ndPages = 0;
  for (const list of groups.values()) {
    if (list.length >= 2) { ndClusters++; ndPages += list.length; }
  }

  return { clusters: ndClusters + lexicalClusters, pagesInClusters: ndPages + lexicalPages };
}

/** Part des clics captée par les 5 % de pages les plus performantes. */
export function clickConcentration(clicks: number[]): number {
  const total = clicks.reduce((s, c) => s + c, 0);
  if (total <= 0) return 0;
  const sorted = [...clicks].sort((a, b) => b - a);
  const topN = Math.max(1, Math.ceil(sorted.length * 0.05));
  const top = sorted.slice(0, topN).reduce((s, c) => s + c, 0);
  return Math.round((top / total) * 100) / 100;
}

export interface ComputeDebtArgs {
  pages: DebtPageInput[];
  metrics: Map<string, GscPageMetrics> | null;
  backlinksTotal?: number;
}

/** Calcule la dette de pruning à partir d'un corpus déjà chargé (testable). */
export function computeDebtFromCorpus({ pages, metrics }: ComputeDebtArgs): PruningDebt {
  const indexable = pages.filter((p) => p.is_indexable !== false && (p.http_status ?? 200) < 400);
  const corpus = indexable.length;
  const metricsAvailable = metrics !== null;

  const clicks: number[] = [];
  let mute = 0;
  let useful = 0;

  for (const p of indexable) {
    const m = metricsAvailable ? metrics!.get(normalizeUrlKey(p.url)) : undefined;
    const c = m?.clicks ?? 0;
    const imp = m?.impressions ?? 0;
    clicks.push(c);
    if (metricsAvailable && c === 0) mute++;
    if (!metricsAvailable || imp >= 1) useful++;
  }

  const { clusters, pagesInClusters } = detectCannibalClusters(indexable);

  const prunableCount = indexable.filter((p) => {
    const m = metricsAvailable ? metrics!.get(normalizeUrlKey(p.url)) : undefined;
    const verdict = pruneRoi({
      url: p.url,
      clicks_90d: m?.clicks ?? 0,
      impressions_90d: m?.impressions ?? 0,
      position: m?.position ?? 0,
      word_count: p.word_count ?? 0,
      backlinks: 0,
      last_modified: p.last_modified ?? null,
      title: p.title,
      http_status: p.http_status ?? 200,
      metrics_missing: !metricsAvailable,
    }, { pagesAnalyzed: corpus });
    return verdict.decision === 'merge' || verdict.decision === 'redirect' || verdict.decision === 'delete';
  }).length;

  const muteRatio = corpus > 0 && metricsAvailable ? mute / corpus : 0;
  const cannibalRatio = corpus > 0 ? Math.min(1, pagesInClusters / corpus) : 0;
  const prunableRatio = corpus > 0 ? prunableCount / corpus : 0;
  const concentration = clickConcentration(clicks);
  // Au-delà de 50 % des clics sur 5 % des pages, le reste du corpus dilue.
  const concentrationExcess = Math.max(0, Math.min(1, (concentration - 0.5) / 0.5));

  const insufficient = corpus < MIN_CORPUS_FOR_DEBT;
  const debt = Math.round(
    40 * muteRatio + 30 * cannibalRatio + 20 * prunableRatio + 10 * concentrationExcess,
  );
  const regime = regimeForDebt(debt, insufficient);

  const explanation = insufficient
    ? `Corpus de ${corpus} page(s) : trop petit pour conclure à une dette, régime sain par défaut.`
    : `${Math.round(muteRatio * 100)} % de pages sans clic sur 90 j, ${clusters} grappe(s) de cannibalisation couvrant ${pagesInClusters} page(s), ${Math.round(prunableRatio * 100)} % du corpus à consolider, ${Math.round(concentration * 100)} % des clics sur les 5 % de pages les plus fortes.`;

  return {
    debt,
    regime,
    corpus_size: corpus,
    useful_pages: useful,
    mute_ratio: Math.round(muteRatio * 100) / 100,
    cannibal_ratio: Math.round(cannibalRatio * 100) / 100,
    cannibal_clusters: clusters,
    prunable_ratio: Math.round(prunableRatio * 100) / 100,
    concentration,
    metrics_available: metricsAvailable,
    insufficient_data: insufficient,
    explanation,
  };
}

/**
 * Charge le dernier crawl terminé + les métriques GSC page à page, puis calcule
 * la dette. Retourne `null` s'il n'existe aucun crawl exploitable.
 */
export async function computePruningDebt(
  supabase: any,
  opts: { domain: string; userId: string; trackedSiteId?: string | null },
): Promise<PruningDebt | null> {
  const bare = opts.domain.replace(/^www\./, '').toLowerCase();

  const { data: crawls } = await supabase
    .from('site_crawls')
    .select('id, domain, completed_at')
    .eq('status', 'completed')
    .or(`domain.eq.${bare},domain.eq.www.${bare}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const crawl = crawls?.[0];
  if (!crawl) return null;

  const { data: pages } = await supabase
    .from('crawl_pages')
    .select('url, path, title, word_count, is_indexable, http_status, page_intent, near_duplicate_group')
    .eq('crawl_id', crawl.id)
    .limit(10000);

  if (!pages || pages.length === 0) return null;

  const metrics = await fetchGscPageMetrics(supabase, opts.userId, bare, 90).catch(() => null);
  return computeDebtFromCorpus({ pages: pages as DebtPageInput[], metrics });
}

// ───────────────────────────────────────────────────────────────
// 3. Surprime de création dégressive
// ───────────────────────────────────────────────────────────────

export interface PremiumContext {
  /** Surface utile : pages captant au moins une impression. */
  usefulPages: number;
  /** Créations de contenu sur les 30 derniers jours (rythme récent). */
  recentCreations?: number;
  regime?: DebtRegime;
  /** Mode « priorité contenu » demandé par la config Autopilot. */
  contentPriorityMode?: boolean;
  spiralPhase?: string | null;
}

export const PREMIUM_FLOOR = 0.8;
export const PREMIUM_CEILING = 1.8;

/**
 * Surprime appliquée aux tâches de création. Décroissante avec la surface utile :
 * sur 10 pages, un article neuf ajoute ~10 % de surface d'entrée ; sur 500, il
 * ajoute 0,2 % et entre en concurrence avec l'existant.
 */
export function newContentPremium(ctx: PremiumContext): { premium: number; explanation: string } {
  if (!ctx.contentPriorityMode) {
    return { premium: 1, explanation: 'Mode priorité contenu inactif : aucune surprime.' };
  }

  const useful = Math.max(0, ctx.usefulPages || 0);
  const base = useful <= 15 ? 1.8 : useful <= 40 ? 1.5 : useful <= 120 ? 1.25 : useful <= 350 ? 1.05 : 0.9;

  const creations = ctx.recentCreations ?? 0;
  const rhythm = creations <= 0 ? 1 : creations === 1 ? 0.92 : creations === 2 ? 0.85 : 0.8;

  const regime = ctx.regime || 'healthy';
  let premium = base * rhythm;
  if (regime === 'crowded') premium = Math.min(premium, 1);
  if (regime === 'saturated') premium = PREMIUM_FLOOR;

  premium = Math.max(PREMIUM_FLOOR, Math.min(PREMIUM_CEILING, Math.round(premium * 100) / 100));

  return {
    premium,
    explanation: `Surface utile ${useful} page(s) → base ${base} ; ${creations} création(s) sur 30 j → ×${rhythm} ; régime ${regime} → surprime finale ×${premium}.`,
  };
}

/**
 * Gel dur de la création en régime saturé. Seule exception : un gap sémantique
 * documenté sans page concurrente identifiée.
 */
export function isCreationFrozen(
  regime: DebtRegime,
  task: { documentedSemanticGap?: boolean; competingPages?: number },
): { frozen: boolean; reason: string } {
  if (regime !== 'saturated') return { frozen: false, reason: '' };
  if (task.documentedSemanticGap && (task.competingPages ?? 0) === 0) {
    return { frozen: false, reason: 'Gap sémantique documenté sans page concurrente : création autorisée malgré le gel.' };
  }
  return {
    frozen: true,
    reason: 'Dette de pruning saturée : création gelée, la consolidation passe devant.',
  };
}

// ───────────────────────────────────────────────────────────────
// 4. Priorité finale et ordre
// ───────────────────────────────────────────────────────────────

const SEVERITY_BAND: Record<string, number> = {
  critical: 3, high: 3,
  important: 2, warning: 2, medium: 2,
  suggestion: 1, low: 1, info: 1,
  optional: 0,
};

export interface PriorityInput extends RoiScorable {
  /** `create_content`, `merge`, `fix_technical`… */
  action_type?: string;
  is_destructive?: boolean;
  documented_semantic_gap?: boolean;
  competing_pages?: number;
}

export interface PriorityResult {
  priority_score: number;
  roi: number;
  roi_tier: RoiAnnotation['tier'];
  is_quick_win: boolean;
  severity_band: number;
  premium: number;
  frozen: boolean;
  explanation: string;
}

const CREATION_ACTIONS = new Set(['create_content', 'publish_draft', 'create_page']);
const DESTRUCTIVE_ACTIONS = new Set(['delete_content', 'prune', 'redirect', 'archive']);

/**
 * Ramène n'importe quelle tâche (création, pruning, technique) sur la même
 * échelle : ROI de `roiWeighting`, modulé par la surprime dégressive côté
 * création, borné par la bande de gravité.
 */
export function finalPriority(
  task: PriorityInput,
  ctx: PremiumContext & { pagesAnalyzed?: number; hasOwnerPerformance?: boolean },
): PriorityResult {
  const roi = scoreRoi(task, {
    pagesAnalyzed: ctx.pagesAnalyzed ?? null,
    hasOwnerPerformance: ctx.hasOwnerPerformance,
  });

  const isCreation = CREATION_ACTIONS.has(task.action_type || '');
  const { premium, explanation: premiumWhy } = isCreation
    ? newContentPremium(ctx)
    : { premium: 1, explanation: '' };

  const freeze = isCreation
    ? isCreationFrozen(ctx.regime || 'healthy', {
        documentedSemanticGap: task.documented_semantic_gap,
        competingPages: task.competing_pages,
      })
    : { frozen: false, reason: '' };

  const band = SEVERITY_BAND[(task.severity || 'suggestion').toLowerCase()] ?? 1;
  const score = Math.round(roi.roi * premium * 10) / 10;

  const destructive = task.is_destructive || DESTRUCTIVE_ACTIONS.has(task.action_type || '');
  const isQuickWin = roi.roi * premium >= 45 && !destructive;

  return {
    priority_score: freeze.frozen ? 0 : score,
    roi: roi.roi,
    roi_tier: roi.tier,
    is_quick_win: isQuickWin,
    severity_band: band,
    premium,
    frozen: freeze.frozen,
    explanation: [premiumWhy, freeze.reason].filter(Boolean).join(' '),
  };
}

/** Ordre canonique : gravité → quick win → score. Un critical reste devant. */
export function sortByPriority<T extends { severity_band: number; is_quick_win: boolean; priority_score: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) =>
    b.severity_band - a.severity_band ||
    Number(b.is_quick_win) - Number(a.is_quick_win) ||
    b.priority_score - a.priority_score,
  );
}
