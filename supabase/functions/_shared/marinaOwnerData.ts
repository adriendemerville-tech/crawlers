/**
 * marinaOwnerData.ts — Section « Données propriétaires » de Marina
 *
 * Si (et seulement si) l'utilisateur qui lance l'audit possède une connexion
 * Google valide couvrant CE nom de domaine, on irrigue le rapport avec ses
 * données réelles :
 *   - Search Console : clics / impressions / CTR / position sur 28 jours,
 *     comparaison avec les 28 jours précédents, top requêtes, top pages.
 *   - GA4 : sessions, utilisateurs, taux d'engagement, durée moyenne.
 *
 * Contrat : best-effort et silencieux. Aucune connexion, aucune propriété
 * correspondante ou aucune donnée => `null` => la section n'apparaît pas du
 * tout dans le rapport (ni dans le sommaire), et l'audit reste inchangé.
 * Zéro token LLM : tout est déterministe.
 */

import { resolveGoogleToken } from './resolveGoogleToken.ts';
import { fetchGA4Engagement, type GA4Engagement } from './fetchGA4.ts';

const GSC_API = 'https://www.googleapis.com/webmasters/v3';

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface OwnerPerformanceData {
  domain: string;
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  gsc: {
    current: GscTotals;
    previous: GscTotals | null;
    topQueries: GscRow[];
    topPages: GscRow[];
  } | null;
  ga4: (GA4Engagement & { propertyId: string }) | null;
}

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function gscQuery(
  token: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(
      `${GSC_API}/sites/${encodeURIComponent(propertyId)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!resp.ok) {
      console.warn(`[marinaOwnerData] GSC query ${resp.status} on ${propertyId}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.warn('[marinaOwnerData] GSC query failed:', err);
    return null;
  }
}

/** Propriété vérifiée couvrant réellement le domaine (jamais devinée). */
async function resolveProperty(token: string, domain: string): Promise<string | null> {
  const bare = domain.replace(/^www\./, '').toLowerCase();
  try {
    const resp = await fetch(`${GSC_API}/sites`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const { siteEntry = [] } = await resp.json();
    const verified = (siteEntry as any[]).filter(
      (e) => e?.permissionLevel && e.permissionLevel !== 'siteUnverifiedUser',
    );
    const covers = (siteUrl: string) => {
      const s = String(siteUrl);
      if (s.startsWith('sc-domain:')) {
        const d = s.slice('sc-domain:'.length).toLowerCase();
        return bare === d || bare.endsWith(`.${d}`);
      }
      try {
        const host = new URL(s).hostname.replace(/^www\./, '').toLowerCase();
        return host === bare;
      } catch {
        return false;
      }
    };
    const matches = verified.filter((e) => covers(e.siteUrl));
    if (!matches.length) return null;
    // Préférence déterministe : propriété domaine (couverture la plus large).
    const domainProp = matches.find((e) => String(e.siteUrl).startsWith('sc-domain:'));
    return (domainProp ?? matches[0]).siteUrl as string;
  } catch {
    return null;
  }
}

function totalsFromRows(rows: any[]): GscTotals | null {
  if (!rows?.length) return null;
  const r = rows[0];
  return {
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
    position: Number(r.position) || 0,
  };
}

function dimensionRows(rows: any[] | undefined): GscRow[] {
  return (rows || []).map((r) => ({
    key: String(r.keys?.[0] ?? ''),
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
    position: Number(r.position) || 0,
  }));
}

/**
 * Récupère les données propriétaires du domaine pour cet utilisateur.
 * Retourne null dès qu'il n'y a rien d'exploitable.
 */
export async function fetchOwnerPerformanceData(
  supabase: any,
  userId: string,
  domain: string,
): Promise<OwnerPerformanceData | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  if (!clientId || !clientSecret) return null;

  let resolved: Awaited<ReturnType<typeof resolveGoogleToken>> = null;
  try {
    resolved = await resolveGoogleToken(supabase, userId, domain, clientId, clientSecret);
  } catch (err) {
    console.warn('[marinaOwnerData] token resolution failed:', err);
    return null;
  }
  if (!resolved?.access_token) return null;

  const token = resolved.access_token;

  // GSC a ~2 jours de latence : la fenêtre s'arrête à J-3.
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - 27 * 86400000);
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - 27 * 86400000);

  const propertyId = await resolveProperty(token, domain);

  let gsc: OwnerPerformanceData['gsc'] = null;
  if (propertyId) {
    const [cur, prev, queries, pages] = await Promise.all([
      gscQuery(token, propertyId, { startDate: iso(start), endDate: iso(end) }),
      gscQuery(token, propertyId, { startDate: iso(prevStart), endDate: iso(prevEnd) }),
      gscQuery(token, propertyId, {
        startDate: iso(start), endDate: iso(end),
        dimensions: ['query'], rowLimit: 10,
      }),
      gscQuery(token, propertyId, {
        startDate: iso(start), endDate: iso(end),
        dimensions: ['page'], rowLimit: 10,
      }),
    ]);
    const current = totalsFromRows(cur?.rows || []);
    if (current && (current.impressions > 0 || current.clicks > 0)) {
      gsc = {
        current,
        previous: totalsFromRows(prev?.rows || []),
        topQueries: dimensionRows(queries?.rows),
        topPages: dimensionRows(pages?.rows),
      };
    }
  }

  let ga4: OwnerPerformanceData['ga4'] = null;
  if (resolved.ga4_property_id) {
    const engagement = await fetchGA4Engagement({
      accessToken: token,
      propertyId: resolved.ga4_property_id,
      daysBack: 28,
    });
    if (engagement && (engagement.sessions > 0 || engagement.pageviews > 0)) {
      ga4 = { ...engagement, propertyId: resolved.ga4_property_id };
    }
  }

  if (!gsc && !ga4) return null;

  return {
    domain,
    propertyId: propertyId || '',
    periodStart: iso(start),
    periodEnd: iso(end),
    gsc,
    ga4,
  };
}

// ─── Rendu HTML (charte Crawlers : violet / or / noir / blanc, sans emoji) ───

const VIOLET = '#6d28d9';
const GOLD = '#d4af37';

function pct(v: number): string {
  return `${(v * 100).toFixed(1)} %`;
}

function delta(cur: number, prev: number | null | undefined, invert = false): string {
  if (prev === null || prev === undefined || prev === 0) return '';
  const diff = ((cur - prev) / prev) * 100;
  if (!isFinite(diff) || Math.abs(diff) < 0.5) return `<span style="color:#6b7280;font-size:12px;"> stable</span>`;
  const positive = invert ? diff < 0 : diff > 0;
  const color = positive ? '#15803d' : '#b91c1c';
  const sign = diff > 0 ? '+' : '';
  return `<span style="color:${color};font-size:12px;"> ${sign}${diff.toFixed(1)} %</span>`;
}

function statCard(label: string, value: string, extra = ''): string {
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;min-width:150px;flex:1;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">${label}</div>
    <div style="font-size:20px;font-weight:700;color:#111827;">${value}${extra}</div>
  </div>`;
}

function rowsTable(title: string, rows: GscRow[], isUrl: boolean): string {
  if (!rows.length) return '';
  const body = rows
    .map((r) => {
      const label = isUrl
        ? `<a href="${r.key}" target="_blank" rel="noopener" style="color:${VIOLET};text-decoration:none;">${r.key.replace(/^https?:\/\/[^/]+/, '') || '/'}</a>`
        : r.key;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;">${label}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;">${r.clicks}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;">${r.impressions}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;">${pct(r.ctr)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;">${r.position.toFixed(1)}</td>
      </tr>`;
    })
    .join('');
  return `<h3 style="font-size:14px;margin:18px 0 8px 0;color:#111827;">${title}</h3>
  <table style="width:100%;border-collapse:collapse;page-break-inside:avoid;">
    <thead><tr>
      <th style="text-align:left;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#6b7280;">${isUrl ? 'Page' : 'Requête'}</th>
      <th style="text-align:right;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#6b7280;">Clics</th>
      <th style="text-align:right;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#6b7280;">Impressions</th>
      <th style="text-align:right;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#6b7280;">CTR</th>
      <th style="text-align:right;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#6b7280;">Position</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

/** Lecture business déterministe des données propriétaires (0 token). */
function readings(data: OwnerPerformanceData): string[] {
  const out: string[] = [];
  const g = data.gsc;
  if (g) {
    const c = g.current;
    if (c.impressions > 0 && c.ctr < 0.015 && c.position <= 15) {
      out.push(
        `Le site est vu (${c.impressions} impressions) mais peu cliqué (CTR ${pct(c.ctr)}) alors que la position moyenne est ${c.position.toFixed(1)} : le problème est d'abord un problème de titres et de méta-descriptions, pas de classement.`,
      );
    }
    if (c.position > 15) {
      out.push(
        `Position moyenne ${c.position.toFixed(1)} : la majorité des requêtes se situe au-delà de la première page. Les gains rapides viendront des requêtes déjà entre la 8e et la 20e place, pas de nouveaux contenus.`,
      );
    }
    if (g.previous && g.previous.clicks > 0) {
      const diff = ((c.clicks - g.previous.clicks) / g.previous.clicks) * 100;
      if (diff <= -15) {
        out.push(
          `Les clics reculent de ${Math.abs(diff).toFixed(0)} % par rapport aux 28 jours précédents : à confronter en priorité aux constats techniques et d'indexation de ce rapport.`,
        );
      } else if (diff >= 15) {
        out.push(
          `Les clics progressent de ${diff.toFixed(0)} % par rapport aux 28 jours précédents : les actions du plan ci-dessous consolident une dynamique déjà installée.`,
        );
      }
    }
  }
  const a = data.ga4;
  if (a) {
    if (a.engagement_rate > 0 && a.engagement_rate < 0.45) {
      out.push(
        `Taux d'engagement de ${pct(a.engagement_rate)} : l'audience arrive mais ne s'engage pas. Les priorités éditoriales et de conversion priment sur l'acquisition de nouvelles requêtes.`,
      );
    }
    if (a.avg_session_duration > 0 && a.avg_session_duration < 30) {
      out.push(
        `Durée moyenne de session de ${Math.round(a.avg_session_duration)} s : à croiser avec la vitesse réelle et la lisibilité relevées dans la section technique.`,
      );
    }
  }
  if (!out.length) {
    out.push(
      `Aucun signal d'alerte majeur ne ressort des données propriétaires sur la période : les priorités de ce rapport restent celles issues du crawl, du technique et de la visibilité IA.`,
    );
  }
  return out;
}

/**
 * Rend la section. Retourne '' si aucune donnée (la section disparaît).
 */
export function renderOwnerPerformanceHTML(
  data: OwnerPerformanceData | null,
  sectionNumber: string,
): string {
  if (!data || (!data.gsc && !data.ga4)) return '';

  const g = data.gsc;
  const a = data.ga4;

  const gscBlock = g
    ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
        ${statCard('Clics (28 j)', String(g.current.clicks), delta(g.current.clicks, g.previous?.clicks))}
        ${statCard('Impressions', String(g.current.impressions), delta(g.current.impressions, g.previous?.impressions))}
        ${statCard('CTR moyen', pct(g.current.ctr), delta(g.current.ctr, g.previous?.ctr))}
        ${statCard('Position moyenne', g.current.position.toFixed(1), delta(g.current.position, g.previous?.position, true))}
      </div>
      ${rowsTable('Requêtes les plus performantes', g.topQueries, false)}
      ${rowsTable('Pages les plus performantes', g.topPages, true)}`
    : `<p style="font-size:13px;color:#6b7280;">Aucune donnée Search Console exploitable sur la période pour ce domaine.</p>`;

  const ga4Block = a
    ? `<h3 style="font-size:14px;margin:20px 0 8px 0;color:#111827;">Comportement des visiteurs (Analytics, 28 jours)</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${statCard('Sessions', String(a.sessions))}
        ${statCard('Utilisateurs', String(a.total_users))}
        ${statCard("Taux d'engagement", pct(a.engagement_rate))}
        ${statCard('Durée moyenne', `${Math.round(a.avg_session_duration)} s`)}
      </div>`
    : '';

  const readingItems = readings(data)
    .map((r) => `<li style="margin-bottom:6px;">${r}</li>`)
    .join('');

  return `<div class="section" data-marina-scope="site" data-marina-block="owner-performance" data-pdf-section style="border-left:6px solid ${GOLD};">
    <div class="section-title"><span class="section-number">${sectionNumber}</span> Données propriétaires du domaine</div>
    <p style="font-size:13px;color:#4b5563;line-height:1.7;margin-bottom:14px;">
      Ce que mesure cette section : les performances réelles de ${data.domain} telles que Google les rapporte au propriétaire du site,
      sur les 28 jours arrêtés au ${data.periodEnd}. Contrairement au reste du rapport, ces chiffres ne sont pas estimés :
      ils proviennent des comptes Search Console et Analytics connectés par le propriétaire. Ils servent d'arbitre
      lorsqu'un constat technique et la réalité du trafic semblent se contredire.
    </p>
    ${gscBlock}
    ${ga4Block}
    <h3 style="font-size:14px;margin:20px 0 8px 0;color:#111827;">Ce que ces données changent dans la lecture de l'audit</h3>
    <ul style="font-size:13px;color:#374151;line-height:1.7;padding-left:18px;margin:0;">${readingItems}</ul>
    <p style="font-size:11px;color:#9ca3af;margin-top:14px;line-height:1.6;">
      Source : ${g ? `propriété Search Console ${data.propertyId}` : 'Search Console indisponible'}${a ? ` et propriété Analytics ${a.propertyId}` : ''}.
      Search Console publie ses données avec environ deux jours de décalage et omet les requêtes à très faible volume :
      les totaux ci-dessus sont donc une borne basse prudente. Cette section n'apparaît que si une connexion Google
      vérifiée couvre ce nom de domaine ; à défaut, l'audit reste intégralement fondé sur des mesures externes.
    </p>
  </div>`;
}
