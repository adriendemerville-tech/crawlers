/**
 * Bloc autorité / backlinks (DataForSEO) — partagé par l'audit stratégique,
 * Marina, Parménion et Stratège Cocoon.
 *
 * Deux appels DataForSEO maximum par domaine, mis en cache 24 h (les backlinks
 * bougent lentement) pour ne pas multiplier les appels payants.
 */
import { trackPaidApiCall } from './tokenTracker.ts';
import { cacheKey, getCached, setCache } from './auditCache.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

export interface AuthorityData {
  domain: string;
  /** Authority Score maison sur 100 (domain_rank + diversité des domaines référents) */
  authority_score: number;
  /** domain_rank DataForSEO (0-100) */
  domain_rank: number;
  referring_domains: number;
  referring_main_domains: number;
  backlinks_total: number;
  dofollow_ratio: number;
  broken_backlinks: number;
  first_seen: string | null;
  top_referring_domains: { domain: string; rank: number; backlinks: number }[];
  top_anchors: string[];
  data_source: 'dataforseo' | 'unavailable';
  unavailable_reason?: string;
  fetched_at: string;
}

export function hasAuthorityCredentials(): boolean {
  return !!(DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD);
}

/**
 * Normalise le rank DataForSEO (échelle backlinks 0–1000) vers une échelle 0–100.
 * Certains endpoints renvoient déjà du 0–100 : on ne divise que si > 100.
 */
export function normalizeDomainRank(rawRank: number): number {
  const r = Math.max(0, rawRank || 0);
  return Math.round(r > 100 ? r / 10 : r);
}

/** Score d'autorité déterministe : 60 % domain_rank (0-100), 40 % diversité (log10 des domaines référents). */
export function computeAuthorityScore(domainRank: number, referringDomains: number): number {
  const rankPart = Math.min(60, Math.max(0, Math.min(100, domainRank)) * 0.6);
  const diversityPart = referringDomains > 0
    ? Math.min(40, Math.round(Math.log10(referringDomains) * 11))
    : 0;
  return Math.max(0, Math.min(100, Math.round(rankPart + diversityPart)));
}


function unavailable(domain: string, reason: string): AuthorityData {
  return {
    domain, authority_score: 0, domain_rank: 0, referring_domains: 0, referring_main_domains: 0,
    backlinks_total: 0, dofollow_ratio: 0, broken_backlinks: 0, first_seen: null,
    top_referring_domains: [], top_anchors: [],
    data_source: 'unavailable', unavailable_reason: reason, fetched_at: new Date().toISOString(),
  };
}

async function dfsPost(path: string, payload: unknown, label: string, target: string) {
  const auth = 'Basic ' + btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
  const resp = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });
  if (!resp.ok) throw new Error(`DataForSEO ${path} → ${resp.status}`);
  await trackPaidApiCall('domain-authority', 'dataforseo', label, target).catch(() => {});
  return await resp.json();
}

/**
 * Récupère l'autorité de domaine + profil de backlinks.
 * Ne throw jamais : renvoie un objet `unavailable` explicite (pas de silence).
 */
export async function fetchDomainAuthority(
  rawDomain: string,
  opts?: { ttlMinutes?: number; skipCache?: boolean },
): Promise<AuthorityData> {
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!domain) return unavailable(rawDomain, 'domaine invalide');
  if (!hasAuthorityCredentials()) return unavailable(domain, 'identifiants DataForSEO absents');

  const key = cacheKey('domain-authority', { domain });
  if (!opts?.skipCache) {
    const cached = await getCached(key);
    if (cached?.data_source === 'dataforseo') return cached as AuthorityData;
  }

  try {
    const [summaryRes, refRes] = await Promise.allSettled([
      dfsPost('backlinks/summary/live', [{ target: domain, internal_list_limit: 5, include_subdomains: true }], 'backlinks/summary/live', domain),
      dfsPost('backlinks/referring_domains/live', [{ target: domain, limit: 5, order_by: ['rank,desc'] }], 'backlinks/referring_domains/live', domain),
    ]);

    if (summaryRes.status !== 'fulfilled') {
      return unavailable(domain, summaryRes.reason instanceof Error ? summaryRes.reason.message : 'appel backlinks/summary échoué');
    }

    const s = summaryRes.value?.tasks?.[0]?.result?.[0];
    if (!s) return unavailable(domain, 'réponse DataForSEO vide');

    const backlinksTotal = s.backlinks || 0;
    const dofollow = backlinksTotal > 0 ? Math.round(((backlinksTotal - (s.backlinks_nofollow || 0)) / backlinksTotal) * 100) : 0;
    const domainRank = normalizeDomainRank(s.rank || s.target_rank || 0);
    const referringDomains = s.referring_domains || 0;

    let topRef: AuthorityData['top_referring_domains'] = [];
    if (refRes.status === 'fulfilled') {
      topRef = (refRes.value?.tasks?.[0]?.result?.[0]?.items || [])
        .slice(0, 5)
        .map((r: any) => ({ domain: r.domain || '', rank: r.rank || 0, backlinks: r.backlinks || 0 }))
        .filter((r: any) => r.domain);
    }

    const topAnchors: string[] = Array.isArray(s.referring_links_anchors)
      ? Object.keys(s.referring_links_anchors).slice(0, 5)
      : Object.keys(s.referring_links_anchors || {}).slice(0, 5);

    const result: AuthorityData = {
      domain,
      authority_score: computeAuthorityScore(domainRank, referringDomains),
      domain_rank: domainRank,
      referring_domains: referringDomains,
      referring_main_domains: s.referring_main_domains || 0,
      backlinks_total: backlinksTotal,
      dofollow_ratio: dofollow,
      broken_backlinks: s.broken_backlinks || 0,
      first_seen: s.first_seen || null,
      top_referring_domains: topRef,
      top_anchors: topAnchors,
      data_source: 'dataforseo',
      fetched_at: new Date().toISOString(),
    };

    await setCache(key, 'domain-authority', result, opts?.ttlMinutes ?? 1440);
    return result;
  } catch (e) {
    return unavailable(domain, e instanceof Error ? e.message : 'erreur inconnue');
  }
}

/** Section texte injectable dans un prompt LLM. Jamais silencieuse. */
export function buildAuthorityPromptSection(a: AuthorityData | null): string {
  if (!a) return 'AUTORITE / BACKLINKS : bloc non collecté pour cet audit.';
  if (a.data_source !== 'dataforseo') {
    return `AUTORITE / BACKLINKS : données indisponibles (${a.unavailable_reason || 'raison inconnue'}). N'invente aucun chiffre de backlinks ni d'Authority Score.`;
  }
  const refs = a.top_referring_domains.length
    ? a.top_referring_domains.map(r => `${r.domain}(rank ${r.rank}, ${r.backlinks} liens)`).join(', ')
    : 'aucun domaine référent notable';
  return [
    `AUTORITE / BACKLINKS (DataForSEO, chiffres réels — ne pas deviner) :`,
    `- Authority Score Crawlers = ${a.authority_score}/100 (domain_rank DataForSEO=${a.domain_rank}/100)`,
    `- Domaines référents = ${a.referring_domains} (dont domaines principaux : ${a.referring_main_domains})`,
    `- Backlinks totaux = ${a.backlinks_total}, ratio dofollow = ${a.dofollow_ratio}%, liens cassés = ${a.broken_backlinks}`,
    `- Premier backlink observé : ${a.first_seen || 'inconnu'}`,
    `- Top domaines référents : ${refs}`,
    a.top_anchors.length ? `- Ancres principales : ${a.top_anchors.join(', ')}` : `- Ancres principales : non exploitables`,
  ].join('\n');
}
