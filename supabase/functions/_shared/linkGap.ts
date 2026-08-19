/**
 * linkGap.ts — Lot 4 : link gap automatique contre les concurrents déjà
 * déclarés dans la carte d'identité, transformé en tâches exécutables.
 *
 * Différenciant vs Semrush : le gap n'est pas une simple liste, il est écrit
 * dans `architect_workbench` avec `finding_category = 'link_gap'`, donc
 * consommable par Parménion / Code Architect comme n'importe quelle autre
 * prescription.
 *
 * Un seul appel payant (`backlinks/domain_intersection/live`), mis en cache
 * 7 jours : les profils de liens bougent lentement.
 */
import { cacheKey, getCached, setCache } from './auditCache.ts';
import { dfsBacklinksPost, normalizeDomainRank } from './domainAuthority.ts';

export const LINK_GAP_CACHE_MINUTES = 60 * 24 * 7;
export const LINK_GAP_MAX_COMPETITORS = 3;
export const LINK_GAP_LIMIT = 100;

/** Un domaine qui lie au moins un concurrent mais pas le site audité. */
export interface LinkGapOpportunity {
  domain: string;
  /** rank normalisé 0-100 du domaine référent */
  rank: number;
  /** concurrents (parmi ceux déclarés) liés par ce domaine */
  competitors_linking: string[];
  /** backlinks émis vers les concurrents (somme de l'échantillon) */
  backlinks: number;
}

export interface LinkGapResult {
  domain: string;
  competitors: string[];
  opportunities: LinkGapOpportunity[];
  /** Nombre de domaines référents manquants détectés dans l'échantillon */
  gap_count: number;
  /** Domaines qui lient au moins 2 concurrents : signal sectoriel fort */
  shared_gap_count: number;
  signals: string[];
  recommendation: string;
  source: 'dataforseo' | 'no_competitors' | 'unavailable';
  unavailable_reason?: string;
  fetched_at: string;
}

const INVALID_HOST = /^(?:www\.)?(?:google|facebook|instagram|linkedin|youtube|twitter|x|tiktok|pinterest|wikipedia)\./i;

/** Normalise une entrée (nom, URL ou domaine) en domaine exploitable, sinon null. */
export function toDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = String(raw).trim().toLowerCase();
  v = v.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/[),.;]+$/, '');
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v)) return null;
  if (INVALID_HOST.test(v)) return null;
  return v;
}

/**
 * Concurrents exploitables : la carte d'identité stocke souvent des noms
 * commerciaux, seuls les domaines réels sont utilisables pour un link gap.
 */
export function resolveCompetitorDomains(
  inputs: { identityCompetitors?: unknown; competitorUrls?: (string | null | undefined)[] },
  selfDomain: string,
): string[] {
  const self = toDomain(selfDomain);
  const raw: string[] = [];
  const ic = inputs.identityCompetitors;
  if (typeof ic === 'string') raw.push(...ic.split(/[,;\n|]/));
  else if (Array.isArray(ic)) raw.push(...ic.map((c) => (typeof c === 'string' ? c : (c as any)?.url || (c as any)?.domain || (c as any)?.name || '')));
  for (const u of inputs.competitorUrls || []) if (u) raw.push(u);

  const out: string[] = [];
  for (const entry of raw) {
    const d = toDomain(entry);
    if (!d || d === self) continue;
    if (!out.includes(d)) out.push(d);
    if (out.length >= LINK_GAP_MAX_COMPETITORS) break;
  }
  return out;
}

/** Lecture déterministe de la réponse `domain_intersection`. */
export function parseIntersection(raw: unknown, competitors: string[], selfDomain: string): LinkGapOpportunity[] {
  const items = (raw as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const out: LinkGapOpportunity[] = [];
  for (const it of items) {
    const refDomain = toDomain(it?.domain || it?.target);
    if (!refDomain || refDomain === selfDomain) continue;
    const intersections = it?.intersections && typeof it.intersections === 'object' ? it.intersections : {};
    const linking: string[] = [];
    let backlinks = 0;
    let selfLinked = false;
    for (const [k, v] of Object.entries(intersections as Record<string, any>)) {
      const target = toDomain(v?.target || k);
      const count = Number(v?.backlinks ?? v?.referring_pages ?? 1) || 0;
      if (target === selfDomain) { selfLinked = true; continue; }
      const idx = Number(k) - 1;
      const label = competitors.includes(target || '') ? (target as string) : competitors[idx] || target || k;
      if (label && !linking.includes(label)) linking.push(label);
      backlinks += count;
    }
    if (selfLinked || linking.length === 0) continue;
    out.push({
      domain: refDomain,
      rank: normalizeDomainRank(Number(it?.rank) || 0),
      competitors_linking: linking,
      backlinks,
    });
  }
  return out
    .sort((a, b) => b.competitors_linking.length - a.competitors_linking.length || b.rank - a.rank)
    .slice(0, 40);
}

function unavailable(domain: string, competitors: string[], reason: string, source: LinkGapResult['source'] = 'unavailable'): LinkGapResult {
  return {
    domain,
    competitors,
    opportunities: [],
    gap_count: 0,
    shared_gap_count: 0,
    signals: [],
    recommendation:
      source === 'no_competitors'
        ? "Aucun concurrent avec un domaine exploitable n'est déclaré dans la carte d'identité : renseignez 1 à 3 domaines concurrents pour activer le link gap."
        : `Link gap non mesuré (${reason}). N'affirmez aucune opportunité de lien non mesurée.`,
    source,
    unavailable_reason: reason,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Link gap mesuré : domaines liant les concurrents déclarés, mais pas le site.
 * Ne throw jamais.
 */
export async function fetchLinkGap(
  rawDomain: string,
  competitorDomains: string[],
  opts?: { skipCache?: boolean },
): Promise<LinkGapResult> {
  const domain = toDomain(rawDomain);
  if (!domain) return unavailable(rawDomain, [], 'domaine invalide');
  const competitors = competitorDomains.filter((c) => c && c !== domain).slice(0, LINK_GAP_MAX_COMPETITORS);
  if (competitors.length === 0) return unavailable(domain, [], 'aucun concurrent exploitable', 'no_competitors');

  const key = cacheKey('link-gap', { domain, competitors: [...competitors].sort() });
  if (!opts?.skipCache) {
    const cached = await getCached(key);
    if (cached?.source === 'dataforseo') return cached as LinkGapResult;
  }

  try {
    // `targets` : le site audité en position 1, les concurrents ensuite. Les
    // domaines liant les concurrents sans lier la position 1 sont le gap.
    const targets: Record<string, string> = { 1: domain };
    competitors.forEach((c, i) => { targets[String(i + 2)] = c; });

    const raw = await dfsBacklinksPost(
      'backlinks/domain_intersection/live',
      [{ targets, limit: LINK_GAP_LIMIT, order_by: ['1.rank,desc'], exclude_internal_backlinks: true, internal_list_limit: 1 }],
      'backlinks/domain_intersection/live',
      domain,
    );

    const opportunities = parseIntersection(raw, competitors, domain);
    const shared = opportunities.filter((o) => o.competitors_linking.length >= 2);
    const signals: string[] = [];
    if (shared.length >= 3) signals.push(`${shared.length} domaines lient au moins deux concurrents sans vous lier : socle de liens sectoriel manquant`);
    const strong = opportunities.filter((o) => o.rank >= 40);
    if (strong.length) signals.push(`${strong.length} domaine(s) référent(s) de rank ≥ 40 accessibles (déjà ouverts à votre secteur)`);
    if (opportunities.length === 0) signals.push('aucun domaine référent concurrent manquant dans cet échantillon');

    const top = opportunities.slice(0, 5).map((o) => o.domain).join(', ');
    const recommendation = opportunities.length
      ? `Priorisez les ${Math.min(opportunities.length, 5)} domaines les plus partagés par vos concurrents (${top}) : ils ont déjà accepté de citer votre secteur, le coût d'obtention y est le plus faible.`
      : "Vos concurrents déclarés n'apportent aucun domaine référent que vous n'avez pas déjà : cherchez des sources hors panel concurrentiel (presse locale, partenaires, annuaires métiers qualifiés).";

    const result: LinkGapResult = {
      domain,
      competitors,
      opportunities,
      gap_count: opportunities.length,
      shared_gap_count: shared.length,
      signals,
      recommendation,
      source: 'dataforseo',
      fetched_at: new Date().toISOString(),
    };
    await setCache(key, 'link-gap', result, LINK_GAP_CACHE_MINUTES);
    return result;
  } catch (e) {
    return unavailable(domain, competitors, e instanceof Error ? e.message : 'erreur inconnue');
  }
}

export interface LinkGapWorkbenchContext {
  userId: string;
  trackedSiteId: string | null;
  sourceFunction: string;
}

/** Lignes `architect_workbench` prêtes à upsert (finding_category = 'link_gap'). */
export function buildLinkGapWorkbenchItems(gap: LinkGapResult, ctx: LinkGapWorkbenchContext): any[] {
  if (gap.source !== 'dataforseo' || gap.opportunities.length === 0) return [];
  const items: any[] = [];
  const base = {
    tracked_site_id: ctx.trackedSiteId,
    user_id: ctx.userId,
    domain: gap.domain,
    finding_category: 'link_gap',
    source_type: 'audit_strategic' as const,
    source_function: ctx.sourceFunction,
    status: 'pending' as const,
    target_url: `https://${gap.domain}`,
  };

  items.push({
    ...base,
    title: `Link gap : ${gap.gap_count} domaines référents liant vos concurrents, pas vous`,
    description: `Concurrents comparés : ${gap.competitors.join(', ')}. ${gap.shared_gap_count} domaine(s) lient au moins deux d'entre eux. ${gap.recommendation}`,
    source_record_id: `link_gap_${gap.domain}`,
    severity: gap.shared_gap_count >= 5 ? 'danger' : 'warning',
    payload: { auto_generated: true, ...gap },
  });

  // Les 5 meilleures cibles deviennent des tâches unitaires exécutables.
  for (const o of gap.opportunities.slice(0, 5)) {
    items.push({
      ...base,
      title: `Obtenir un lien depuis ${o.domain} (rank ${o.rank}/100, lie ${o.competitors_linking.length} concurrent(s))`,
      description: `${o.domain} lie déjà ${o.competitors_linking.join(', ')} (${o.backlinks} lien(s) mesuré(s)) mais pas ${gap.domain}. Identifiez la page qui cite le concurrent, puis proposez une ressource équivalente ou supérieure sur votre domaine.`,
      source_record_id: `link_gap_${gap.domain}_${o.domain}`,
      severity: o.competitors_linking.length >= 2 || o.rank >= 40 ? 'warning' : 'info',
      payload: {
        auto_generated: true,
        referring_domain: o.domain,
        rank: o.rank,
        competitors_linking: o.competitors_linking,
        backlinks: o.backlinks,
        competitors: gap.competitors,
      },
    });
  }
  return items;
}

/** Upsert idempotent des findings link gap. Ne throw jamais. */
export async function writeLinkGapFindings(
  supabase: { from: (t: string) => any },
  gap: LinkGapResult,
  ctx: LinkGapWorkbenchContext,
): Promise<number> {
  const items = buildLinkGapWorkbenchItems(gap, ctx);
  if (items.length === 0) return 0;
  try {
    const payload = items.map((it) => ({ ...it, updated_at: new Date().toISOString() }));
    const { error } = await supabase
      .from('architect_workbench')
      .upsert(payload, { onConflict: 'source_type,source_record_id', ignoreDuplicates: false });
    if (error) {
      console.warn('[link-gap] upsert workbench échoué:', error.message);
      return 0;
    }
    return items.length;
  } catch (e) {
    console.warn('[link-gap] persistance échouée:', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Section texte injectable dans un prompt LLM. Jamais silencieuse. */
export function buildLinkGapPromptSection(gap: LinkGapResult | null | undefined): string {
  if (!gap) return 'LINK GAP : non mesuré pour cet audit. N\'invente aucune opportunité de lien.';
  if (gap.source !== 'dataforseo') return `LINK GAP : ${gap.recommendation}`;
  const top = gap.opportunities
    .slice(0, 8)
    .map((o) => `${o.domain} (rank ${o.rank}/100, lie ${o.competitors_linking.join('+')})`)
    .join(', ');
  return [
    `LINK GAP MESURÉ (DataForSEO, concurrents déclarés : ${gap.competitors.join(', ')}) :`,
    `- ${gap.gap_count} domaines référents liant au moins un concurrent sans vous lier (dont ${gap.shared_gap_count} liant ≥ 2 concurrents)`,
    gap.signals.length ? `- Signaux : ${gap.signals.join(' ; ')}` : '- Signaux : aucun',
    top ? `- Cibles prioritaires : ${top}` : '- Cibles prioritaires : aucune',
    `- Action liens : ${gap.recommendation}`,
  ].join('\n');
}
