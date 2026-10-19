/**
 * gscMcpCore.ts — logique pure des outils MCP Search Console (lecture seule).
 *
 * Aucune entrée/sortie réseau ici : normalisation de la liste blanche,
 * validation des entrées, décision d'accès, mapping des erreurs Google,
 * calcul des totaux et deltas. Testée par gscMcpCore_test.ts.
 */

export interface GscToolError {
  code: number;
  message: string;
}

// ── Liste blanche ────────────────────────────────────────────

const DEFAULT_ALLOWED_DOMAINS = ['dictadevi.io', 'crawlers.fr', 'iktracker.fr'];

/**
 * Domaines autorisés. Surcharge uniquement via la variable d'environnement
 * serveur MCP_GSC_ALLOWED_SITES (liste séparée par des virgules).
 */
export function allowedDomains(envValue?: string | null): string[] {
  const raw = envValue ?? null;
  if (raw && raw.trim()) {
    return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  }
  return [...DEFAULT_ALLOWED_DOMAINS];
}

/**
 * Normalise une entrée `site` (domaine nu, sc-domain: ou URL http/https)
 * en domaine nu minuscule. Retourne null si invalide.
 */
export function normalizeSiteInput(site: unknown): string | null {
  if (typeof site !== 'string') return null;
  let s = site.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('sc-domain:')) s = s.slice('sc-domain:'.length);
  else {
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return null;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    s = u.hostname;
  }
  s = s.replace(/^www\./, '').replace(/\.+$/, '');
  if (!s || !s.includes('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  return s;
}

/**
 * Vrai si l'entrée désigne exactement un domaine autorisé.
 * Correspondance stricte : un sous-domaine ou un suffixe piégé
 * (ex. `crawlers.fr.evil.test`) est refusé.
 */
export function isAllowedSite(site: unknown, domains: string[]): boolean {
  const bare = normalizeSiteInput(site);
  if (!bare) return false;
  return domains.includes(bare);
}

/** Filtre une liste de propriétés GSC sur la liste blanche. */
export function filterAllowedProperties(
  entries: Array<{ siteUrl?: string; permissionLevel?: string }>,
  domains: string[],
): Array<{ site_url: string; permission_level: string }> {
  return (entries ?? [])
    .filter((e) => typeof e?.siteUrl === 'string' && isAllowedSite(e.siteUrl, domains))
    .map((e) => ({ site_url: String(e.siteUrl), permission_level: String(e.permissionLevel ?? '') }));
}

/** Vrai si l'URL absolue appartient à la propriété (hôte = domaine autorisé). */
export function urlBelongsToProperty(url: unknown, site: unknown): boolean {
  if (typeof url !== 'string') return false;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const bare = normalizeSiteInput(site);
  return !!bare && host === bare;
}

// ── Contrôle d'accès ─────────────────────────────────────────

export interface GscCaller {
  isAdmin: boolean;
  via: 'key' | 'jwt';
  /** Services cochés sur la clé Marina (via === 'key' uniquement). */
  keyServices?: string[];
}

/**
 * Décision d'accès aux outils GSC : admin obligatoire ; par clé Marina,
 * la permission explicite `gsc` est exigée en plus.
 */
export function decideGscAccess(caller: GscCaller | null): GscToolError | null {
  if (!caller) return { code: -32001, message: 'Authentification requise.' };
  if (!caller.isAdmin) return { code: -32001, message: 'Réservé aux administrateurs.' };
  if (caller.via === 'key' && !(caller.keyServices ?? []).includes('gsc')) {
    return { code: -32001, message: "Cette clé n'a pas la permission gsc" };
  }
  return null;
}

// ── Validation des entrées ───────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIMENSIONS = ['query', 'page', 'country', 'device', 'date'] as const;
const FILTER_DIMENSIONS = ['query', 'page', 'country', 'device'] as const;
const FILTER_OPERATORS = ['equals', 'notEquals', 'contains', 'notContains', 'includingRegex', 'excludingRegex'] as const;
const SEARCH_TYPES = ['web', 'image', 'video', 'news', 'discover', 'googleNews'] as const;

const invalid = (message: string): GscToolError => ({ code: -32602, message });

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fenêtre par défaut : J-30 → J-2 (latence GSC). */
export function defaultWindow(): { start_date: string; end_date: string } {
  const end = shiftDays(todayUtc(), -2);
  return { start_date: shiftDays(end, -28), end_date: end };
}

export interface SearchAnalyticsInput {
  site: string;
  start_date: string;
  end_date: string;
  dimensions: string[];
  filters: Array<{ dimension: string; operator: string; expression: string }>;
  search_type: string;
  row_limit: number;
  start_row: number;
}

export function validateSearchAnalytics(args: Record<string, unknown>): SearchAnalyticsInput | GscToolError {
  const site = args['site'];
  if (typeof site !== 'string' || !site.trim()) return invalid('site est requis.');

  const def = defaultWindow();
  const start = args['start_date'] === undefined ? def.start_date : args['start_date'];
  const end = args['end_date'] === undefined ? def.end_date : args['end_date'];
  if (!isValidDate(start)) return invalid('start_date doit être au format YYYY-MM-DD.');
  if (!isValidDate(end)) return invalid('end_date doit être au format YYYY-MM-DD.');
  if (start > end) return invalid('start_date doit être antérieure ou égale à end_date.');
  if (end > todayUtc()) return invalid('end_date ne peut pas être dans le futur.');
  // Plage max 16 mois (~487 jours)
  if (start < shiftDays(end, -487)) return invalid('La plage maximale est de 16 mois.');

  let dimensions: string[] = [];
  if (args['dimensions'] !== undefined) {
    if (!Array.isArray(args['dimensions'])) return invalid('dimensions doit être un tableau.');
    dimensions = args['dimensions'].map(String);
    if (dimensions.length > 3) return invalid('dimensions : 3 maximum.');
    if (new Set(dimensions).size !== dimensions.length) return invalid('dimensions : pas de doublon.');
    for (const d of dimensions) {
      if (!(DIMENSIONS as readonly string[]).includes(d)) return invalid(`Dimension inconnue : ${d}.`);
    }
  }

  let filters: SearchAnalyticsInput['filters'] = [];
  if (args['filters'] !== undefined) {
    if (!Array.isArray(args['filters'])) return invalid('filters doit être un tableau.');
    if (args['filters'].length > 5) return invalid('filters : 5 maximum.');
    for (const f of args['filters']) {
      if (typeof f !== 'object' || f === null) return invalid('Chaque filtre doit être un objet.');
      const fo = f as Record<string, unknown>;
      const dim = String(fo['dimension'] ?? '');
      const op = String(fo['operator'] ?? '');
      const expr = String(fo['expression'] ?? '');
      if (!(FILTER_DIMENSIONS as readonly string[]).includes(dim)) return invalid(`Filtre : dimension inconnue (${dim}).`);
      if (!(FILTER_OPERATORS as readonly string[]).includes(op)) return invalid(`Filtre : opérateur inconnu (${op}).`);
      if (!expr) return invalid('Filtre : expression requise.');
      if (expr.length > 500) return invalid('Filtre : expression limitée à 500 caractères.');
      filters.push({ dimension: dim, operator: op, expression: expr });
    }
  }

  const searchType = args['search_type'] === undefined ? 'web' : String(args['search_type']);
  if (!(SEARCH_TYPES as readonly string[]).includes(searchType)) return invalid(`search_type doit valoir ${SEARCH_TYPES.join(', ')}.`);

  const rowLimit = args['row_limit'] === undefined ? 1000 : Number(args['row_limit']);
  if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 5000) return invalid('row_limit doit être un entier entre 1 et 5000.');

  const startRow = args['start_row'] === undefined ? 0 : Number(args['start_row']);
  if (!Number.isInteger(startRow) || startRow < 0) return invalid('start_row doit être un entier ≥ 0.');

  return {
    site: site.trim(),
    start_date: start,
    end_date: end,
    dimensions,
    filters,
    search_type: searchType,
    row_limit: rowLimit,
    start_row: startRow,
  };
}

export interface TopInput {
  site: string;
  days: 7 | 28 | 90;
  limit: number;
  country: string | null;
  device: string | null;
}

export function validateTop(args: Record<string, unknown>): TopInput | GscToolError {
  const site = args['site'];
  if (typeof site !== 'string' || !site.trim()) return invalid('site est requis.');
  const days = args['days'] === undefined ? 28 : Number(args['days']);
  if (![7, 28, 90].includes(days)) return invalid('days doit valoir 7, 28 ou 90.');
  const limit = args['limit'] === undefined ? 25 : Number(args['limit']);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return invalid('limit doit être un entier entre 1 et 100.');
  let country: string | null = null;
  if (args['country'] !== undefined) {
    country = String(args['country']).toLowerCase();
    if (!/^[a-z]{3}$/.test(country)) return invalid('country doit être un code ISO 3166-1 alpha-3.');
  }
  let device: string | null = null;
  if (args['device'] !== undefined) {
    device = String(args['device']).toLowerCase();
    if (!['desktop', 'mobile', 'tablet'].includes(device)) return invalid('device doit valoir desktop, mobile ou tablet.');
  }
  return { site: site.trim(), days: days as TopInput['days'], limit, country, device };
}

export interface HistoryInput {
  site: string;
  query: string | null;
  days: number;
}

export function validateHistory(args: Record<string, unknown>): HistoryInput | GscToolError {
  const site = args['site'];
  if (typeof site !== 'string' || !site.trim()) return invalid('site est requis.');
  const days = args['days'] === undefined ? 28 : Number(args['days']);
  if (!Number.isInteger(days) || days < 1 || days > 90) return invalid('days doit être un entier entre 1 et 90.');
  const query = args['query'] === undefined ? null : String(args['query']).trim();
  if (query !== null && query.length > 500) return invalid('query limitée à 500 caractères.');
  return { site: site.trim(), query: query || null, days };
}

export interface InspectionInput {
  site: string;
  urls: string[];
}

export function validateInspection(args: Record<string, unknown>): InspectionInput | GscToolError {
  const site = args['site'];
  if (typeof site !== 'string' || !site.trim()) return invalid('site est requis.');
  const urls = args['urls'];
  if (!Array.isArray(urls) || urls.length === 0) return invalid('urls doit être un tableau non vide.');
  if (urls.length > 5) return invalid('urls : 5 maximum par appel.');
  const out: string[] = [];
  for (const u of urls) {
    if (!urlBelongsToProperty(u, site)) return invalid('Chaque URL doit être absolue (http/https) et appartenir à la propriété.');
    out.push(String(u).trim());
  }
  return { site: site.trim(), urls: out };
}

// ── Erreurs Google ───────────────────────────────────────────

const REAUTH_MSG = 'Connexion Google expirée ou droits insuffisants : reconnecte Google dans Console';

/**
 * Mappe une réponse d'erreur Google vers un RpcError clair.
 * Jamais de corps brut ni de token dans le message.
 */
export function mapGoogleError(status: number, body: unknown, retryAfter?: string | null): GscToolError {
  const reasons = extractReasons(body);
  if (status === 429 || reasons.some((r) => r === 'quotaExceeded' || r === 'rateLimitExceeded' || r === 'userRateLimitExceeded')) {
    const wait = retryAfter && /^\d+$/.test(retryAfter) ? `${retryAfter} s` : 'quelques minutes';
    return { code: -32002, message: `Quota Search Console atteint, réessaie dans ${wait}.` };
  }
  if (status === 401 || status === 403) return { code: -32001, message: REAUTH_MSG };
  return { code: -32603, message: `Erreur Search Console (${status}).` };
}

function extractReasons(body: unknown): string[] {
  try {
    const errors = (body as any)?.error?.errors;
    if (!Array.isArray(errors)) return [];
    return errors.map((e: any) => String(e?.reason ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Totaux et deltas ─────────────────────────────────────────

export interface AnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Totaux : clics/impressions sommés, CTR global, position pondérée par impressions. */
export function computeTotals(rows: AnalyticsRow[]): { clicks: number; impressions: number; ctr: number; position: number } {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  for (const r of rows) {
    clicks += r.clicks || 0;
    impressions += r.impressions || 0;
    posWeighted += (r.position || 0) * (r.impressions || 0);
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = impressions > 0 ? posWeighted / impressions : 0;
  const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;
  return { clicks, impressions, ctr: round(ctr, 4), position: round(position, 2) };
}

export interface TopEntry {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicks_delta: number;
  position_delta: number;
}

/**
 * Joint la période courante à la période précédente (même durée) et calcule
 * les deltas de clics et de position. Clé = première dimension (query ou page).
 */
export function computeTopWithDeltas(
  current: AnalyticsRow[],
  previous: AnalyticsRow[],
  limit: number,
): TopEntry[] {
  const prevByKey = new Map<string, AnalyticsRow>();
  for (const r of previous) prevByKey.set(r.keys[0] ?? '', r);
  return current
    .slice()
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, limit)
    .map((r) => {
      const key = r.keys[0] ?? '';
      const prev = prevByKey.get(key);
      const round2 = (n: number) => Math.round(n * 100) / 100;
      return {
        key,
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: round2(r.ctr || 0),
        position: round2(r.position || 0),
        clicks_delta: (r.clicks || 0) - (prev?.clicks || 0),
        position_delta: prev ? round2((r.position || 0) - (prev.position || 0)) : 0,
      };
    });
}
