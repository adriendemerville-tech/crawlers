import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * predict-from-crawl — Génère une prédiction de trafic à partir des données
 * du crawl multi-pages (site_crawls + crawl_pages), sans dépendre de pdf_audits.
 *
 * Réutilise la logique déterministe de generate-prediction (CTR curve, TDI,
 * saisonnalité) mais construit les métriques à partir de l'agrégat du crawl.
 */

const CTR_CURVE: Record<number, number> = {
  1: 0.31, 2: 0.24, 3: 0.18, 4: 0.13, 5: 0.09,
  6: 0.06, 7: 0.04, 8: 0.03, 9: 0.02, 10: 0.01,
};

const SEASONALITY_MATRIX: Record<string, number[]> = {
  Retail:     [0.85, 0.80, 0.90, 0.95, 1.00, 1.05, 1.00, 0.90, 1.10, 1.15, 1.30, 1.50],
  RealEstate: [0.90, 0.95, 1.30, 1.25, 1.20, 1.15, 1.05, 0.85, 1.10, 1.05, 0.95, 0.80],
  Medical:    [1.15, 1.10, 1.05, 1.00, 0.95, 0.90, 0.85, 0.85, 1.10, 1.15, 1.10, 1.00],
  Services:   [1.00, 1.00, 1.05, 1.05, 1.00, 0.95, 0.90, 0.85, 1.10, 1.10, 1.05, 1.00],
  Travel:     [1.10, 1.05, 1.00, 1.10, 1.25, 1.35, 1.40, 1.30, 1.05, 0.90, 0.80, 0.95],
  Finance:    [1.20, 1.10, 1.15, 1.05, 1.00, 0.95, 0.90, 0.90, 1.05, 1.10, 1.10, 1.05],
  Education:  [1.15, 1.10, 1.00, 0.95, 0.90, 0.85, 0.80, 1.20, 1.30, 1.15, 1.05, 0.90],
};

function seasonalFactor90d(sector: string): number {
  const m = new Date().getMonth();
  const c = SEASONALITY_MATRIX[sector] || SEASONALITY_MATRIX['Services'];
  return Math.round(((c[m] + c[(m + 1) % 12] + c[(m + 2) % 12]) / 3) * 1000) / 1000;
}

function pct(final: number, base: number) {
  return base <= 0 ? 0 : Math.round(((final - base) / base) * 10000) / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { crawl_id, userId, sector } = await req.json();
    if (!crawl_id || !userId) {
      return new Response(JSON.stringify({ error: 'crawl_id and userId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) throw new Error('OPENROUTER_API_KEY not configured');

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch crawl + pages
    const { data: crawl } = await supabase.from('site_crawls').select('*').eq('id', crawl_id).single();
    if (!crawl || crawl.status !== 'completed') throw new Error('Crawl not found or not completed');

    const { data: pages } = await supabase.from('crawl_pages').select('*').eq('crawl_id', crawl_id);
    if (!pages || pages.length === 0) throw new Error('No pages found');

    // ── Build metrics from crawl aggregate ──
    const totalPages = pages.length;
    const avgScore = crawl.avg_score || 0;
    const errorCount = pages.reduce((s: number, p: any) => s + (p.issues?.length || 0), 0);
    const tdi = errorCount > 0 ? Math.pow(errorCount, 0.8) : 0; // Adjusted exponent for multi-page (many small errors)

    const pagesWithSchema = pages.filter((p: any) => p.has_schema_org).length;
    const pagesWithCanonical = pages.filter((p: any) => p.has_canonical).length;
    const pagesWithOg = pages.filter((p: any) => p.has_og).length;
    const thinPages = pages.filter((p: any) => (p.word_count || 0) < 100).length;
    const totalImagesNoAlt = pages.reduce((s: number, p: any) => s + (p.images_without_alt || 0), 0);

    const resolvedSector = sector || 'Services';
    const sf = seasonalFactor90d(resolvedSector);

    // Estimate baseline traffic from page count & avg score (heuristic)
    const baselineTraffic = Math.round(totalPages * (avgScore / 200) * 15); // ~15 clicks/well-optimized page/month
    const technicalDebtRatio = errorCount / (totalPages * 3); // normalize by max ~3 issues/page

    // Potential gain: how much lifting TDI would yield
    const gainMultiplier = technicalDebtRatio > 0.5 ? 0.35 : technicalDebtRatio > 0.2 ? 0.20 : 0.10;
    const theoreticalGain = Math.round(baselineTraffic * gainMultiplier * sf);

    // ── AI synthesis prompt ──
    const prompt = `You are a Senior Search Traffic Analyst. Based on this multi-page crawl data, predict the traffic impact of fixing all detected issues.

SITE: ${crawl.domain} (${totalPages} pages crawled)
AVG SEO SCORE: ${avgScore}/200
TOTAL ISSUES: ${errorCount}
TDI (Technical Debt Index): ${tdi.toFixed(1)}

PAGE HEALTH:
- Schema.org: ${pagesWithSchema}/${totalPages} (${Math.round(pagesWithSchema / totalPages * 100)}%)
- Canonical: ${pagesWithCanonical}/${totalPages}
- Open Graph: ${pagesWithOg}/${totalPages}
- Thin content (<100 words): ${thinPages} pages
- Images without alt: ${totalImagesNoAlt}

BASELINE ESTIMATED TRAFFIC: ${baselineTraffic} clicks/month
SECTOR: ${resolvedSector}
SEASONAL FACTOR (next 90 days): ${sf}
THEORETICAL GAIN: ${theoreticalGain} clicks

TOP ISSUES:
${(crawl.ai_recommendations || []).slice(0, 5).map((r: any) => `- ${r.title} (${r.priority}, ${r.affected_pages || '?'} pages)`).join('\n')}

Return ONLY this JSON:
{
  "scenarios": {
    "pessimistic": { "clicks": <int>, "increase_pct": <number> },
    "realistic": { "clicks": <int>, "increase_pct": <number> },
    "aggressive": { "clicks": <int>, "increase_pct": <number> }
  },
  "ai_risk_score": <int 0-100>,
  "business_impact": {
    "monthly_value_euro": <number>,
    "annual_value_euro": <number>
  },
  "reasoning": "<2-3 sentences>"
}

CONSTRAINTS:
- Realistic clicks MUST be between ${Math.round((baselineTraffic + theoreticalGain) * 0.85)} and ${Math.round((baselineTraffic + theoreticalGain) * 1.15)}
- Pessimistic = realistic × 0.7
- Aggressive = realistic × 1.4
- Business impact uses avg CPC of €0.65 on net gain only`;

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a quantitative search traffic simulator. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error ${aiRes.status}`);
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let prediction = JSON.parse(cleaned);

    // Validate corridors
    const realisticFloor = Math.round((baselineTraffic + theoreticalGain) * 0.85);
    const realisticCeiling = Math.round((baselineTraffic + theoreticalGain) * 1.15);
    let realisticClicks = Math.max(baselineTraffic, Math.min(realisticCeiling, Math.max(realisticFloor, prediction.scenarios?.realistic?.clicks || baselineTraffic)));
    const pessClicks = Math.max(baselineTraffic, Math.round(realisticClicks * 0.7));
    const aggrClicks = Math.round(realisticClicks * 1.4);

    prediction.scenarios = {
      pessimistic: { clicks: pessClicks, increase_pct: pct(pessClicks, baselineTraffic) },
      realistic: { clicks: realisticClicks, increase_pct: pct(realisticClicks, baselineTraffic) },
      aggressive: { clicks: aggrClicks, increase_pct: pct(aggrClicks, baselineTraffic) },
    };

    // Update crawl with prediction
    await supabase.from('site_crawls').update({
      ai_recommendations: [
        ...(crawl.ai_recommendations || []),
        {
          priority: 'info',
          title: 'Prédiction de trafic',
          description: prediction.reasoning || '',
          prediction: prediction.scenarios,
          business_impact: prediction.business_impact,
          ai_risk_score: prediction.ai_risk_score,
        }
      ],
    }).eq('id', crawl_id);

    return new Response(JSON.stringify({
      success: true,
      prediction: {
        baseline_traffic: baselineTraffic,
        scenarios: prediction.scenarios,
        ai_risk_score: prediction.ai_risk_score,
        business_impact: prediction.business_impact,
        reasoning: prediction.reasoning,
        _meta: { tdi, error_count: errorCount, sector: resolvedSector, seasonal_factor: sf, total_pages: totalPages, avg_score: avgScore },
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('predict-from-crawl error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
