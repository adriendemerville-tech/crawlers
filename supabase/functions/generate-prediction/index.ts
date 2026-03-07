import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackTokenUsage } from "../_shared/tokenTracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── FUEL: Pre-processing Utilities ─────────────────────────────────────────

/** Technical Debt Index — non-linear gravity: errors^1.5 */
function computeTDI(errorCount: number): number {
  return errorCount > 0 ? Math.pow(errorCount, 1.5) : 0;
}

/** Extract bare domain root for brand matching (e.g. "my-site" from "www.my-site.com") */
function domainRoot(domain: string): string {
  return domain.replace(/^www\./, '').split('.')[0].toLowerCase();
}

function isBrand(keyword: string, root: string): boolean {
  const kw = keyword.toLowerCase();
  return kw.includes(root) || kw.includes(root.replace(/-/g, ' '));
}

type Intent = 'high_intent' | 'low_intent';

function classifyIntent(keyword: string): Intent {
  const kw = keyword.toLowerCase();
  const highSignals = [
    'acheter','buy','prix','price','tarif','devis','promo','discount',
    'commande','livraison','shop','boutique','comparatif','avis',
    'près de','near me','à proximité','horaire','itinéraire',
    'reservation','réservation','location','louer','souscrire',
  ];
  return highSignals.some(s => kw.includes(s)) ? 'high_intent' : 'low_intent';
}

/** Semantic depth — drives trust-rebound speed */
function classifyDepth(data: Record<string, any>): 'thin' | 'utility' | 'authority' {
  const cqs = Number(data.content_quality_score) || 0;
  const words = Number(data.word_count) || 0;
  if (cqs >= 75 || words >= 2000) return 'authority';
  if (cqs >= 40 || words >= 800) return 'utility';
  return 'thin';
}

const REBOUND_DAYS: Record<string, number> = { authority: 45, utility: 55, thin: 60 };

// ─── SERVE ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audit_id, client_id, gsc_data } = await req.json();

    if (!audit_id || !client_id) {
      return new Response(JSON.stringify({ error: 'audit_id and client_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) throw new Error('OPENROUTER_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Fetch audit ──
    const { data: audit, error: auditErr } = await supabase
      .from('pdf_audits').select('*').eq('id', audit_id).single();

    if (auditErr || !audit || audit.status !== 'processed') {
      throw new Error('Audit not found or not yet processed');
    }

    const ext: Record<string, any> = audit.extracted_data || {};

    // ── FUEL: Pre-compute intelligence ──
    const errorCount = Number(ext.errors) || 0;
    const tdiScore = computeTDI(errorCount);
    const root = domainRoot(ext.domain || audit.file_path || '');
    const depth = classifyDepth(ext);
    const reboundDays = REBOUND_DAYS[depth];

    // ── GSC segmentation ──
    let totalClicks = 0, totalImpressions = 0, posSum = 0, rowCount = 0;
    let brandClicks = 0, brandImpressions = 0;
    let highIntentClicks = 0, highIntentImpressions = 0;
    let lowIntentClicks = 0, lowIntentImpressions = 0;

    interface GscRow { keys?: string[]; clicks?: number; impressions?: number; position?: number }
    const rows: GscRow[] = gsc_data?.rows || [];

    if (rows.length > 0) {
      for (const r of rows) {
        const c = r.clicks || 0, im = r.impressions || 0, pos = r.position || 0;
        const kw = (r.keys?.[0] || '').toLowerCase();
        totalClicks += c; totalImpressions += im; posSum += pos; rowCount++;

        if (isBrand(kw, root)) {
          brandClicks += c; brandImpressions += im;
          continue;
        }
        if (classifyIntent(kw) === 'high_intent') {
          highIntentClicks += c; highIntentImpressions += im;
        } else {
          lowIntentClicks += c; lowIntentImpressions += im;
        }
      }
    } else if (gsc_data?.total_clicks) {
      totalClicks = gsc_data.total_clicks;
      totalImpressions = gsc_data.total_impressions || 0;
      posSum = gsc_data.avg_position || 0; rowCount = 1;
      brandClicks = Math.round(totalClicks * 0.30);
      const nb = totalClicks - brandClicks;
      highIntentClicks = Math.round(nb * 0.35);
      lowIntentClicks = nb - highIntentClicks;
      brandImpressions = Math.round(totalImpressions * 0.30);
      highIntentImpressions = Math.round((totalImpressions - brandImpressions) * 0.35);
      lowIntentImpressions = totalImpressions - brandImpressions - highIntentImpressions;
    }

    const avgPos = rowCount > 0 ? posSum / rowCount : 0;
    const nonBrandClicks = totalClicks - brandClicks;

    // ── THE ENGINE: Multi-Path Simulation Prompt ──
    const prompt = `You are a Senior Search Data Scientist running a causal traffic simulation for the 2026 Search ecosystem.

## PRE-COMPUTED INTELLIGENCE (use as-is, do NOT recalculate)
- Technical Debt Index (TDI): ${tdiScore.toFixed(1)} (from ${errorCount} errors, formula: errors^1.5)
  → A high TDI creates an "Indexing Ceiling": Google throttles crawl budget, limiting any content gains until technical debt is resolved.
- Semantic Depth: "${depth}" → Trust Rebound ETA: ${reboundDays} days
- Domain Authority: ${ext.domain_authority || 'N/A'}

## AUDIT DATA
- Technical SEO score: ${ext.technical_score || 'N/A'}/100
- Content quality score: ${ext.content_quality_score || 'N/A'}/100
- Page speed score: ${ext.page_speed_score || 'N/A'}
- Mobile score: ${ext.mobile_score || 'N/A'}
- Structured data present: ${ext.structured_data_present || false}
- Schema types: ${JSON.stringify(ext.schema_types || [])}

## GSC BASELINE (30 days)
- Total clicks: ${totalClicks} | Impressions: ${totalImpressions} | Avg position: ${avgPos.toFixed(1)}
- Brand clicks: ${brandClicks} (FROZEN — apply 0% growth to brand traffic)
- Non-Brand clicks: ${nonBrandClicks}
  ├─ High-Intent (transactional/local): ${highIntentClicks} clicks, ${highIntentImpressions} impressions
  └─ Low-Intent (informational): ${lowIntentClicks} clicks, ${lowIntentImpressions} impressions

## 2026 CTR REALITY — SGE (AI Overviews)
- Informational queries: Apply a −35% traffic penalty (AI Overviews cannibalize these).
- Transactional pages with proper Structured Data: Apply a +15% boost.
- Brand queries: 0% growth (constant).

## TRUST REBOUND PRINCIPLE
Fixing technical errors triggers a "Trust Rebound": a ${reboundDays}-day window where impressions increase first, then clicks follow 2-3 weeks later. Factor this lag into your 90-day projection.

## YOUR TASK — MULTI-PATH SIMULATION
Simulate 3 scenarios over 90 days assuming all audit recommendations are implemented:

1. **Pessimistic** — High AI cannibalization (SGE expands aggressively), 1 core update disruption, slow trust rebound.
2. **Realistic** — Standard SGE impact as described above, normal trust rebound at ${reboundDays} days.
3. **Aggressive** — Technical bottleneck fully removed within 30 days, minimal SGE expansion, fast rebound.

For each scenario, calculate the final monthly clicks = Brand clicks (unchanged) + predicted Non-Brand clicks.

Also compute:
- ai_risk_score: integer 0-100 representing overall AI disruption risk for this site's niche. 0 = negligible AI Overviews impact, 100 = most queries fully answered by AI. Base it on the informational/transactional ratio and sector vulnerability.
- business_impact_euro: Estimated monthly value in EUR of the realistic traffic gain. Use CPC estimation: high-intent clicks × €1.20 avg CPC + low-intent clicks × €0.25 avg CPC. Only count the NET GAIN over baseline.
- technical_unlock_potential: estimated additional clicks/month unlocked solely by fixing the ${errorCount} technical errors (removing the indexing ceiling)

## OUTPUT — Return ONLY this JSON (no markdown fences, no commentary)
{
  "scenarios": {
    "pessimistic": { "clicks": <integer>, "increase_pct": <number> },
    "realistic": { "clicks": <integer>, "increase_pct": <number> },
    "aggressive": { "clicks": <integer>, "increase_pct": <number> }
  },
  "ai_risk_score": <integer 0-100>,
  "business_impact": {
    "monthly_value_euro": <number>,
    "annual_value_euro": <number>,
    "cpc_basis": { "high_intent_cpc": <number>, "low_intent_cpc": <number> }
  },
  "market_insights": {
    "technical_unlock_potential": <integer>,
    "ai_cannibalization_risk": "low"|"medium"|"high"
  },
  "reasoning": "<2-3 sentence strategic explanation focusing on causality — explain WHICH specific bottleneck removal drives the traffic gain>"
}

GUARDRAILS:
- Every scenario's "clicks" MUST be ≥ ${totalClicks} (fixing errors cannot reduce traffic).
- Brand traffic (${brandClicks}) is constant — add it unchanged to every scenario.
- Only Non-Brand traffic is scalable.
- ai_risk_score MUST be an integer between 0 and 100.
- business_impact.annual_value_euro = monthly_value_euro × 12.`;

    // ── Call Gemini ──
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': supabaseUrl,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are a quantitative search traffic simulator. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error ${aiResponse.status}: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    await trackTokenUsage('generate-prediction', 'google/gemini-2.5-flash', aiData.usage);

    let prediction: any;
    try { prediction = JSON.parse(cleaned); }
    catch { throw new Error(`Failed to parse prediction JSON: ${cleaned.substring(0, 300)}`); }

    // ── Guardrails: floor at baseline ──
    const floor = (v: number) => Math.max(v, totalClicks);
    for (const key of ['pessimistic', 'realistic', 'aggressive']) {
      if (prediction.scenarios?.[key]) {
        prediction.scenarios[key].clicks = floor(prediction.scenarios[key].clicks || 0);
      }
    }

    // Inject metadata for auditability
    prediction._meta = {
      tdi_score: tdiScore,
      error_count: errorCount,
      semantic_depth: depth,
      trust_rebound_days: reboundDays,
      brand_clicks: brandClicks,
      non_brand_clicks: nonBrandClicks,
      high_intent_clicks: highIntentClicks,
      low_intent_clicks: lowIntentClicks,
    };

    // ── Persist — map to existing predictions schema ──
    const realisticClicks = prediction.scenarios?.realistic?.clicks ?? totalClicks;
    const realisticPct = prediction.scenarios?.realistic?.increase_pct ?? 0;

    const { data: saved, error: saveErr } = await supabase
      .from('predictions')
      .insert({
        audit_id,
        client_id,
        predicted_increase_pct: realisticPct,
        predicted_traffic: floor(realisticClicks),
        baseline_traffic: totalClicks,
        baseline_data: gsc_data || {},
        prediction_details: prediction,
      })
      .select()
      .single();

    if (saveErr) throw new Error(`Failed to save prediction: ${saveErr.message}`);

    await supabase.rpc('recalculate_reliability');

    return new Response(JSON.stringify({ success: true, prediction: saved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
