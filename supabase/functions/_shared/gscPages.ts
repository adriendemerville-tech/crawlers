/**
 * gscPages.ts — Métriques Search Console au niveau page (dimension `page`).
 *
 * `gscQuery.ts` normalise la dimension `query` et perd la clé `page` : ce module
 * conserve l'URL, indispensable pour juger un corpus page par page (pruning,
 * dette de cannibalisation, fraîcheur).
 *
 * Aucune donnée inventée : sans connexion Google vérifiée, on retourne `null`
 * (absence de mesure) et non un tableau vide (corpus muet), pour que les
 * consommateurs distinguent « pas de données » de « aucun clic ».
 */
import { resolveGscAccess, gscWindow } from './gscQuery.ts';

export interface GscPageMetrics {
  url: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
}

/** Normalise une URL pour la comparer à celles du crawl (sans slash final, sans hash). */
export function normalizeUrlKey(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.host.replace(/^www\./, '')}${path}`.toLowerCase();
  } catch {
    return String(raw || '').replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Métriques page sur une fenêtre glissante (90 j par défaut).
 * Retourne `null` si aucune propriété GSC vérifiée ne couvre le domaine.
 */
export async function fetchGscPageMetrics(
  supabase: any,
  userId: string,
  domain: string,
  days = 90,
  rowLimit = 5000,
): Promise<Map<string, GscPageMetrics> | null> {
  const access = await resolveGscAccess(supabase, userId, domain);
  if (!access) return null;

  const { startDate, endDate } = gscWindow(days);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(access.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit }),
      signal: AbortSignal.timeout(25000),
    },
  );

  if (!res.ok) {
    console.warn(`[gscPages] searchAnalytics ${res.status} sur ${access.siteUrl}`);
    return null;
  }

  const data = await res.json().catch(() => ({}));
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const map = new Map<string, GscPageMetrics>();

  for (const row of rows) {
    const url = String(row.keys?.[0] || '');
    if (!url) continue;
    map.set(normalizeUrlKey(url), {
      url,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      position: Math.round((row.position || 0) * 100) / 100,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
    });
  }

  return map;
}
