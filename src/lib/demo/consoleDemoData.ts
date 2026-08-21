/**
 * Jeux de données fictives (front uniquement) pour le mode démo de la Console.
 * Aucune écriture en base : ces objets servent uniquement à peupler l'UI
 * des modules qui n'ont pas de données réelles sur le compte admin
 * (GSC BigQuery, Indexation, Logs / activité des bots).
 *
 * Les valeurs sont déterministes (pas de Math.random au niveau module)
 * pour éviter tout écart SSR / hydratation.
 */

const DEMO_DOMAIN = 'exemple-demo.fr';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

/* ------------------------------------------------------------------ */
/* GSC BigQuery                                                        */
/* ------------------------------------------------------------------ */

export interface DemoBigQueryRow {
  query?: string;
  url?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  avg_position?: number;
  url_count?: number;
  word_count?: number;
}

export interface DemoBigQueryResult {
  rows: DemoBigQueryRow[];
  cache: 'hit' | 'miss';
  bytes_processed: number;
  rows_returned: number;
}

const TOP_QUERIES: DemoBigQueryRow[] = [
  { query: 'audit seo gratuit', impressions: 48210, clicks: 3120, ctr: 0.0647, avg_position: 4.2 },
  { query: 'optimisation balise title', impressions: 31480, clicks: 2410, ctr: 0.0765, avg_position: 3.1 },
  { query: 'maillage interne exemple', impressions: 24980, clicks: 1180, ctr: 0.0472, avg_position: 6.8 },
  { query: 'generative engine optimization', impressions: 19870, clicks: 1620, ctr: 0.0815, avg_position: 2.7 },
  { query: 'crawl budget definition', impressions: 15310, clicks: 604, ctr: 0.0394, avg_position: 9.4 },
  { query: 'score geo site web', impressions: 12760, clicks: 918, ctr: 0.0719, avg_position: 5.3 },
  { query: 'outil analyse logs serveur', impressions: 10420, clicks: 388, ctr: 0.0372, avg_position: 11.2 },
  { query: 'cocon semantique 3d', impressions: 8940, clicks: 712, ctr: 0.0796, avg_position: 3.9 },
  { query: 'indexation google api', impressions: 7610, clicks: 231, ctr: 0.0303, avg_position: 13.6 },
  { query: 'checklist seo technique', impressions: 6480, clicks: 402, ctr: 0.062, avg_position: 7.1 },
];

const CANNIBALIZATION: DemoBigQueryRow[] = [
  { query: 'balise title seo', url_count: 4, impressions: 18420, clicks: 690, avg_position: 8.9 },
  { query: 'audit technique site', url_count: 3, impressions: 12310, clicks: 540, avg_position: 7.4 },
  { query: 'maillage interne', url_count: 3, impressions: 9870, clicks: 402, avg_position: 9.8 },
  { query: 'optimisation geo ia', url_count: 2, impressions: 7420, clicks: 318, avg_position: 6.2 },
  { query: 'crawler site web', url_count: 2, impressions: 5310, clicks: 187, avg_position: 12.1 },
];

const LONGTAIL: DemoBigQueryRow[] = [
  { query: 'comment optimiser une balise title pour le seo', word_count: 8, impressions: 4120, clicks: 96, ctr: 0.0233, avg_position: 12.4 },
  { query: 'quel outil pour analyser les logs serveur seo', word_count: 8, impressions: 3480, clicks: 74, ctr: 0.0213, avg_position: 14.8 },
  { query: 'comment etre cite par chatgpt', word_count: 6, impressions: 3110, clicks: 118, ctr: 0.0379, avg_position: 9.6 },
  { query: 'difference entre seo et geo referencement', word_count: 7, impressions: 2740, clicks: 61, ctr: 0.0223, avg_position: 16.2 },
  { query: 'exemple de cocon semantique pour un site vitrine', word_count: 9, impressions: 2180, clicks: 48, ctr: 0.022, avg_position: 18.9 },
];

const CTR_GAP: DemoBigQueryRow[] = [
  { url: `https://${DEMO_DOMAIN}/blog/audit-seo-complet`, impressions: 21400, clicks: 610, ctr: 0.0285, avg_position: 4.8 },
  { url: `https://${DEMO_DOMAIN}/services/referencement-naturel`, impressions: 16120, clicks: 402, ctr: 0.0249, avg_position: 5.6 },
  { url: `https://${DEMO_DOMAIN}/blog/maillage-interne-guide`, impressions: 12980, clicks: 291, ctr: 0.0224, avg_position: 6.3 },
  { url: `https://${DEMO_DOMAIN}/tarifs`, impressions: 9410, clicks: 188, ctr: 0.02, avg_position: 7.9 },
  { url: `https://${DEMO_DOMAIN}/blog/geo-ia-visibilite`, impressions: 7860, clicks: 149, ctr: 0.019, avg_position: 8.4 },
];

export function getDemoBigQueryResult(kind: string): DemoBigQueryResult {
  let rows: DemoBigQueryRow[];
  let bytes: number;
  switch (kind) {
    case 'cannibalization_candidates':
      rows = CANNIBALIZATION;
      bytes = 412_398_112;
      break;
    case 'longtail_opportunities':
      rows = LONGTAIL;
      bytes = 318_774_020;
      break;
    case 'ctr_gap_quickwins':
      rows = CTR_GAP;
      bytes = 287_112_446;
      break;
    case 'top_queries_90d':
      rows = TOP_QUERIES.map((r) => ({
        ...r,
        impressions: Math.round((r.impressions ?? 0) * 2.9),
        clicks: Math.round((r.clicks ?? 0) * 2.7),
      }));
      bytes = 1_284_004_998;
      break;
    default:
      rows = TOP_QUERIES;
      bytes = 496_221_338;
  }
  return { rows, cache: 'miss', bytes_processed: bytes, rows_returned: rows.length };
}

/* ------------------------------------------------------------------ */
/* Indexation                                                          */
/* ------------------------------------------------------------------ */

export interface DemoIndexationCheck {
  id: string;
  page_url: string;
  verdict: string;
  coverage_state: string | null;
  indexing_state: string | null;
  crawled_as: string | null;
  last_crawl_time: string | null;
  robots_txt_state: string | null;
  page_fetch_state: string | null;
  rich_results_errors: unknown;
  referring_urls: string[];
  checked_at: string;
}

const INDEXATION_SEED: Array<{
  path: string;
  verdict: string;
  coverage: string;
  indexing: string;
  crawlHours: number;
}> = [
  { path: '/', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 6 },
  { path: '/services/referencement-naturel', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 14 },
  { path: '/blog/audit-seo-complet', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 22 },
  { path: '/blog/maillage-interne-guide', verdict: 'PARTIAL', coverage: 'Détectée, actuellement non indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 96 },
  { path: '/blog/geo-ia-visibilite', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 30 },
  { path: '/tarifs', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 40 },
  { path: '/contact', verdict: 'PARTIAL', coverage: 'Explorée, actuellement non indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 168 },
  { path: '/blog/checklist-seo-technique', verdict: 'FAIL', coverage: 'Exclue par une balise noindex', indexing: 'BLOCKED_BY_META_TAG', crawlHours: 210 },
  { path: '/ressources/glossaire', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 54 },
  { path: '/blog/cocon-semantique-exemple', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 12 },
  { path: '/a-propos', verdict: 'PASS', coverage: 'Envoyée et indexée', indexing: 'INDEXING_ALLOWED', crawlHours: 76 },
  { path: '/blog/analyse-logs-serveur', verdict: 'FAIL', coverage: 'Introuvable (404)', indexing: 'INDEXING_ALLOWED', crawlHours: 240 },
];

export function getDemoIndexationChecks(domain?: string | null): DemoIndexationCheck[] {
  const base = `https://${(domain || DEMO_DOMAIN).replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return INDEXATION_SEED.map((s, i) => ({
    id: `demo-idx-${i}`,
    page_url: `${base}${s.path}`,
    verdict: s.verdict,
    coverage_state: s.coverage,
    indexing_state: s.indexing,
    crawled_as: i % 3 === 0 ? 'DESKTOP' : 'MOBILE',
    last_crawl_time: hoursAgo(s.crawlHours),
    robots_txt_state: 'ALLOWED',
    page_fetch_state: s.verdict === 'FAIL' && s.path.includes('analyse-logs') ? 'NOT_FOUND' : 'SUCCESSFUL',
    rich_results_errors: null,
    referring_urls: [`${base}/`, `${base}/blog`],
    checked_at: hoursAgo(Math.max(1, Math.round(s.crawlHours / 4))),
  }));
}

/* ------------------------------------------------------------------ */
/* Logs / activité des bots                                            */
/* ------------------------------------------------------------------ */

export interface DemoBotEntry {
  id: string;
  bot_name: string | null;
  bot_category: string | null;
  path: string | null;
  ts: string;
  status_code: number | null;
  tracked_site_id: string;
  domain?: string;
  verification_status?: 'verified' | 'suspect' | 'stealth' | 'unverified' | null;
  verification_method?: 'rdns_match' | 'asn_range' | 'ua_only' | 'behavioral' | 'none' | null;
  confidence_score?: number | null;
}

const BOT_SEED: Array<{
  bot: string;
  category: string;
  status: DemoBotEntry['verification_status'];
  method: DemoBotEntry['verification_method'];
  confidence: number;
  path: string;
  code: number;
}> = [
  { bot: 'GPTBot', category: 'ai_training', status: 'verified', method: 'rdns_match', confidence: 96, path: '/blog/audit-seo-complet', code: 200 },
  { bot: 'Googlebot', category: 'search_engine', status: 'verified', method: 'rdns_match', confidence: 99, path: '/', code: 200 },
  { bot: 'ClaudeBot', category: 'ai_training', status: 'verified', method: 'asn_range', confidence: 91, path: '/blog/geo-ia-visibilite', code: 200 },
  { bot: 'PerplexityBot', category: 'ai_fetch', status: 'verified', method: 'asn_range', confidence: 88, path: '/services/referencement-naturel', code: 200 },
  { bot: 'ChatGPT-User', category: 'ai_fetch', status: 'verified', method: 'rdns_match', confidence: 94, path: '/tarifs', code: 200 },
  { bot: 'Bingbot', category: 'search_engine', status: 'verified', method: 'rdns_match', confidence: 97, path: '/blog/maillage-interne-guide', code: 200 },
  { bot: 'Googlebot', category: 'search_engine', status: 'suspect', method: 'ua_only', confidence: 42, path: '/wp-login.php', code: 404 },
  { bot: 'Google-Extended', category: 'ai_training', status: 'verified', method: 'asn_range', confidence: 90, path: '/ressources/glossaire', code: 200 },
  { bot: 'Amazonbot', category: 'other', status: 'unverified', method: 'none', confidence: 30, path: '/contact', code: 200 },
  { bot: 'GPTBot', category: 'ai_training', status: 'suspect', method: 'ua_only', confidence: 38, path: '/admin', code: 403 },
  { bot: 'Applebot', category: 'search_engine', status: 'verified', method: 'rdns_match', confidence: 93, path: '/a-propos', code: 200 },
  { bot: 'meta-externalagent', category: 'ai_training', status: 'stealth', method: 'behavioral', confidence: 24, path: '/blog/cocon-semantique-exemple', code: 200 },
  { bot: 'YandexBot', category: 'search_engine', status: 'unverified', method: 'none', confidence: 28, path: '/blog', code: 200 },
  { bot: 'PerplexityBot', category: 'ai_fetch', status: 'verified', method: 'rdns_match', confidence: 95, path: '/blog/checklist-seo-technique', code: 200 },
  { bot: 'CCBot', category: 'ai_training', status: 'suspect', method: 'ua_only', confidence: 45, path: '/sitemap.xml', code: 200 },
  { bot: 'Googlebot', category: 'search_engine', status: 'verified', method: 'rdns_match', confidence: 98, path: '/sitemap.xml', code: 200 },
  { bot: 'ClaudeBot', category: 'ai_training', status: 'verified', method: 'rdns_match', confidence: 92, path: '/blog/analyse-logs-serveur', code: 200 },
  { bot: 'ChatGPT-User', category: 'ai_fetch', status: 'verified', method: 'asn_range', confidence: 87, path: '/', code: 200 },
];

export function getDemoBotEntries(
  siteId = 'demo-site',
  domain: string = DEMO_DOMAIN,
): DemoBotEntry[] {
  return BOT_SEED.map((s, i) => ({
    id: `demo-bot-${i}`,
    bot_name: s.bot,
    bot_category: s.category,
    path: s.path,
    ts: minutesAgo(2 + i * 17),
    status_code: s.code,
    tracked_site_id: siteId,
    domain,
    verification_status: s.status,
    verification_method: s.method,
    confidence_score: s.confidence,
  }));
}

export interface DemoReliabilityKPIs {
  total: number;
  verified: number;
  suspect: number;
  stealth: number;
  unverified: number;
  topImpostors: Array<{ bot_name: string; count: number }>;
}

export function getDemoReliabilityKPIs(): DemoReliabilityKPIs {
  return {
    total: 4820,
    verified: 3914,
    suspect: 512,
    stealth: 208,
    unverified: 186,
    topImpostors: [
      { bot_name: 'Googlebot', count: 214 },
      { bot_name: 'GPTBot', count: 148 },
      { bot_name: 'CCBot', count: 96 },
      { bot_name: 'meta-externalagent', count: 71 },
      { bot_name: 'Bingbot', count: 44 },
    ],
  };
}

export const DEMO_SITE = { id: 'demo-site', domain: DEMO_DOMAIN };
