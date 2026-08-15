/**
 * keywordPlanner.ts — Google Keyword Planner (Google Ads API) comme source GRATUITE de volumes.
 *
 * Remplace les appels payants DataForSEO `keywords_data/google_ads/search_volume`.
 * Source réelle : `KeywordPlanIdeaService.generateKeywordHistoricalMetrics`
 * (endpoint `customers/{cid}:generateKeywordHistoricalMetrics`, API v18).
 *
 * Pré-requis :
 *  - secret `GOOGLE_ADS_DEVELOPER_TOKEN`
 *  - une ligne `google_connections` avec `ads_customer_id` + scope `adwords`
 *
 * Les résultats sont mutualisés dans `keyword_volume_pool` (cache global, non scopé user)
 * afin qu'un mot-clé ne soit jamais payé/appelé deux fois pendant la fenêtre de fraîcheur.
 */

export interface PlannerMetric {
  keyword: string;
  avg_monthly_searches: number;
  competition: string | null;      // LOW | MEDIUM | HIGH
  competition_index: number | null; // 0-100
  low_top_of_page_bid_micros: number | null;
  high_top_of_page_bid_micros: number | null;
}

export interface AdsCredentials {
  access_token: string;
  customer_id: string;
  developer_token: string;
  login_customer_id: string | null;
  connection_id: string;
}

const ADS_API = 'https://googleads.googleapis.com/v18';

/** Geo target constants Google Ads (les plus courants pour nos marchés). */
export const GEO_TARGETS: Record<string, string> = {
  fr: '2250', be: '2056', ch: '2756', ca: '2124', lu: '2442',
  de: '2276', gb: '2826', us: '2840', es: '2724', it: '2380',
  ma: '2504', tn: '2788', dz: '2012', sn: '2686', ci: '2384',
};

export const LANG_CONSTANTS: Record<string, string> = {
  fr: '1002', en: '1000', de: '1001', es: '1003', it: '1004', pt: '1014', nl: '1010',
};

/** Résout un access token Google Ads frais + le customer id pour un utilisateur. */
export async function resolveAdsCredentials(
  supabase: any,
  userId: string,
): Promise<AdsCredentials | null> {
  const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
  if (!developerToken) {
    console.warn('[keywordPlanner] GOOGLE_ADS_DEVELOPER_TOKEN absent');
    return null;
  }

  const { data: conns } = await supabase
    .from('google_connections')
    .select('id, access_token, refresh_token, token_expiry, ads_customer_id, ads_login_customer_id, scopes')
    .eq('user_id', userId)
    .not('ads_customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(3);

  const conn = (conns || [])[0];
  if (!conn?.ads_customer_id) return null;

  const token = await ensureFreshAdsToken(supabase, conn);
  if (!token) return null;

  return {
    access_token: token,
    customer_id: String(conn.ads_customer_id).replace(/-/g, ''),
    developer_token: developerToken,
    login_customer_id: conn.ads_login_customer_id
      ? String(conn.ads_login_customer_id).replace(/-/g, '')
      : null,
    connection_id: conn.id,
  };
}

async function ensureFreshAdsToken(supabase: any, conn: any): Promise<string | null> {
  const expired = conn.token_expiry && new Date(conn.token_expiry) < new Date(Date.now() + 60_000);
  if (!expired) return conn.access_token;
  if (!conn.refresh_token) return null;

  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    console.error('[keywordPlanner] refresh token failed', resp.status);
    return null;
  }
  const t = await resp.json();
  await supabase.from('google_connections').update({
    access_token: t.access_token,
    token_expiry: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', conn.id);
  return t.access_token;
}

/**
 * Appelle generateKeywordHistoricalMetrics par lots.
 * Google accepte jusqu'à 10 000 mots-clés par requête ; on reste à 700 pour
 * borner la charge CPU de l'edge function et rester sous la limite de payload.
 */
export async function fetchPlannerMetrics(
  creds: AdsCredentials,
  keywords: string[],
  opts: { geo?: string; language?: string } = {},
): Promise<Map<string, PlannerMetric>> {
  const out = new Map<string, PlannerMetric>();
  const clean = dedupe(keywords);
  if (clean.length === 0) return out;

  const geo = GEO_TARGETS[(opts.geo || 'fr').toLowerCase()] || GEO_TARGETS.fr;
  const lang = LANG_CONSTANTS[(opts.language || 'fr').toLowerCase()] || LANG_CONSTANTS.fr;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.access_token}`,
    'developer-token': creds.developer_token,
    'Content-Type': 'application/json',
  };
  if (creds.login_customer_id) headers['login-customer-id'] = creds.login_customer_id;

  for (const batch of chunk(clean, 700)) {
    const body = {
      keywords: batch,
      geoTargetConstants: [`geoTargetConstants/${geo}`],
      language: `languageConstants/${lang}`,
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      includeAdultKeywords: false,
    };

    let resp: Response;
    try {
      resp = await fetch(
        `${ADS_API}/customers/${creds.customer_id}:generateKeywordHistoricalMetrics`,
        { method: 'POST', headers, body: JSON.stringify(body) },
      );
    } catch (e) {
      console.error('[keywordPlanner] network error', e);
      break;
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error(`[keywordPlanner] API ${resp.status}: ${txt.slice(0, 400)}`);
      // 401/403 = scope/dev-token invalide → inutile d'insister sur les lots suivants
      if (resp.status === 401 || resp.status === 403) break;
      continue;
    }

    const json = await resp.json();
    for (const r of json.results || []) {
      const kw: string = r.text || r.searchQuery || '';
      if (!kw) continue;
      const m = r.keywordMetrics || {};
      out.set(kw.toLowerCase(), {
        keyword: kw.toLowerCase(),
        avg_monthly_searches: Number(m.avgMonthlySearches ?? 0),
        competition: m.competition ?? null,
        competition_index: m.competitionIndex != null ? Number(m.competitionIndex) : null,
        low_top_of_page_bid_micros: m.lowTopOfPageBidMicros != null ? Number(m.lowTopOfPageBidMicros) : null,
        high_top_of_page_bid_micros: m.highTopOfPageBidMicros != null ? Number(m.highTopOfPageBidMicros) : null,
      });
    }
  }

  return out;
}

/** Difficulté approximative 0-100 depuis les signaux Ads (competition_index sinon competition). */
export function plannerDifficulty(m: PlannerMetric): number {
  if (m.competition_index != null) return Math.max(0, Math.min(100, Math.round(m.competition_index)));
  const map: Record<string, number> = { LOW: 25, MEDIUM: 50, HIGH: 80 };
  return map[m.competition || ''] ?? 30;
}

export function dedupe(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keywords) {
    const c = (k || '').trim().toLowerCase();
    if (c.length < 2 || c.length > 80 || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
