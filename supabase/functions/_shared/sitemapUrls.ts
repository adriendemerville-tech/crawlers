/**
 * Récupération légère des URL d'un sitemap (aucun LLM, aucun crawl headless).
 * Utilisé pour pondérer la répartition des types de pages sur l'ensemble du site
 * plutôt que sur le seul périmètre crawlé.
 */

const MAX_URLS = 5000;
const MAX_CHILD_SITEMAPS = 8;
const TIMEOUT_MS = 8000;

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr)' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].replace(/&amp;/g, '&'));
    if (out.length >= MAX_URLS) break;
  }
  return out;
}

/** Retourne les URL de pages du sitemap (index de sitemaps suivi), ou [] si indisponible. */
export async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const base = domain.startsWith('http') ? domain.replace(/\/+$/, '') : `https://${domain}`;
  const candidates = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/sitemap-index.xml`];

  for (const candidate of candidates) {
    const xml = await fetchText(candidate);
    if (!xml) continue;
    const locs = extractLocs(xml);
    if (!locs.length) continue;

    const isIndex = /<sitemapindex/i.test(xml);
    if (!isIndex) return locs.slice(0, MAX_URLS);

    const children = locs.filter((u) => /\.xml(\.gz)?($|\?)/i.test(u)).slice(0, MAX_CHILD_SITEMAPS);
    const all: string[] = [];
    for (const child of children) {
      if (all.length >= MAX_URLS) break;
      const childXml = await fetchText(child);
      if (!childXml) continue;
      all.push(...extractLocs(childXml));
    }
    if (all.length) return all.slice(0, MAX_URLS);
  }
  return [];
}
