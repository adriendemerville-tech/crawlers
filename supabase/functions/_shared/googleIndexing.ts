/**
 * googleIndexing.ts — Google Indexing API (URL_UPDATED / URL_DELETED).
 *
 * IMPORTANT : l'Indexing API n'accepte PAS de clé API simple (GOOGLE_API_KEY).
 * Elle exige un jeton OAuth 2.0 portant le scope
 * `https://www.googleapis.com/auth/indexing`, obtenu via le flux Google
 * existant (`gsc-auth`, module « indexing »).
 *
 * Portée officielle : JobPosting et BroadcastEvent. Les autres pages sont
 * acceptées par l'endpoint mais leur prise en compte n'est pas garantie —
 * on journalise donc chaque envoi et on plafonne le quota (200/jour).
 */

const ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications/publish';

/** Quota quotidien Google par projet (documenté à 200 notifications/jour). */
export const GOOGLE_INDEXING_DAILY_QUOTA = 200;

export type IndexingNotificationType = 'URL_UPDATED' | 'URL_DELETED';

export interface GoogleIndexingItem {
  url: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface GoogleIndexingResult {
  submitted: number;
  failed: number;
  items: GoogleIndexingItem[];
}

/**
 * Résout un access_token disposant du scope indexing pour un domaine donné.
 * Cherche parmi les google_connections (scopes + gsc_site_urls) et rafraîchit
 * le jeton si nécessaire.
 */
export async function resolveIndexingToken(
  supabase: any,
  domain: string,
  clientId: string,
  clientSecret: string,
  userId?: string,
): Promise<{ access_token: string; connection_id: string; user_id: string } | null> {
  const bare = domain.replace(/^www\./, '').toLowerCase();

  let query = supabase.from('google_connections').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data: connections } = await query;
  if (!connections?.length) return null;

  const matchesDomain = (conn: any): boolean => {
    const urls: string[] = Array.isArray(conn.gsc_site_urls) ? conn.gsc_site_urls : [];
    return urls.some((u: string) =>
      String(u).toLowerCase()
        .replace(/^sc-domain:/, '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '') === bare
    );
  };

  const hasIndexingScope = (conn: any): boolean =>
    Array.isArray(conn.scopes) && conn.scopes.includes('https://www.googleapis.com/auth/indexing');

  // Priorité : scope indexing + domaine, puis scope indexing seul.
  const candidates = [
    ...connections.filter((c: any) => hasIndexingScope(c) && matchesDomain(c)),
    ...connections.filter((c: any) => hasIndexingScope(c) && !matchesDomain(c)),
  ];

  for (const conn of candidates) {
    const token = await ensureFreshToken(supabase, conn, clientId, clientSecret);
    if (token) return { access_token: token, connection_id: conn.id, user_id: conn.user_id };
  }

  return null;
}

/** Notifie Google d'une liste d'URL (séquentiel léger, 4 en parallèle max). */
export async function notifyGoogleIndexing(
  urls: string[],
  accessToken: string,
  type: IndexingNotificationType = 'URL_UPDATED',
): Promise<GoogleIndexingResult> {
  const items: GoogleIndexingItem[] = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const slice = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((url) => publishOne(url, accessToken, type)));
    items.push(...results);
  }

  return {
    submitted: items.filter((i) => i.success).length,
    failed: items.filter((i) => !i.success).length,
    items,
  };
}

async function publishOne(
  url: string,
  accessToken: string,
  type: IndexingNotificationType,
): Promise<GoogleIndexingItem> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type }),
    });

    if (res.ok) return { url, success: true, statusCode: res.status };

    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => '');
    }

    const map: Record<number, string> = {
      401: 'Jeton OAuth expiré ou scope indexing absent.',
      403: "Le compte Google n'est pas propriétaire vérifié de cette propriété (ou API Indexing non activée).",
      429: 'Quota Indexing API dépassé.',
    };
    return {
      url,
      success: false,
      statusCode: res.status,
      error: `${map[res.status] || `Erreur Indexing API (${res.status})`}${detail ? ` — ${detail.slice(0, 240)}` : ''}`,
    };
  } catch (err) {
    return { url, success: false, error: `Erreur réseau : ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Nombre de notifications Google déjà envoyées aujourd'hui (quota 200/jour). */
export async function googleQuotaUsedToday(supabase: any): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('url_indexing_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('engine', 'google')
    .eq('success', true)
    .gte('submitted_at', startOfDay.toISOString());
  return count || 0;
}

/** URL déjà notifiées à Google avec succès dans les dernières 24 h. */
export async function recentGoogleSubmissions(supabase: any, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from('url_indexing_submissions')
    .select('url')
    .eq('engine', 'google')
    .eq('success', true)
    .gte('submitted_at', cutoff)
    .in('url', urls.slice(0, 500));
  return new Set((data || []).map((r: { url: string }) => r.url));
}

async function ensureFreshToken(
  supabase: any,
  conn: any,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const expired = conn.token_expiry && new Date(conn.token_expiry) < new Date(Date.now() + 60_000);
  if (!expired) return conn.access_token || null;
  if (!conn.refresh_token) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.access_token) return null;

    await supabase
      .from('google_connections')
      .update({
        access_token: json.access_token,
        token_expiry: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    return json.access_token;
  } catch {
    return null;
  }
}
