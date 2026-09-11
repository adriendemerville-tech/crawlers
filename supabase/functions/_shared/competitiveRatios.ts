/* ==================================================================== */
/*  Audit comparé récurrent — page auditée + pages piliers               */
/*  Déterministe : aucun LLM. SERP mutualisée via serpPool, HTML via     */
/*  stealthFetch, scoring via computeSeoScoreV2. Cache MENSUEL.          */
/* ==================================================================== */

import { getSerp } from './serpPool.ts';
import { stealthFetchText } from './stealthFetch.ts';
import { computeSeoScoreV2 } from './seoScoringV2.ts';
import { resolvePillarSet, isPillarUrl } from './pillarWeighting.ts';

/** Nombre maximal de pages comparées par site et par mois. */
export const MAX_TARGETS = 5;
/** Nombre de concurrents SERP retenus par page. */
export const MAX_COMPETITORS = 5;

export interface RatioTarget {
  url: string;
  keyword: string;
}

export interface PageMetrics {
  words: number;
  semantic: number;
  seo: number;
  strong: number;
  h2: number;
  imagesWithoutAlt: number;
}

export interface CompetitiveRatioRow {
  url: string;
  keyword: string;
  is_pillar: boolean;
  own: PageMetrics;
  competitors: PageMetrics & { sample: number; domains: string[] };
  ratios: { words: number; semantic: number; seo: number };
  verdict: 'ahead' | 'parity' | 'behind';
}

export interface CompetitiveRatiosResult {
  period_month: string;
  rows: CompetitiveRatioRow[];
  source: 'cache' | 'fresh';
}

function periodMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function measure(html: string): PageMetrics {
  const text = stripHtml(html);
  const score = computeSeoScoreV2(html, text, { pageType: 'landing' });
  const axes = score.axes;
  const semantic = Math.round(
    (axes.content_depth + axes.keyword_relevance + axes.content_density) / 3,
  );
  const imgs = html.match(/<img[^>]*>/gi) || [];
  return {
    words: score.contentDensity.wordCount,
    semantic,
    seo: score.overall,
    strong: (html.match(/<strong[\s>]/gi) || []).length + (html.match(/<b[\s>]/gi) || []).length,
    h2: score.headings.h2Count,
    imagesWithoutAlt: imgs.filter((t) => !/\salt\s*=/i.test(t)).length,
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function ratio(own: number, ref: number): number {
  if (!ref) return own ? 1 : 0;
  return Math.round((own / ref) * 100) / 100;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { text, status } = await stealthFetchText(url, { timeout: 12000 });
    if (status >= 400 || !text) return null;
    return text.slice(0, 900_000);
  } catch {
    return null;
  }
}
/**
 * Résout le périmètre comparé : la page auditée + jusqu'à 4 pages piliers,
 * chacune associée à son mot-clé mesuré le plus porteur (keyword_universe).
 * Aucun LLM, une seule requête.
 */
export async function resolveRatioTargets(
  supabase: any,
  opts: { url: string; trackedSiteId?: string | null; fallbackKeyword?: string | null },
): Promise<RatioTarget[]> {
  const targets: RatioTarget[] = [];
  const byUrl = new Map<string, { keyword: string; volume: number }>();
  try {
    if (opts.trackedSiteId) {
      const { data } = await supabase
        .from('keyword_universe')
        .select('keyword, target_url, search_volume')
        .eq('tracked_site_id', opts.trackedSiteId)
        .not('target_url', 'is', null)
        .order('search_volume', { ascending: false })
        .limit(500);
      for (const row of data ?? []) {
        const u = String(row.target_url || '');
        const kw = String(row.keyword || '').trim();
        if (!u || !kw) continue;
        const prev = byUrl.get(u);
        const vol = Number(row.search_volume) || 0;
        if (!prev || vol > prev.volume) byUrl.set(u, { keyword: kw, volume: vol });
      }
    }
  } catch { /* périmètre dégradé, on garde la page auditée */ }

  const auditedKeyword = byUrl.get(opts.url)?.keyword || opts.fallbackKeyword || '';
  if (auditedKeyword) targets.push({ url: opts.url, keyword: auditedKeyword });

  const pillars = await resolvePillarSet(supabase, opts.trackedSiteId);
  for (const [u, v] of byUrl) {
    if (targets.length >= MAX_TARGETS) break;
    if (u === opts.url) continue;
    if (!isPillarUrl(pillars, u)) continue;
    targets.push({ url: u, keyword: v.keyword });
  }
  return targets;
}


/**
 * Calcule les ratios de la page auditée et de ses piliers face aux concurrents
 * réellement classés sur le mot-clé. Résultat mis en cache un mois.
 */
export async function getCompetitiveRatios(opts: {
  supabase: any;
  domain: string;
  targets: RatioTarget[];
  trackedSiteId?: string | null;
  userId?: string | null;
  caller: string;
  forceRefresh?: boolean;
}): Promise<CompetitiveRatiosResult> {
  const { supabase, domain, trackedSiteId, userId, caller } = opts;
  const period = periodMonth();
  const empty: CompetitiveRatiosResult = { period_month: period, rows: [], source: 'fresh' };

  try {
    if (!opts.forceRefresh) {
      const { data: hit } = await supabase
        .from('competitive_ratio_snapshots')
        .select('rows')
        .eq('domain', domain)
        .eq('period_month', period)
        .maybeSingle();
      if (hit?.rows?.length) {
        return { period_month: period, rows: hit.rows as CompetitiveRatioRow[], source: 'cache' };
      }
    }

    const pillars = await resolvePillarSet(supabase, trackedSiteId);
    const own = hostOf(domain.includes('://') ? domain : `https://${domain}`);
    const targets = opts.targets.filter((t) => t.url && t.keyword).slice(0, MAX_TARGETS);
    if (!targets.length) return empty;

    const rows: CompetitiveRatioRow[] = [];

    for (const target of targets) {
      const ownHtml = await fetchHtml(target.url);
      if (!ownHtml) continue;
      const ownMetrics = measure(ownHtml);

      const serp = await getSerp(target.keyword, {
        caller,
        userId: userId ?? null,
        trackedSiteId: trackedSiteId ?? null,
        usageClass: 'position',
        skipFanout: true,
      });

      const competitorUrls = (serp?.organic ?? [])
        .map((o: any) => o.url as string)
        .filter((u) => u && hostOf(u) && hostOf(u) !== own)
        .slice(0, MAX_COMPETITORS);

      const measured: PageMetrics[] = [];
      const domains: string[] = [];
      for (const cu of competitorUrls) {
        const html = await fetchHtml(cu);
        if (!html) continue;
        measured.push(measure(html));
        domains.push(hostOf(cu));
      }
      if (!measured.length) continue;

      const comp = {
        words: median(measured.map((m) => m.words)),
        semantic: median(measured.map((m) => m.semantic)),
        seo: median(measured.map((m) => m.seo)),
        strong: median(measured.map((m) => m.strong)),
        h2: median(measured.map((m) => m.h2)),
        imagesWithoutAlt: median(measured.map((m) => m.imagesWithoutAlt)),
        sample: measured.length,
        domains,
      };

      const r = {
        words: ratio(ownMetrics.words, comp.words),
        semantic: ratio(ownMetrics.semantic, comp.semantic),
        seo: ratio(ownMetrics.seo, comp.seo),
      };
      const avg = (r.words + r.semantic + r.seo) / 3;
      const verdict: CompetitiveRatioRow['verdict'] = avg >= 1.1 ? 'ahead' : avg >= 0.9 ? 'parity' : 'behind';

      rows.push({
        url: target.url,
        keyword: target.keyword,
        is_pillar: isPillarUrl(pillars, target.url),
        own: ownMetrics,
        competitors: comp,
        ratios: r,
        verdict,
      });
    }

    if (rows.length) {
      await supabase.from('competitive_ratio_snapshots').upsert({
        domain,
        period_month: period,
        tracked_site_id: trackedSiteId ?? null,
        user_id: userId ?? null,
        rows,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'domain,period_month' });
    }

    return { period_month: period, rows, source: 'fresh' };
  } catch {
    return empty;
  }
}

/** Rendu HTML sobre (violet / or / noir / blanc, sans emoji). */
export function renderCompetitiveRatiosHtml(result: CompetitiveRatiosResult | null): string {
  if (!result || !result.rows.length) return '';
  const VIOLET = '#6d28d9';
  const GOLD = '#b45309';

  const line = (r: CompetitiveRatioRow) => {
    const color = r.verdict === 'ahead' ? VIOLET : r.verdict === 'parity' ? '#374151' : GOLD;
    const label = r.verdict === 'ahead' ? 'Au-dessus' : r.verdict === 'parity' ? 'À parité' : 'En retard';
    let path = r.url;
    try { path = new URL(r.url).pathname || '/'; } catch { /* garde l'URL brute */ }
    return `<tr>
      <td style="padding:8px 10px;font-size:12px;border-top:1px solid #e5e7eb;">
        ${r.is_pillar ? `<span style="font-size:10px;font-weight:700;color:${VIOLET};border:1px solid ${VIOLET};border-radius:4px;padding:1px 5px;margin-right:6px;">Pilier</span>` : ''}${path}
        <div style="font-size:11px;color:#6b7280;">${r.keyword}</div>
      </td>
      <td style="padding:8px 10px;font-size:12px;border-top:1px solid #e5e7eb;text-align:right;">${r.own.words} <span style="color:#6b7280;">/ ${r.competitors.words}</span></td>
      <td style="padding:8px 10px;font-size:12px;border-top:1px solid #e5e7eb;text-align:right;">${r.own.semantic} <span style="color:#6b7280;">/ ${r.competitors.semantic}</span></td>
      <td style="padding:8px 10px;font-size:12px;border-top:1px solid #e5e7eb;text-align:right;">${r.own.seo} <span style="color:#6b7280;">/ ${r.competitors.seo}</span></td>
      <td style="padding:8px 10px;font-size:12px;border-top:1px solid #e5e7eb;text-align:right;font-weight:600;color:${color};">${label}</td>
    </tr>`;
  };

  return `<div style="margin-top:20px;padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-left:4px solid ${VIOLET};border-radius:8px;">
    <h3 style="font-size:15px;font-weight:600;margin:0 0 6px;">Audit comparé — page auditée et pages piliers</h3>
    <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">
      Comparaison mensuelle face aux pages réellement classées sur le mot-clé de chaque page
      (médiane des ${MAX_COMPETITORS} premiers résultats hors domaine). Mesures déterministes, sans IA.
      Période : ${result.period_month}.
    </p>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#faf9ff;">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;">Page</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;">Mots (vous / médiane)</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;">Sémantique</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;">SEO</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;">Verdict</th>
      </tr></thead>
      <tbody>${result.rows.map(line).join('')}</tbody>
    </table>
  </div>`;
}
