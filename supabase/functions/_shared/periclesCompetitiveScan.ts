/**
 * Périclès — arbitrage concurrentiel conditionnel.
 *
 * Exécuté UNIQUEMENT sur une décision dont la récompense GSC mesurée est
 * négative. Aucun LLM, aucun scan systématique : au plus 3 requêtes SERP
 * mutualisées via `_shared/serpPool.ts`.
 *
 * Verdict (`market_context`) :
 *   - 'competitor_gain' : nous avons reculé ET un concurrent occupe la place
 *     que nous tenions → perte attribuée au marché, récompense neutralisée à 0.
 *   - 'self_loss'       : recul sans gagnant identifié → récompense conservée.
 *   - null              : scan indisponible → aucune neutralisation
 *     (l'absence de preuve ne blanchit jamais une action).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { getSerp } from './serpPool.ts';

const MAX_KEYWORDS = 3;

export type MarketContext = 'competitor_gain' | 'self_loss';

export interface CompetitiveScanResult {
  decision_id: string;
  market_context: MarketContext | null;
  keywords_scanned: number;
  snapshots: number;
  skipped?: string;
}

function normDomain(d: unknown): string {
  return String(d ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();
}

export async function runPericlesCompetitiveScan(
  supabase: SupabaseClient,
  decisionId: string,
  opts: { poolOnly?: boolean } = {},
): Promise<CompetitiveScanResult> {
  const base: CompetitiveScanResult = {
    decision_id: decisionId,
    market_context: null,
    keywords_scanned: 0,
    snapshots: 0,
  };

  const { data: decision } = await supabase
    .from('pericles_decision_log')
    .select('id, domain, user_id, tracked_site_id, goal_cluster_id, target_url, reward_signal, raw_reward_signal, market_context')
    .eq('id', decisionId)
    .maybeSingle();

  if (!decision) return { ...base, skipped: 'decision_not_found' };
  if (decision.market_context) {
    return { ...base, market_context: decision.market_context as MarketContext, skipped: 'already_arbitrated' };
  }

  const rawReward = decision.raw_reward_signal ?? decision.reward_signal;
  if (rawReward === null || rawReward === undefined || Number(rawReward) >= 0) {
    return { ...base, skipped: 'reward_not_negative' };
  }

  const ourDomain = normDomain(decision.domain);

  // ── Mots-clés candidats : page cible d'abord, puis cluster ──────────────
  type Kw = { keyword: string; current_position: number | null };
  let keywords: Kw[] = [];

  if (decision.target_url) {
    const { data } = await supabase
      .from('keyword_universe')
      .select('keyword, current_position')
      .eq('domain', decision.domain)
      .eq('mapped_url', decision.target_url)
      .not('current_position', 'is', null)
      .order('current_position', { ascending: true })
      .limit(MAX_KEYWORDS);
    keywords = (data ?? []) as Kw[];
  }

  if (keywords.length === 0 && decision.goal_cluster_id) {
    const { data } = await supabase
      .from('keyword_universe')
      .select('keyword, current_position')
      .eq('domain', decision.domain)
      .eq('cluster_id', decision.goal_cluster_id)
      .not('current_position', 'is', null)
      .order('current_position', { ascending: true })
      .limit(MAX_KEYWORDS);
    keywords = (data ?? []) as Kw[];
  }

  const stampScan = async () => {
    await supabase
      .from('pericles_decision_log')
      .update({ competitive_measured_at: new Date().toISOString() })
      .eq('id', decisionId);
  };

  if (keywords.length === 0) {
    await stampScan();
    return { ...base, skipped: 'no_keyword' };
  }

  let competitorGain = false;
  let scanned = 0;
  const snapshots: Record<string, unknown>[] = [];

  for (const kw of keywords.slice(0, MAX_KEYWORDS)) {
    let serp = null;
    try {
      serp = await getSerp(kw.keyword, {
        caller: 'pericles-competitive-scan',
        usageClass: 'position',
        userId: decision.user_id ?? null,
        trackedSiteId: decision.tracked_site_id ?? null,
        poolOnly: opts.poolOnly === true,
      });
    } catch (e) {
      console.warn(`[pericles-scan] serp failed (${kw.keyword}): ${(e as Error).message}`);
    }
    if (!serp || serp.organic.length === 0) continue;
    scanned++;

    const previous = kw.current_position ?? null;
    const ours = serp.organic.find(r => normDomain(r.domain) === ourDomain)?.position ?? null;

    const gainers = serp.organic
      .filter(r => normDomain(r.domain) !== ourDomain)
      .filter(r => previous !== null && r.position < previous && (ours === null || r.position < ours))
      .slice(0, 5)
      .map(r => ({ domain: normDomain(r.domain), position: r.position, url: r.url }));

    const weLost = previous !== null && (ours === null || ours > previous);
    if (weLost && gainers.length > 0) competitorGain = true;

    snapshots.push({
      decision_id: decisionId,
      user_id: decision.user_id ?? null,
      domain: decision.domain,
      keyword: kw.keyword,
      our_position: ours,
      our_previous_position: previous,
      top_domains: serp.organic.slice(0, 10).map(r => ({ domain: normDomain(r.domain), position: r.position })),
      gainers,
      serp_source: serp.source,
    });
  }

  if (snapshots.length > 0) {
    const { error } = await supabase.from('pericles_competitive_snapshots').insert(snapshots);
    if (error) console.warn('[pericles-scan] insert:', error.message);
  }

  if (scanned === 0) {
    await stampScan();
    return { ...base, snapshots: snapshots.length, skipped: 'serp_unavailable' };
  }

  const marketContext: MarketContext = competitorGain ? 'competitor_gain' : 'self_loss';

  const { error: rpcErr } = await supabase.rpc('pericles_apply_market_context', {
    p_decision_id: decisionId,
    p_market_context: marketContext,
  });
  if (rpcErr) console.warn('[pericles-scan] rpc:', rpcErr.message);

  console.log(`[pericles-scan] ${decision.domain} ${decisionId} → ${marketContext} (${scanned} kw)`);

  return {
    decision_id: decisionId,
    market_context: marketContext,
    keywords_scanned: scanned,
    snapshots: snapshots.length,
  };
}

/**
 * Traite les décisions récemment mesurées à récompense négative et non encore
 * arbitrées. Plafonné pour rester dans le budget SERP (≤ limit × 3 requêtes).
 */
export async function arbitrateNegativeRewards(
  supabase: SupabaseClient,
  limit = 3,
): Promise<CompetitiveScanResult[]> {
  const { data: decisions } = await supabase
    .from('pericles_decision_log')
    .select('id')
    .not('measured_at', 'is', null)
    .is('market_context', null)
    .is('competitive_measured_at', null)
    .lt('reward_signal', 0)
    .order('measured_at', { ascending: true })
    .limit(limit);

  const out: CompetitiveScanResult[] = [];
  for (const d of decisions ?? []) {
    out.push(await runPericlesCompetitiveScan(supabase, d.id as string));
  }
  return out;
}
