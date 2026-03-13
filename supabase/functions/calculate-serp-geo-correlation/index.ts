import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * calculate-serp-geo-correlation  v2
 *
 * Measures how traditional SERP performance correlates with LLM visibility.
 *
 * v2 improvements over v1:
 *  - Lag analysis (0-3 week shifts, keeps best |r|)
 *  - Statistical significance via t-test (p < 0.05 required)
 *  - Spearman rank correlation alongside Pearson (captures non-linear)
 *  - Per-LLM breakdown stored for granular insight
 *  - Minimum 8 aligned weeks (was 4)
 *  - Cleaner type contracts
 */

// ─── Types ──────────────────────────────────────────────────────────

interface WeeklySerp {
  week: string;
  avg_position: number;
  etv: number;
  top_10: number;
}

interface WeeklyLlm {
  week: string;
  avg_score: number;
}

interface CorrelationResult {
  pearson: number | null;
  spearman: number | null;
  p_value: number | null;
  best_lag: number;
  significant: boolean;
}

interface MetricCorrelations {
  position: CorrelationResult;
  etv: CorrelationResult;
  top_10: CorrelationResult;
}

interface LlmBreakdown {
  llm_name: string;
  weeks: number;
  pearson_vs_position: number | null;
  spearman_vs_position: number | null;
  best_lag: number;
}

// ─── Statistics ─────────────────────────────────────────────────────

/** Pearson product-moment correlation coefficient */
function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;

  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;

  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const den = Math.sqrt(dx2 * dy2);
  if (den === 0) return null;
  return num / den;
}

/** Spearman rank correlation — robust to non-linear monotonic relationships */
function spearman(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  return pearson(toRanks(x), toRanks(y));
}

/** Convert values to ranks (average rank for ties) */
function toRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j + 1) / 2; // 1-based average
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

/**
 * Two-tailed p-value for Pearson r using the t-distribution approximation.
 * t = r * sqrt((n-2) / (1-r²)), df = n-2
 * Uses the regularized incomplete beta function for accuracy.
 */
function pValue(r: number | null, n: number): number | null {
  if (r === null || n < 4) return null;
  const r2 = r * r;
  if (r2 >= 1) return 0;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r2));
  const df = n - 2;
  // Use the beta regularized incomplete function approximation
  return betaIncomplete(df / 2, 0.5, df / (df + t * t));
}

/** Regularized incomplete beta function via continued fraction (Lentz) */
function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz's continued fraction
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;

    // Odd step
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;

    if (Math.abs(d * c - 1) < 1e-8) break;
  }

  return front * f;
}

/** Log-gamma via Stirling's approximation (Lanczos) */
function lgamma(z: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// ─── Lag analysis ───────────────────────────────────────────────────

const MAX_LAG = 3;
const MIN_WEEKS = 8;
// Bonferroni correction: 3 metrics × (MAX_LAG+1) lags = 12 tests
const NUM_TESTS = 3 * (MAX_LAG + 1);
const P_THRESHOLD = 0.05 / NUM_TESTS; // ≈ 0.00417

/**
 * For a given SERP metric series and LLM series (aligned by week order),
 * test lags 0..MAX_LAG. Returns the correlation with the best |r|.
 * Lag = number of weeks SERP leads LLM (positive lag = SEO effect delayed).
 */
function bestLagCorrelation(serp: number[], llm: number[]): CorrelationResult {
  let bestR: number | null = null;
  let bestSpearman: number | null = null;
  let bestP: number | null = null;
  let bestLag = 0;

  for (let lag = 0; lag <= MAX_LAG; lag++) {
    const n = serp.length - lag;
    if (n < MIN_WEEKS) continue;

    const sx = serp.slice(0, n);
    const sy = llm.slice(lag, lag + n);

    const r = pearson(sx, sy);
    const s = spearman(sx, sy);
    const p = pValue(r, n);

    if (r !== null && (bestR === null || Math.abs(r) > Math.abs(bestR))) {
      bestR = r;
      bestSpearman = s;
      bestP = p;
      bestLag = lag;
    }
  }

  const significant = bestP !== null && bestP < P_THRESHOLD;

  return {
    pearson: bestR !== null ? round3(bestR) : null,
    spearman: bestSpearman !== null ? round3(bestSpearman) : null,
    p_value: bestP !== null ? round4(bestP) : null,
    best_lag: bestLag,
    significant,
  };
}

// ─── Convergence classification ─────────────────────────────────────

interface Convergence {
  index: number;
  label: 'convergent' | 'divergent' | 'decorrelated' | 'insufficient_data' | 'not_significant';
}

function classifyConvergence(metrics: MetricCorrelations, weeks: number): Convergence {
  if (weeks < MIN_WEEKS) {
    return { index: 0, label: 'insufficient_data' };
  }

  // Only use statistically significant correlations
  const significantValues: { value: number; weight: number }[] = [];

  // Position: invert sign (lower position = better = positive effect)
  if (metrics.position.significant && metrics.position.pearson !== null) {
    significantValues.push({ value: -metrics.position.pearson, weight: 0.4 });
  }
  if (metrics.etv.significant && metrics.etv.pearson !== null) {
    significantValues.push({ value: metrics.etv.pearson, weight: 0.35 });
  }
  if (metrics.top_10.significant && metrics.top_10.pearson !== null) {
    significantValues.push({ value: metrics.top_10.pearson, weight: 0.25 });
  }

  if (significantValues.length === 0) {
    return { index: 50, label: 'not_significant' };
  }

  const totalWeight = significantValues.reduce((s, v) => s + v.weight, 0);
  const weighted = significantValues.reduce((s, v) => s + v.value * v.weight, 0) / totalWeight;

  // Map [-1, 1] → [0, 100]
  const index = Math.round((weighted + 1) * 50);

  let label: Convergence['label'];
  if (weighted > 0.4) label = 'convergent';
  else if (weighted < -0.4) label = 'divergent';
  else label = 'decorrelated';

  return { index, label };
}

// ─── Utilities ──────────────────────────────────────────────────────

function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

/** ISO week string from Date: "2026-W12" */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** ISO week from "YYYY-MM-DD" */
function isoWeekFromStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return isoWeek(new Date(y, m - 1, d));
}

// ─── Main ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const targetSiteId: string | undefined = body.tracked_site_id;

    // Fetch tracked sites
    let query = supabase.from('tracked_sites').select('id, user_id, domain');
    if (targetSiteId) query = query.eq('id', targetSiteId);
    const { data: sites, error: sitesError } = await query;

    if (sitesError || !sites?.length) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let skipped = 0;
    const results: Array<{ domain: string; label: string; index: number; weeks: number; significant_metrics: number }> = [];

    for (const site of sites) {
      try {
        // Fetch last 20 weeks (need extra for lag window)
        const [serpRes, llmRes] = await Promise.all([
          supabase
            .from('serp_snapshots')
            .select('measured_at, avg_position, etv, top_10')
            .eq('tracked_site_id', site.id)
            .order('measured_at', { ascending: true })
            .limit(20),
          supabase
            .from('llm_visibility_scores')
            .select('week_start_date, llm_name, score_percentage')
            .eq('tracked_site_id', site.id)
            .order('week_start_date', { ascending: true })
            .limit(200),
        ]);

        const serpRows = serpRes.data;
        const llmRows = llmRes.data;

        if (!serpRows?.length || !llmRows?.length) { skipped++; continue; }

        // ── Normalize SERP by ISO week ──
        const serpByWeek = new Map<string, WeeklySerp>();
        for (const row of serpRows) {
          const wk = isoWeek(new Date(row.measured_at));
          serpByWeek.set(wk, {
            week: wk,
            avg_position: Number(row.avg_position) || 0,
            etv: Number(row.etv) || 0,
            top_10: Number(row.top_10) || 0,
          });
        }

        // ── Normalize LLM by ISO week — keep per-LLM detail ──
        const llmByWeekByModel = new Map<string, Map<string, number[]>>();
        const llmByWeekAll = new Map<string, { total: number; count: number }>();

        for (const row of llmRows) {
          const wk = isoWeekFromStr(row.week_start_date);
          const score = Number(row.score_percentage) || 0;

          // Per-LLM
          if (!llmByWeekByModel.has(row.llm_name)) llmByWeekByModel.set(row.llm_name, new Map());
          const modelMap = llmByWeekByModel.get(row.llm_name)!;
          if (!modelMap.has(wk)) modelMap.set(wk, []);
          modelMap.get(wk)!.push(score);

          // Aggregated
          const agg = llmByWeekAll.get(wk) || { total: 0, count: 0 };
          agg.total += score;
          agg.count++;
          llmByWeekAll.set(wk, agg);
        }

        // ── Align by common weeks (sorted) ──
        const commonWeeks = [...serpByWeek.keys()].filter(w => llmByWeekAll.has(w)).sort();

        if (commonWeeks.length < MIN_WEEKS) { skipped++; continue; }

        // Build aligned arrays
        const positions: number[] = [];
        const etvs: number[] = [];
        const top10s: number[] = [];
        const llmAvgs: number[] = [];
        const serpPoints: WeeklySerp[] = [];
        const llmPoints: WeeklyLlm[] = [];

        for (const wk of commonWeeks) {
          const s = serpByWeek.get(wk)!;
          const l = llmByWeekAll.get(wk)!;
          const avg = round3(l.total / l.count);

          positions.push(s.avg_position);
          etvs.push(s.etv);
          top10s.push(s.top_10);
          llmAvgs.push(avg);

          serpPoints.push(s);
          llmPoints.push({ week: wk, avg_score: avg });
        }

        // ── Compute correlations with lag analysis ──
        const metrics: MetricCorrelations = {
          position: bestLagCorrelation(positions, llmAvgs),
          etv: bestLagCorrelation(etvs, llmAvgs),
          top_10: bestLagCorrelation(top10s, llmAvgs),
        };

        const { index, label } = classifyConvergence(metrics, commonWeeks.length);

        // ── Per-LLM breakdown ──
        const llmBreakdown: LlmBreakdown[] = [];
        for (const [llmName, weekMap] of llmByWeekByModel.entries()) {
          const llmWeeks = commonWeeks.filter(w => weekMap.has(w));
          if (llmWeeks.length < MIN_WEEKS) continue;

          const posArr = llmWeeks.map(w => serpByWeek.get(w)!.avg_position);
          const llmArr = llmWeeks.map(w => {
            const scores = weekMap.get(w)!;
            return scores.reduce((a, b) => a + b, 0) / scores.length;
          });

          const result = bestLagCorrelation(posArr, llmArr);
          llmBreakdown.push({
            llm_name: llmName,
            weeks: llmWeeks.length,
            pearson_vs_position: result.pearson,
            spearman_vs_position: result.spearman,
            best_lag: result.best_lag,
          });
        }

        // Count how many metrics are statistically significant
        const sigCount = [metrics.position, metrics.etv, metrics.top_10]
          .filter(m => m.significant).length;

        // ── Upsert ──
        const { error: upsertError } = await supabase
          .from('serp_geo_correlations')
          .upsert({
            tracked_site_id: site.id,
            user_id: site.user_id,
            domain: site.domain,
            pearson_position_vs_llm: metrics.position.pearson,
            pearson_etv_vs_llm: metrics.etv.pearson,
            pearson_top10_vs_llm: metrics.top_10.pearson,
            convergence_index: index,
            trend_label: label,
            weeks_analyzed: commonWeeks.length,
            serp_data_points: serpPoints,
            llm_data_points: llmPoints,
            calculated_at: new Date().toISOString(),
            // v2 fields
            spearman_position_vs_llm: metrics.position.spearman,
            spearman_etv_vs_llm: metrics.etv.spearman,
            spearman_top10_vs_llm: metrics.top_10.spearman,
            p_value_position: metrics.position.p_value,
            p_value_etv: metrics.etv.p_value,
            p_value_top10: metrics.top_10.p_value,
            best_lag_position: metrics.position.best_lag,
            best_lag_etv: metrics.etv.best_lag,
            best_lag_top10: metrics.top_10.best_lag,
            llm_breakdown: llmBreakdown,
          }, {
            onConflict: 'tracked_site_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[${site.domain}] Upsert error:`, upsertError.message);
        } else {
          processed++;
          results.push({ domain: site.domain, label, index, weeks: commonWeeks.length, significant_metrics: sigCount });
          console.log(
            `[${site.domain}] ✅ ${label} (idx:${index}, ${commonWeeks.length}w, sig:${sigCount}/3, ` +
            `lag_pos:${metrics.position.best_lag}w, r_pos=${metrics.position.pearson}, ρ_pos=${metrics.position.spearman}, p=${metrics.position.p_value})`
          );
        }
      } catch (e) {
        console.error(`[${site.domain}] Error:`, e);
        skipped++;
      }
    }

    console.log(`SERP↔GEO v2: ${processed} traités, ${skipped} ignorés / ${sites.length}`);

    return new Response(JSON.stringify({ success: true, processed, skipped, total: sites.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur calculate-serp-geo-correlation:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
