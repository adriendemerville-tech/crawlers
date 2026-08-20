/**
 * parmenionPass.ts — Passe de rejugement des priorités, par site.
 *
 * Pourquoi une passe séparée des écrivains : une vingtaine de fonctions
 * alimentent `architect_workbench` (marina, check-eeat, cocoon-diag-*,
 * agent-seo…). Leur demander à chacune un ROI cohérent serait ingérable. La
 * passe arrive après elles, avec la seule chose qu'aucune n'a : la vue
 * d'ensemble du corpus. C'est cette vue qui manquait — un article à 3 clics est
 * un constat mineur ; quinze articles à 3 clics sur la même intention sont un
 * problème de cannibalisation qui interdit d'en publier un seizième.
 *
 * Écrit `priority_score`, `roi_tier`, `is_quick_win` sur les constats actifs et
 * une ligne de dette par (user, domaine) dans `site_pruning_debt`.
 *
 * 100 % déterministe : aucun appel LLM, aucun token consommé.
 */
import {
  computePruningDebt,
  finalPriority,
  type DebtRegime,
  type PruningDebt,
} from './parmenionPriority.ts';

const ACTIVE_STATUSES = ['pending', 'in_progress', 'assigned'];
const CREATION_HINTS = ['create_content', 'publish_draft', 'create_page', 'new_content'];

export interface PassSiteResult {
  domain: string;
  debt: PruningDebt | null;
  scored: number;
  frozen: number;
}

/** Déduit la nature de l'action quand `action_type` est absent ou trop générique. */
export function inferActionType(item: { action_type?: string | null; title?: string | null; description?: string | null }): string {
  const explicit = String(item.action_type || '').toLowerCase();
  if (explicit) {
    if (CREATION_HINTS.some((h) => explicit.includes(h))) return 'create_content';
    return explicit;
  }
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  if (/(créer|creer|rédiger|rediger|publier|nouvel article|nouvelle page)/.test(text)) return 'create_content';
  if (/(fusionn|consolid|regroup)/.test(text)) return 'merge';
  if (/(supprim|désindex|desindex|dépubli|depubli)/.test(text)) return 'prune';
  if (/(redirig|301)/.test(text)) return 'redirect';
  return 'optimize';
}

/** Ramène les sévérités du workbench sur le vocabulaire de `roiWeighting`. */
export function severityToRoi(sev: string | null | undefined): string {
  const s = String(sev || '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high' || s === 'important' || s === 'medium') return 'important';
  if (s === 'low' || s === 'info') return 'low';
  return 'suggestion';
}

async function creationsLast30Days(sb: any, domain: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count } = await sb
    .from('content_generation_logs')
    .select('id', { count: 'exact', head: true })
    .ilike('domain', `%${domain}%`)
    .gte('created_at', since);
  return count || 0;
}

export async function runPriorityPassForSite(
  sb: any,
  site: { user_id: string; domain: string; tracked_site_id?: string | null },
): Promise<PassSiteResult> {
  const debt = await computePruningDebt(sb, {
    domain: site.domain,
    userId: site.user_id,
    trackedSiteId: site.tracked_site_id ?? null,
  }).catch(() => null);

  const regime: DebtRegime = debt?.regime || 'healthy';
  const recentCreations = await creationsLast30Days(sb, site.domain).catch(() => 0);

  const { data: items } = await sb
    .from('architect_workbench')
    .select('id, title, description, severity, finding_category, action_type, payload')
    .eq('user_id', site.user_id)
    .eq('domain', site.domain)
    .in('status', ACTIVE_STATUSES)
    .limit(600);

  let scored = 0;
  let frozen = 0;

  for (const item of items || []) {
    const payload = item.payload || {};
    const result = finalPriority(
      {
        title: item.title || '',
        description: item.description || '',
        severity: severityToRoi(item.severity),
        category: item.finding_category || undefined,
        pages_affected: payload.pages_affected || undefined,
        keyword_volume: payload.keyword_volume || undefined,
        current_position: payload.current_position || undefined,
        action_type: inferActionType(item),
        documented_semantic_gap: Boolean(payload.semantic_gap_documented || payload.content_gap_evidence),
        competing_pages: Number(payload.competing_pages ?? 0),
      },
      {
        usefulPages: debt?.useful_pages ?? 0,
        recentCreations,
        regime,
        contentPriorityMode: true,
        pagesAnalyzed: debt?.corpus_size ?? null,
        hasOwnerPerformance: debt?.metrics_available ?? false,
      },
    );

    if (result.frozen) frozen++;

    await sb
      .from('architect_workbench')
      .update({
        priority_score: result.priority_score,
        roi_tier: result.roi_tier,
        is_quick_win: result.is_quick_win,
        payload: {
          ...payload,
          priority_explanation: result.explanation || undefined,
          pruning_regime: regime,
          creation_frozen: result.frozen || undefined,
          roi: result.roi,
        },
      })
      .eq('id', item.id);

    scored++;
  }

  if (debt) {
    await sb.from('site_pruning_debt').upsert(
      {
        user_id: site.user_id,
        tracked_site_id: site.tracked_site_id ?? null,
        domain: site.domain,
        debt: debt.debt,
        regime: debt.regime,
        corpus_size: debt.corpus_size,
        useful_pages: debt.useful_pages,
        mute_ratio: debt.mute_ratio,
        cannibal_ratio: debt.cannibal_ratio,
        cannibal_clusters: debt.cannibal_clusters,
        prunable_ratio: debt.prunable_ratio,
        concentration: debt.concentration,
        metrics_available: debt.metrics_available,
        insufficient_data: debt.insufficient_data,
        explanation: debt.explanation,
        items_scored: scored,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,domain' },
    );
  }

  console.log(
    `[parmenion-priority-pass] ${site.domain} — dette ${debt?.debt ?? 'n/a'} (${regime}), ${scored} constat(s) rescorés, ${frozen} création(s) gelée(s)`,
  );

  return { domain: site.domain, debt, scored, frozen };
}

/** Passe complète : tous les couples (user, domaine) ayant des constats actifs. */
export async function runPriorityPass(
  sb: any,
  opts: { domain?: string | null; userId?: string | null; limit?: number } = {},
): Promise<{ sites_processed: number; sites_available: number; results: PassSiteResult[] }> {
  let q = sb
    .from('architect_workbench')
    .select('user_id, domain, tracked_site_id')
    .in('status', ACTIVE_STATUSES)
    .not('domain', 'is', null)
    .limit(4000);
  if (opts.domain) q = q.eq('domain', opts.domain.replace(/^www\./, '').toLowerCase());
  if (opts.userId) q = q.eq('user_id', opts.userId);

  const { data: rows } = await q;

  const sites = new Map<string, { user_id: string; domain: string; tracked_site_id?: string | null }>();
  for (const r of rows || []) {
    const key = `${r.user_id}::${r.domain}`;
    if (!sites.has(key)) {
      sites.set(key, { user_id: r.user_id, domain: r.domain, tracked_site_id: r.tracked_site_id });
    }
  }

  const limit = Math.min(opts.limit ?? 20, 60);
  const results: PassSiteResult[] = [];
  for (const site of [...sites.values()].slice(0, limit)) {
    try {
      results.push(await runPriorityPassForSite(sb, site));
    } catch (e) {
      console.error(`[parmenion-priority-pass] échec sur ${site.domain}:`, e instanceof Error ? e.message : e);
      results.push({ domain: site.domain, debt: null, scored: 0, frozen: 0 });
    }
  }

  return { sites_processed: results.length, sites_available: sites.size, results };
}
