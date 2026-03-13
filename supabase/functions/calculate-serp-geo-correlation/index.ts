import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * calculate-serp-geo-correlation
 * 
 * Calculates Pearson correlation between SERP metrics (serp_snapshots)
 * and GEO/LLM visibility (llm_visibility_scores) for each tracked site.
 * 
 * Aligned by week_start_date / measured_at week.
 * Stores results in serp_geo_correlations table.
 * 
 * Trigger: cron (weekly) or manual via admin
 */

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

function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 4) return null; // Need minimum 4 data points for meaningful correlation

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function classifyConvergence(
  pPosition: number | null,
  pEtv: number | null,
  pTop10: number | null,
  weeks: number
): { index: number; label: string } {
  if (weeks < 4) {
    return { index: 0, label: 'insufficient_data' };
  }

  // Position correlation is inverted (lower position = better ranking)
  // So a negative correlation means: when position improves (goes down), LLM visibility goes up = convergent
  const effectivePosition = pPosition !== null ? -pPosition : null;

  const values = [effectivePosition, pEtv, pTop10].filter((v): v is number => v !== null);
  if (values.length === 0) {
    return { index: 0, label: 'insufficient_data' };
  }

  // Weighted composite: position 40%, ETV 35%, top10 25%
  const weights = [0.4, 0.35, 0.25];
  const allValues = [effectivePosition, pEtv, pTop10];
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < allValues.length; i++) {
    if (allValues[i] !== null) {
      weightedSum += allValues[i]! * weights[i];
      totalWeight += weights[i];
    }
  }

  const avgCorrelation = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Convert correlation (-1 to 1) to index (0 to 100)
  // 1.0 → 100 (perfectly convergent)
  // 0.0 → 50 (decorrelated)
  // -1.0 → 0 (perfectly divergent)
  const index = Math.round((avgCorrelation + 1) * 50);

  let label: string;
  if (avgCorrelation > 0.4) label = 'convergent';
  else if (avgCorrelation < -0.4) label = 'divergent';
  else label = 'decorrelated';

  return { index, label };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const targetSiteId: string | undefined = body.tracked_site_id;

    // Get all tracked sites (or a specific one)
    let query = supabase.from('tracked_sites').select('id, user_id, domain');
    if (targetSiteId) {
      query = query.eq('id', targetSiteId);
    }
    const { data: sites, error: sitesError } = await query;

    if (sitesError || !sites?.length) {
      console.log('No tracked sites found:', sitesError?.message);
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let skipped = 0;
    const results: Array<{ domain: string; label: string; index: number; weeks: number }> = [];

    for (const site of sites) {
      try {
        // Fetch last 16 weeks of SERP data
        const { data: serpRows } = await supabase
          .from('serp_snapshots')
          .select('measured_at, avg_position, etv, top_10')
          .eq('tracked_site_id', site.id)
          .order('measured_at', { ascending: true })
          .limit(16);

        // Fetch last 16 weeks of LLM visibility data
        const { data: llmRows } = await supabase
          .from('llm_visibility_scores')
          .select('week_start_date, llm_name, score_percentage')
          .eq('tracked_site_id', site.id)
          .order('week_start_date', { ascending: true })
          .limit(100); // Multiple LLMs per week

        if (!serpRows?.length || !llmRows?.length) {
          skipped++;
          continue;
        }

        // Normalize SERP data by week (YYYY-Www)
        const serpByWeek = new Map<string, WeeklySerp>();
        for (const row of serpRows) {
          const date = new Date(row.measured_at);
          const weekKey = getISOWeek(date);
          serpByWeek.set(weekKey, {
            week: weekKey,
            avg_position: Number(row.avg_position) || 0,
            etv: Number(row.etv) || 0,
            top_10: Number(row.top_10) || 0,
          });
        }

        // Normalize LLM data by week — average all LLMs per week
        const llmByWeek = new Map<string, { total: number; count: number }>();
        for (const row of llmRows) {
          const weekKey = row.week_start_date; // Already in YYYY-MM-DD format
          const normalizedWeek = getISOWeekFromDateStr(weekKey);
          const existing = llmByWeek.get(normalizedWeek) || { total: 0, count: 0 };
          existing.total += Number(row.score_percentage) || 0;
          existing.count++;
          llmByWeek.set(normalizedWeek, existing);
        }

        // Align by common weeks
        const commonWeeks = [...serpByWeek.keys()].filter(w => llmByWeek.has(w)).sort();

        if (commonWeeks.length < 3) {
          skipped++;
          continue;
        }

        const serpDataPoints: WeeklySerp[] = [];
        const llmDataPoints: WeeklyLlm[] = [];
        const positionValues: number[] = [];
        const etvValues: number[] = [];
        const top10Values: number[] = [];
        const llmValues: number[] = [];

        for (const week of commonWeeks) {
          const serp = serpByWeek.get(week)!;
          const llm = llmByWeek.get(week)!;
          const avgLlm = llm.total / llm.count;

          serpDataPoints.push(serp);
          llmDataPoints.push({ week, avg_score: Math.round(avgLlm * 10) / 10 });

          positionValues.push(serp.avg_position);
          etvValues.push(serp.etv);
          top10Values.push(serp.top_10);
          llmValues.push(avgLlm);
        }

        // Calculate Pearson correlations
        const pPosition = pearson(positionValues, llmValues);
        const pEtv = pearson(etvValues, llmValues);
        const pTop10 = pearson(top10Values, llmValues);

        const { index, label } = classifyConvergence(pPosition, pEtv, pTop10, commonWeeks.length);

        // Upsert result — one row per site, overwrite on recalculation
        const { error: upsertError } = await supabase
          .from('serp_geo_correlations')
          .upsert({
            tracked_site_id: site.id,
            user_id: site.user_id,
            domain: site.domain,
            pearson_position_vs_llm: pPosition,
            pearson_etv_vs_llm: pEtv,
            pearson_top10_vs_llm: pTop10,
            convergence_index: index,
            trend_label: label,
            weeks_analyzed: commonWeeks.length,
            serp_data_points: serpDataPoints,
            llm_data_points: llmDataPoints,
            calculated_at: new Date().toISOString(),
          }, {
            onConflict: 'tracked_site_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[${site.domain}] Upsert error:`, upsertError.message);
        } else {
          processed++;
          results.push({ domain: site.domain, label, index, weeks: commonWeeks.length });
          console.log(`[${site.domain}] ✅ ${label} (index: ${index}, ${commonWeeks.length} semaines, r_pos=${pPosition}, r_etv=${pEtv}, r_top10=${pTop10})`);
        }
      } catch (siteError) {
        console.error(`[${site.domain}] Error:`, siteError);
        skipped++;
      }
    }

    console.log(`Corrélation SERP↔GEO terminée: ${processed} traités, ${skipped} ignorés sur ${sites.length} sites`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      skipped,
      total: sites.length,
      results,
    }), {
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

/** Get ISO week string from Date: "2026-W12" */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Get ISO week string from "YYYY-MM-DD" string */
function getISOWeekFromDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return getISOWeek(new Date(y, m - 1, d));
}
