import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackTokenUsage } from "../_shared/tokenTracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── 1. FUEL: Intelligence Refinement ───────────────────────────────────────

/**
 * Technical Debt Index (TDI)
 * Non-linear gravity: 10 errors ≈ x1, 50 ≈ x10 (log decay of trust).
 * Returns a multiplier ≥ 1 representing how much technical debt drags ranking.
 */
function computeTDI(errorCount: number): number {
  if (errorCount <= 0) return 1;
  // log₁₀ curve: TDI = 1 + 9 * (log10(errors) / log10(50))²
  const normalised = Math.log10(Math.max(errorCount, 1)) / Math.log10(50);
  return 1 + 9 * Math.pow(Math.min(normalised, 1), 2);
}

/**
 * Detect Local Entity Signals from extracted audit data.
 * Returns true when NAP / GBP / Maps mentions are found.
 */
function hasLocalEntitySignals(data: Record<string, any>): boolean {
  const blob = JSON.stringify(data).toLowerCase();
  const localPatterns = ['nap', 'google business', 'gbp', 'google maps', 'local pack', 'local seo', 'geo_keywords'];
  return localPatterns.some(p => blob.includes(p));
}

/**
 * Classify content quality into Thin / Utility / Authority.
 * Uses content_quality_score + word count heuristics.
 */
function classifySemanticDepth(data: Record<string, any>): 'thin' | 'utility' | 'authority' {
  const cqs = Number(data.content_quality_score) || 0;
  const words = Number(data.word_count) || 0;
  if (cqs >= 75 || words >= 2000) return 'authority';
  if (cqs >= 40 || words >= 800) return 'utility';
  return 'thin';
}

// Trust-rebound speed coefficients (days to see 80% of gains)
const TRUST_REBOUND_DAYS: Record<string, number> = {
  authority: 30,
  utility: 55,
  thin: 80,
};

// ─── 2. Brand Filter & Intent Segmentation ──────────────────────────────────

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  position?: number;
  ctr?: number;
}

function extractDomainRoot(domain: string): string {
  return domain.replace(/^www\./, '').split('.')[0].toLowerCase();
}

function isBrandKeyword(keyword: string, domainRoot: string): boolean {
  const kw = keyword.toLowerCase();
  return kw.includes(domainRoot) || kw.includes(domainRoot.replace(/-/g, ' '));
}

type IntentBucket = 'transactional' | 'informational' | 'local';

function classifyIntent(keyword: string, hasLocalSignals: boolean): IntentBucket {
  const kw = keyword.toLowerCase();
  const txSignals = ['acheter', 'buy', 'prix', 'price', 'tarif', 'devis', 'promo', 'discount', 'order', 'commande', 'livraison', 'shop', 'boutique', 'comparatif', 'avis'];
  const localSignals = ['près de', 'near me', 'à proximité', 'ville', 'quartier', 'adresse', 'horaire', 'itinéraire'];
  if (localSignals.some(s => kw.includes(s))) return 'local';
  if (txSignals.some(s => kw.includes(s))) return 'transactional';
  if (hasLocalSignals && kw.length < 25) return 'local'; // short-tail + local entity → local
  return 'informational';
}

// 2026 SGE-adjusted growth coefficients per intent bucket
const INTENT_GROWTH_COEFF: Record<IntentBucket, number> = {
  transactional: 1.10,   // +10% boost (commercial resilience)
  informational: 0.60,   // −40% penalty (AI Overview cannibalization)
  local: 1.25,           // +25% (local pack gains)
};

// ─── 3. Serve ───────────────────────────────────────────────────────────────

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Fetch audit ──
    const { data: audit, error: auditErr } = await supabase
      .from('pdf_audits')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (auditErr || !audit || audit.status !== 'processed') {
      throw new Error('Audit not found or not yet processed');
    }

    const extractedData: Record<string, any> = audit.extracted_data || {};

    // ── FUEL: Pre-computation ──
    const errorCount = Number(extractedData.errors) || 0;
    const tdi = computeTDI(errorCount);
    const localSignals = hasLocalEntitySignals(extractedData);
    const semanticDepth = classifySemanticDepth(extractedData);
    const trustReboundDays = TRUST_REBOUND_DAYS[semanticDepth];

    // ── GSC baseline + Brand filter + Intent segmentation ──
    const domainRoot = extractDomainRoot(extractedData.domain || audit.file_path || '');
    let totalClicks = 0;
    let totalImpressions = 0;
    let positionSum = 0;
    let rowCount = 0;
    let brandClicks = 0;

    const intentBuckets: Record<IntentBucket, { clicks: number; impressions: number; keywords: string[] }> = {
      transactional: { clicks: 0, impressions: 0, keywords: [] },
      informational: { clicks: 0, impressions: 0, keywords: [] },
      local: { clicks: 0, impressions: 0, keywords: [] },
    };

    const rows: GscRow[] = gsc_data?.rows || [];
    if (rows.length > 0) {
      for (const row of rows) {
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const position = row.position || 0;
        const keyword = (row.keys?.[0] || '').toLowerCase();

        totalClicks += clicks;
        totalImpressions += impressions;
        positionSum += position;
        rowCount++;

        if (isBrandKeyword(keyword, domainRoot)) {
          brandClicks += clicks;
          continue; // Exclude brand from growth calculation
        }

        const intent = classifyIntent(keyword, localSignals);
        intentBuckets[intent].clicks += clicks;
        intentBuckets[intent].impressions += impressions;
        intentBuckets[intent].keywords.push(keyword);
      }
    } else if (gsc_data?.total_clicks) {
      totalClicks = gsc_data.total_clicks;
      totalImpressions = gsc_data.total_impressions || 0;
      positionSum = (gsc_data.avg_position || 0) * 1;
      rowCount = 1;
      // Without keyword-level data, split heuristically
      const nonBrand = totalClicks * 0.7; // assume 30% brand
      brandClicks = totalClicks * 0.3;
      intentBuckets.informational.clicks = nonBrand * 0.5;
      intentBuckets.transactional.clicks = nonBrand * 0.35;
      intentBuckets.local.clicks = nonBrand * 0.15;
    }

    const avgPosition = rowCount > 0 ? positionSum / rowCount : 0;
    const nonBrandClicks = totalClicks - brandClicks;
    const localMultiplier = localSignals ? 1.25 : 1.0;

    // ── Intent distribution summary for prompt ──
    const intentSummary = Object.entries(intentBuckets)
      .map(([intent, b]) => `${intent}: ${b.clicks} clicks, ${b.impressions} impressions, ${b.keywords.length} keywords`)
      .join('\n');

    // ── 2. THE ENGINE: Multi-Path Simulation Prompt ──
    const prompt = `You are a Quantitative Search Analyst simulating the 2026 Search ecosystem.

## PRE-COMPUTED INTELLIGENCE (do NOT recalculate — use as inputs)
- Technical Debt Index (TDI): ${tdi.toFixed(2)} (from ${errorCount} errors, logarithmic trust decay)
- Semantic Depth Classification: "${semanticDepth}" → Trust Rebound ETA: ${trustReboundDays} days
- Local Entity Signals Detected: ${localSignals} (${localSignals ? '+25% local-intent multiplier active' : 'no local multiplier'})
- Domain Authority estimate: ${extractedData.domain_authority || 'N/A'}

## AUDIT DATA (from PDF extraction)
- Technical SEO score: ${extractedData.technical_score || 'N/A'}/100
- Content quality score: ${extractedData.content_quality_score || 'N/A'}/100
- Page speed score: ${extractedData.page_speed_score || 'N/A'}
- Mobile score: ${extractedData.mobile_score || 'N/A'}
- Structured data present: ${extractedData.structured_data_present || false}
- Schema types: ${JSON.stringify(extractedData.schema_types || [])}
- GEO keywords: ${JSON.stringify(extractedData.geo_keywords || [])}
- Location target: ${extractedData.location_target || 'N/A'}

## GSC BASELINE (last 30 days)
- Total clicks: ${totalClicks} (Brand: ${brandClicks}, Non-Brand: ${nonBrandClicks})
- Total impressions: ${totalImpressions}
- Average position: ${avgPosition.toFixed(1)}
- Keyword count analysed: ${rowCount}

## INTENT SEGMENTATION (non-brand only)
${intentSummary}

## 2026 SGE CTR DYNAMICS (use these coefficients)
- Transactional keywords: +10% CTR resilience (commercial intent survives AI Overviews)
- Informational "How-to" keywords: −40% CTR penalty (AI Overview cannibalization)
- Local keywords: +25% CTR boost (local pack + Maps integration)

## POSITION-BASED CTR CURVE (2026 post-SGE)
Position 1: 27% | Position 2: 20% | Position 3: 14% | Position 4: 9% | Position 5: 6%
Position 6-10: 2-4% | Position 11+: <1%

## YOUR 4-STEP REASONING (execute each step explicitly)

### Step 1: Bottleneck Removal
Identify the SINGLE technical fix from the audit that unlocks the most crawl budget. Name it and quantify the expected position gain (in decimal positions).

### Step 2: Trust Rebound Simulation
Using the semantic depth "${semanticDepth}" and TDI ${tdi.toFixed(2)}, estimate the 90-day trajectory:
- Day 0-${trustReboundDays}: Partial re-indexation, ${semanticDepth === 'authority' ? 'fast' : semanticDepth === 'utility' ? 'moderate' : 'slow'} trust recovery
- Day ${trustReboundDays}-90: Full velocity phase

### Step 3: 2026 CTR Dynamics
Apply SGE cannibalization penalties per intent bucket. Calculate expected clicks per bucket after position gains.

### Step 4: Probabilistic Scenarios
Generate 3 paths factoring "Google Update Volatility":
- Conservative (P25): Assume 1 minor core update disruption, slow recovery
- Realistic (P50): Normal trajectory, partial SGE expansion
- Optimistic (P75): No disruptions, all fixes indexed within 45 days

## OUTPUT FORMAT (return ONLY this JSON, no markdown fences)
{
  "scenarios": {
    "conservative": {
      "predicted_increase_pct": <number>,
      "predicted_traffic": <integer>,
      "reasoning": "<1-2 sentences>"
    },
    "realistic": {
      "predicted_increase_pct": <number>,
      "predicted_traffic": <integer>,
      "reasoning": "<1-2 sentences>"
    },
    "optimistic": {
      "predicted_increase_pct": <number>,
      "predicted_traffic": <integer>,
      "reasoning": "<1-2 sentences>"
    }
  },
  "primary_prediction": {
    "predicted_increase_pct": <realistic scenario value>,
    "predicted_traffic": <realistic scenario value>,
    "confidence_level": "low"|"medium"|"high"
  },
  "bottleneck_fix": "<name of the single most impactful fix>",
  "trust_rebound_days": <integer, estimated days to 80% recovery>,
  "cannibalization_risk": <0-100, % of predicted traffic likely captured by Google AI answers>,
  "velocity_score": <0.0-1.0, climb speed based on TDI vs DA>,
  "market_opportunity_euro": <estimated monthly value: predicted_traffic * avg_cpc_for_sector>,
  "intent_breakdown": {
    "transactional": { "current_clicks": <n>, "predicted_clicks": <n>, "growth_pct": <n> },
    "informational": { "current_clicks": <n>, "predicted_clicks": <n>, "growth_pct": <n> },
    "local": { "current_clicks": <n>, "predicted_clicks": <n>, "growth_pct": <n> }
  },
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "reasoning": "<2-3 sentence overall explanation>"
}

CRITICAL GUARDRAILS:
- predicted_traffic in ALL scenarios MUST be ≥ ${totalClicks} (baseline). Fixing errors cannot reduce traffic.
- Brand traffic (${brandClicks} clicks) is CONSTANT — do not include it in growth calculations. Add it back to final numbers.
- Use the pre-computed TDI, intent coefficients, and local multiplier as given.`;

    // ── Call Gemini ──
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a quantitative search traffic simulator. Return only valid JSON. No markdown fences. No commentary outside JSON.' },
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
    const rawContent = aiData.choices?.[0]?.message?.content || '';
    const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Track token usage
    await trackTokenUsage('generate-prediction', 'google/gemini-2.5-flash', aiData.usage);

    let prediction: any;
    try {
      prediction = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse prediction JSON: ${cleaned.substring(0, 300)}`);
    }

    // ── Mathematical Guardrails ──
    const ensureFloor = (val: number) => Math.max(val, totalClicks);
    if (prediction.scenarios) {
      for (const key of ['conservative', 'realistic', 'optimistic']) {
        if (prediction.scenarios[key]) {
          prediction.scenarios[key].predicted_traffic = ensureFloor(prediction.scenarios[key].predicted_traffic || 0);
        }
      }
    }
    if (prediction.primary_prediction) {
      prediction.primary_prediction.predicted_traffic = ensureFloor(prediction.primary_prediction.predicted_traffic || 0);
    }

    // Inject pre-computed metadata
    prediction._meta = {
      tdi,
      error_count: errorCount,
      semantic_depth: semanticDepth,
      trust_rebound_days_computed: trustReboundDays,
      local_signals: localSignals,
      local_multiplier: localMultiplier,
      brand_clicks: brandClicks,
      non_brand_clicks: nonBrandClicks,
      intent_coefficients: INTENT_GROWTH_COEFF,
    };

    // ── Extract primary values for DB ──
    const primaryIncrease = prediction.primary_prediction?.predicted_increase_pct
      ?? prediction.scenarios?.realistic?.predicted_increase_pct
      ?? 0;
    const primaryTraffic = prediction.primary_prediction?.predicted_traffic
      ?? prediction.scenarios?.realistic?.predicted_traffic
      ?? totalClicks;

    // ── Save prediction ──
    const { data: savedPrediction, error: saveErr } = await supabase
      .from('predictions')
      .insert({
        audit_id,
        client_id,
        predicted_increase_pct: primaryIncrease,
        predicted_traffic: ensureFloor(primaryTraffic),
        baseline_traffic: totalClicks,
        baseline_data: gsc_data || {},
        prediction_details: prediction,
      })
      .select()
      .single();

    if (saveErr) throw new Error(`Failed to save prediction: ${saveErr.message}`);

    // ── Recalculate system reliability ──
    await supabase.rpc('recalculate_reliability');

    return new Response(JSON.stringify({ success: true, prediction: savedPrediction }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
