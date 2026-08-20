/**
 * Contrôle automatique des liens internes et sortants de crawlers.fr.
 *
 * Parcourt les pages publiques (sitemap dynamique), extrait chaque lien
 * (interne ET externe), vérifie son code de réponse, et alimente la file de
 * travail admin `link_health_queue`.
 *
 * Aucune modification de contenu, aucun appel LLM : 100 % déterministe, donc
 * zéro crédit consommé.
 *
 * Rotation : chaque page auditée conserve une ligne (statut `resolved` quand
 * elle est saine). Cette ligne sert de mémoire de rotation, ce qui évite de
 * revérifier toujours les mêmes pages et fait tourner l'ensemble du site.
 */

import {
  classifyLink,
  isFalsePositiveDomain,
  summarizeVerdicts,
  describeLinkHealth,
  type LinkVerdict,
} from '../../../supabase/functions/_shared/linkVerdictShared';

const SITE = 'https://crawlers.fr';
const DOMAIN = 'crawlers.fr';
const UA = 'Crawlers.fr link-health (+https://crawlers.fr)';

/** Bornes de coût : un run reste sous la limite de temps d'un worker. */
export const PAGES_PER_SCAN = 12;
const MAX_LINKS_PER_PAGE = 60;
const LINK_CONCURRENCY = 8;
const LINK_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 20000;

export interface BrokenLink {
  url: string;
  status: number | null;
  anchor?: string;
  reason: 'http_error' | 'network';
  /** Verdict du juge unique `linkVerdict` — même échelle que Marina et /audit-expert. */
  verdict: LinkVerdict;
  label: string;
  explanation: string;
}

export interface PageAudit {
  url: string;
  title: string | null;
  linksChecked: number;
  /** Liens cassés confirmés (404/410/451) — internes. */
  internal: BrokenLink[];
  /** Liens cassés confirmés — sortants. */
  external: BrokenLink[];
  /** Liens instables (5xx/429/timeout), en attente d'un 2e constat consécutif. */
  soft: BrokenLink[];
  /** Liens non vérifiables (401/403/405/999) : jamais un défaut du site. */
  blocked: BrokenLink[];
  fetchError: string | null;
  /** Phrase de synthèse normalisée, réutilisable telle quelle dans un rapport. */
  summary: string;
}

function isInternal(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, '') === DOMAIN;
  } catch {
    return false;
  }
}

/** URLs publiques du site, lues dans le sitemap dynamique. */
export async function loadSitemapUrls(): Promise<string[]> {
  const res = await fetch(`${SITE}/sitemap.xml`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`sitemap_unreachable_${res.status}`);
  const xml = await res.text();
  const urls = new Set<string>();
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1]!.replace(/&amp;/g, '&');
    if (raw.endsWith('.xml')) continue; // entrée de sitemap index, pas une page
    try {
      const u = new URL(raw);
      u.hash = '';
      urls.add(u.toString());
    } catch {
      /* loc invalide ignorée */
    }
  }
  return [...urls];
}

/** Extrait les liens (absolus et relatifs) d'un document HTML. */
export function extractLinks(html: string, pageUrl: string): { url: string; anchor: string }[] {
  const found = new Map<string, string>();
  const re = /<a\b[^>]*href\s*=\s*["']([^"'>]+)["'][^>]*>([\s\S]{0,150}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
    abs.hash = '';
    const key = abs.toString();
    if (found.has(key)) continue;
    const anchor = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    found.set(key, anchor);
  }
  return [...found].map(([url, anchor]) => ({ url, anchor })).slice(0, MAX_LINKS_PER_PAGE);
}

/** HEAD puis GET de repli : renvoie `null` quand le lien est sain. */
async function checkLink(url: string): Promise<{ status: number | null } | null> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
    });
    return res.status;
  };
  try {
    let status = await attempt('HEAD');
    // Beaucoup de serveurs refusent HEAD ou filtrent les robots :
    // on ne conclut jamais « lien mort » sans un GET de confirmation.
    if (status === 403 || status === 405 || status === 429 || status === 501 || status >= 500) {
      status = await attempt('GET');
    }
    return status >= 400 ? { status } : null;
  } catch {
    return { status: null };
  }
}

async function mapLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i]!);
    }
  });
  await Promise.all(workers);
}

/** Audite une page : chargement, extraction des liens, contrôle de chacun. */
export async function auditPage(
  url: string,
  cache: Map<string, { status: number | null } | null>,
  /** Constats négatifs consécutifs déjà connus, par URL cible (règle des 2 constats). */
  priorFailures: Map<string, number> = new Map(),
): Promise<PageAudit> {
  const base: PageAudit = {
    url,
    title: null,
    linksChecked: 0,
    internal: [],
    external: [],
    soft: [],
    blocked: [],
    fetchError: null,
    summary: '',
  };

  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok) return { ...base, fetchError: `page_status_${res.status}` };
    html = await res.text();
  } catch (e) {
    return { ...base, fetchError: `page_unreachable: ${(e as Error).message}` };
  }

  base.title =
    (html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] || '')
      .replace(/\s+/g, ' ')
      .trim() || null;

  const links = extractLinks(html, url);
  base.linksChecked = links.length;

  await mapLimited(links, LINK_CONCURRENCY, async (link) => {
    let result = cache.get(link.url);
    if (result === undefined) {
      result = await checkLink(link.url);
      cache.set(link.url, result);
    }
    if (!result) return;

    // Juge unique : une seule échelle de verdicts pour toutes les surfaces.
    const cls = classifyLink({
      url: link.url,
      status: result.status,
      consecutiveFailures: (priorFailures.get(link.url) ?? 0) + 1,
    });

    const entry: BrokenLink = {
      url: link.url,
      status: result.status,
      ...(link.anchor ? { anchor: link.anchor } : {}),
      reason: result.status === null ? 'network' : 'http_error',
      verdict: cls.verdict,
      label: cls.label,
      explanation: cls.explanation,
    };

    // Un domaine connu pour filtrer les robots n'est jamais compté comme cassé.
    if (cls.verdict === 'blocked' || (cls.verdict === 'soft_broken' && isFalsePositiveDomain(link.url))) {
      base.blocked.push(entry);
      return;
    }
    if (cls.verdict === 'soft_broken') {
      base.soft.push(entry);
      return;
    }
    if (cls.verdict === 'hard_broken') {
      if (isInternal(link.url)) base.internal.push(entry);
      else base.external.push(entry);
    }
  });

  base.summary = describeLinkHealth(
    summarizeVerdicts(
      [...base.internal, ...base.external, ...base.soft, ...base.blocked].map((b) =>
        classifyLink({
          url: b.url,
          status: b.status,
          consecutiveFailures: (priorFailures.get(b.url) ?? 0) + 1,
        }),
      ),
    ),
  );

  return base;
}

/**
 * Score de priorité : un lien interne cassé pèse plus qu'un lien sortant
 * (maillage + expérience), une page inaccessible passe devant tout le reste.
 * Les liens instables pèsent peu : ils ne sont pas encore confirmés.
 */
export function scoreAudit(a: PageAudit): {
  priority: number;
  severity: 'critical' | 'warning' | 'info';
} {
  if (a.fetchError) return { priority: 100, severity: 'critical' };
  const priority = Math.min(
    95,
    a.internal.length * 12 + a.external.length * 4 + a.soft.length * 2,
  );
  const severity = a.internal.length > 0 ? 'critical' : a.external.length > 0 ? 'warning' : 'info';
  return { priority, severity };
}

type Db = { from: (table: string) => any };

/** Les titres HTML arrivent encodés (`&amp;`) : la file admin doit être lisible. */
function decodeEntities(text: string | null): string | null {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&(?:eacute|#233);/g, 'é')
    .replace(/&(?:egrave|#232);/g, 'è')
    .replace(/&(?:agrave|#224);/g, 'à');
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return DOMAIN;
  }
}

export async function persistAudit(sb: Db, a: PageAudit, source: string) {
  const { priority, severity } = scoreAudit(a);
  // Seuls les liens cassés confirmés comptent : instables et non vérifiables
  // sont conservés pour la traçabilité, sans polluer le décompte.
  const brokenCount = a.internal.length + a.external.length;
  const isClean = brokenCount === 0 && !a.fetchError;
  const nowIso = new Date().toISOString();

  const { data: existing } = await sb
    .from('link_health_queue')
    .select('id, status, first_detected_at, consecutive_failures')
    .eq('url', a.url)
    .maybeSingle();

  // Un élément écarté par un admin (lien volontairement mort, faux positif)
  // reste écarté : on rafraîchit seulement le constat.
  const status =
    existing?.status === 'dismissed' ? 'dismissed' : isClean ? 'resolved' : 'pending';

  const payload = {
    url: a.url,
    domain: hostOf(a.url),
    source,
    title: decodeEntities(a.title),
    status,
    severity: isClean ? 'info' : severity,
    priority_score: isClean ? 0 : priority,
    links_checked: a.linksChecked,
    broken_count: brokenCount,
    internal_broken: a.internal,
    external_broken: a.external,
    soft_broken: a.soft,
    blocked_links: a.blocked,
    hard_broken_count: brokenCount,
    soft_broken_count: a.soft.length,
    blocked_count: a.blocked.length,
    consecutive_failures: isClean ? 0 : (existing?.consecutive_failures ?? 0) + 1,
    fetch_error: a.fetchError,
    first_detected_at: isClean ? null : (existing?.first_detected_at ?? nowIso),
    last_checked_at: nowIso,
    resolved_at: isClean ? nowIso : null,
  };

  if (existing?.id) {
    await sb.from('link_health_queue').update(payload).eq('id', existing.id);
  } else {
    await sb.from('link_health_queue').insert(payload);
  }
  return { broken: brokenCount, clean: isClean, soft: a.soft.length, blocked: a.blocked.length };
}

export interface ScanResult {
  sitemap_urls: number;
  pages_scanned: number;
  pages_with_issues: number;
  broken_links: number;
  soft_links: number;
  blocked_links: number;
  links_probed: number;
}

/** Lot de pages, en rotation : jamais vérifiées d'abord, puis les plus anciennes. */
export async function runLinkScan(sb: Db, limit = PAGES_PER_SCAN): Promise<ScanResult> {
  const sitemapUrls = await loadSitemapUrls();
  if (!sitemapUrls.length) throw new Error('sitemap_empty');

  const { data: known } = await sb
    .from('link_health_queue')
    .select('url, last_checked_at, consecutive_failures')
    .order('last_checked_at', { ascending: true })
    .limit(5000);

  const seen = new Map<string, string>();
  const failures = new Map<string, number>();
  for (const row of (known ?? []) as {
    url: string;
    last_checked_at: string;
    consecutive_failures?: number | null;
  }[]) {
    seen.set(row.url, row.last_checked_at);
    if (row.consecutive_failures) failures.set(row.url, row.consecutive_failures);
  }

  const never = sitemapUrls.filter((u) => !seen.has(u));
  const stale = sitemapUrls
    .filter((u) => seen.has(u))
    .sort((a, b) => (seen.get(a)! < seen.get(b)! ? -1 : 1));
  const batch = [...never, ...stale].slice(0, Math.max(1, Math.min(limit, 30)));

  const cache = new Map<string, { status: number | null } | null>();
  let pagesWithIssues = 0;
  let brokenLinks = 0;
  let softLinks = 0;
  let blockedLinks = 0;

  for (const url of batch) {
    // Historique de la page : sert la règle des 2 constats consécutifs.
    const prior = new Map<string, number>();
    const pagePrior = failures.get(url) ?? 0;
    if (pagePrior > 0) prior.set(url, pagePrior);
    const audit = await auditPage(url, cache, prior);
    const res = await persistAudit(sb, audit, 'sitemap');
    if (!res.clean) pagesWithIssues++;
    brokenLinks += res.broken;
    softLinks += res.soft;
    blockedLinks += res.blocked;
  }

  return {
    sitemap_urls: sitemapUrls.length,
    pages_scanned: batch.length,
    pages_with_issues: pagesWithIssues,
    broken_links: brokenLinks,
    soft_links: softLinks,
    blocked_links: blockedLinks,
    links_probed: cache.size,
  };
}

export async function recheckItem(sb: Db, itemId: string) {
  const { data: item } = await sb
    .from('link_health_queue')
    .select('id, url, source, consecutive_failures')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) throw new Error('item_not_found');
  const prior = new Map<string, number>();
  if (item.consecutive_failures) prior.set(item.url, item.consecutive_failures);
  const audit = await auditPage(item.url, new Map(), prior);
  const res = await persistAudit(sb, audit, item.source || 'sitemap');
  return { item_id: itemId, url: item.url as string, broken_count: res.broken, resolved: res.clean };
}
