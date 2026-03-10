import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackTokenUsage, trackPaidApiCall } from "../_shared/tokenTracker.ts";
import { corsHeaders } from '../_shared/cors.ts';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const CTR_CURVE: Record<number, number> = {
  1: 0.31, 2: 0.24, 3: 0.18, 4: 0.13, 5: 0.09,
  6: 0.06, 7: 0.04, 8: 0.03, 9: 0.02, 10: 0.01,
};

/** Seasonal coefficients by sector × month (0=Jan … 11=Dec). */
const SEASONALITY_MATRIX: Record<string, number[]> = {
  //                   Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
  Retail:       [0.85, 0.80, 0.90, 0.95, 1.00, 1.05, 1.00, 0.90, 1.10, 1.15, 1.30, 1.50],
  RealEstate:   [0.90, 0.95, 1.30, 1.25, 1.20, 1.15, 1.05, 0.85, 1.10, 1.05, 0.95, 0.80],
  Medical:      [1.15, 1.10, 1.05, 1.00, 0.95, 0.90, 0.85, 0.85, 1.10, 1.15, 1.10, 1.00],
  Services:     [1.00, 1.00, 1.05, 1.05, 1.00, 0.95, 0.90, 0.85, 1.10, 1.10, 1.05, 1.00],
  Travel:       [1.10, 1.05, 1.00, 1.10, 1.25, 1.35, 1.40, 1.30, 1.05, 0.90, 0.80, 0.95],
  Finance:      [1.20, 1.10, 1.15, 1.05, 1.00, 0.95, 0.90, 0.90, 1.05, 1.10, 1.10, 1.05],
  Education:    [1.15, 1.10, 1.00, 0.95, 0.90, 0.85, 0.80, 1.20, 1.30, 1.15, 1.05, 0.90],
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── FUEL: Pre-processing Utilities ─────────────────────────────────────────

function computeTDI(errorCount: number): number {
  return errorCount > 0 ? Math.pow(errorCount, 1.5) : 0;
}

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

function classifyDepth(data: Record<string, any>): 'thin' | 'utility' | 'authority' {
  const cqs = Number(data.content_quality_score) || 0;
  const words = Number(data.word_count) || 0;
  if (cqs >= 75 || words >= 2000) return 'authority';
  if (cqs >= 40 || words >= 800) return 'utility';
  return 'thin';
}

const REBOUND_DAYS: Record<string, number> = { authority: 45, utility: 55, thin: 60 };

function ctrAt(pos: number): number {
  const rounded = Math.round(Math.max(1, Math.min(pos, 10)));
  return CTR_CURVE[rounded] ?? 0.005;
}

function potentialGain(tdi: number): number {
  if (tdi < 15) return 3;
  if (tdi < 50) return 1.5;
  return 0.5;
}

/** Resolve sector from extracted_data to a SEASONALITY_MATRIX key */
function resolveSector(ext: Record<string, any>): string {
  const raw = (ext.sector || ext.industry || ext.niche || 'Services').toString().toLowerCase();
  const map: Record<string, string> = {
    retail: 'Retail', ecommerce: 'Retail', 'e-commerce': 'Retail', boutique: 'Retail', shop: 'Retail',
    realestate: 'RealEstate', immobilier: 'RealEstate', 'real estate': 'RealEstate', immo: 'RealEstate',
    medical: 'Medical', santé: 'Medical', health: 'Medical', pharma: 'Medical', clinique: 'Medical',
    travel: 'Travel', tourisme: 'Travel', voyage: 'Travel', hotel: 'Travel', 'hôtel': 'Travel',
    finance: 'Finance', banque: 'Finance', assurance: 'Finance', insurance: 'Finance', crypto: 'Finance',
    education: 'Education', formation: 'Education', 'e-learning': 'Education', école: 'Education',
  };
  for (const [pattern, sector] of Object.entries(map)) {
    if (raw.includes(pattern)) return sector;
  }
  return 'Services';
}

/** Average seasonal coefficient over the next 3 months (90-day projection window) */
function seasonalFactor90d(sector: string): number {
  const now = new Date();
  const m0 = now.getMonth();
  const coeffs = SEASONALITY_MATRIX[sector] || SEASONALITY_MATRIX['Services'];
  const c1 = coeffs[m0];
  const c2 = coeffs[(m0 + 1) % 12];
  const c3 = coeffs[(m0 + 2) % 12];
  return Math.round(((c1 + c2 + c3) / 3) * 1000) / 1000;
}

// ─── GSC SEGMENTATION ───────────────────────────────────────────────────────

interface GscRow { keys?: string[]; clicks?: number; impressions?: number; position?: number }

interface GscSegment {
  totalClicks: number;
  totalImpressions: number;
  avgPos: number;
  brandClicks: number;
  brandImpressions: number;
  highIntentClicks: number;
  highIntentImpressions: number;
  lowIntentClicks: number;
  lowIntentImpressions: number;
  nonBrandClicks: number;
  nonBrandImpressions: number;
}

function segmentGsc(gsc_data: any, root: string): GscSegment {
  let totalClicks = 0, totalImpressions = 0, posSum = 0, rowCount = 0;
  let brandClicks = 0, brandImpressions = 0;
  let highIntentClicks = 0, highIntentImpressions = 0;
  let lowIntentClicks = 0, lowIntentImpressions = 0;

  const rows: GscRow[] = gsc_data?.rows || [];

  if (rows.length > 0) {
    for (const r of rows) {
      const c = r.clicks || 0, im = r.impressions || 0, pos = r.position || 0;
      const kw = (r.keys?.[0] || '').toLowerCase();
      totalClicks += c; totalImpressions += im; posSum += pos; rowCount++;
      if (isBrand(kw, root)) { brandClicks += c; brandImpressions += im; continue; }
      if (classifyIntent(kw) === 'high_intent') { highIntentClicks += c; highIntentImpressions += im; }
      else { lowIntentClicks += c; lowIntentImpressions += im; }
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
  const nonBrandImpressions = totalImpressions - brandImpressions;

  return {
    totalClicks, totalImpressions, avgPos,
    brandClicks, brandImpressions,
    highIntentClicks, highIntentImpressions,
    lowIntentClicks, lowIntentImpressions,
    nonBrandClicks, nonBrandImpressions,
  };
}

// ─── DETERMINISTIC ANCHORS ──────────────────────────────────────────────────

interface Anchors {
  potentialPositionGain: number;
  targetPos: number;
  theoreticalNonBrandGain: number;  // raw, before seasonality
  seasonalGain: number;             // after seasonality
  seasonalFactor: number;
  sector: string;
  currentMonth: number;
  baseAiRisk: number;
  realisticFloor: number;
  realisticCeiling: number;
}

function computeAnchors(seg: GscSegment, tdiScore: number, sector: string): Anchors {
  const gain = potentialGain(tdiScore);
  const currentCtr = ctrAt(seg.avgPos);
  const targetPos = Math.max(1, seg.avgPos - gain);
  const newCtr = ctrAt(targetPos);
  const theoreticalNonBrandGain = Math.round(seg.nonBrandImpressions * (newCtr - currentCtr));

  const currentMonth = new Date().getMonth();
  const sf = seasonalFactor90d(sector);
  const seasonalGain = Math.round(Math.max(0, theoreticalNonBrandGain) * sf);

  const baseAiRisk = Math.min(100, Math.max(0,
    Math.round((seg.lowIntentClicks / (seg.nonBrandClicks || 1)) * 100)
  ));

  // ±15% corridor around seasonal-adjusted gain
  const realisticTarget = seg.totalClicks + Math.max(0, seasonalGain);
  const realisticFloor = Math.round(realisticTarget * 0.85);
  const realisticCeiling = Math.round(realisticTarget * 1.15);

  return {
    potentialPositionGain: gain, targetPos, theoreticalNonBrandGain,
    seasonalGain, seasonalFactor: sf, sector, currentMonth,
    baseAiRisk, realisticFloor, realisticCeiling,
  };
}

// ─── PROMPT BUILDER ─────────────────────────────────────────────────────────

function buildPrompt(
  ext: Record<string, any>,
  seg: GscSegment,
  anchors: Anchors,
  tdiScore: number,
  errorCount: number,
  depth: string,
  reboundDays: number,
): string {
  const monthName = MONTH_NAMES[anchors.currentMonth];

  return `You are a Senior Search Data Scientist running a causal traffic simulation for the 2026 Search ecosystem.

## PRE-COMPUTED INTELLIGENCE (use as-is, do NOT recalculate)
- Technical Debt Index (TDI): ${tdiScore.toFixed(1)} (from ${errorCount} errors, formula: errors^1.5)
  → High TDI creates an "Indexing Ceiling": Google throttles crawl budget.
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
- Total clicks: ${seg.totalClicks} | Impressions: ${seg.totalImpressions} | Avg position: ${seg.avgPos.toFixed(1)}
- Brand clicks: ${seg.brandClicks} (FROZEN — 0% growth)
- Non-Brand clicks: ${seg.nonBrandClicks}
  ├─ High-Intent (transactional/local): ${seg.highIntentClicks} clicks, ${seg.highIntentImpressions} impressions
  └─ Low-Intent (informational): ${seg.lowIntentClicks} clicks, ${seg.lowIntentImpressions} impressions

## INFLEXIBLE TRUTHS — YOU MUST RESPECT THESE

### 1. CTR Base Gain
Based on industry CTR curves, moving from position ${seg.avgPos.toFixed(1)} to position ${anchors.targetPos.toFixed(1)} yields a raw theoretical gain of **${anchors.theoreticalNonBrandGain}** non-brand clicks.
After applying the seasonal coefficient (${anchors.seasonalFactor}), the adjusted gain is **${anchors.seasonalGain}** clicks.
Your **Realistic** scenario's total clicks MUST equal brand clicks (${seg.brandClicks}) + current non-brand clicks (${seg.nonBrandClicks}) + a gain that is within **±15%** of ${anchors.seasonalGain}.
Use your expertise on the audit's EEAT and content quality to decide the exact position within this corridor.

### 2. Sector Seasonality
We are in **${monthName}**. The sector is **${anchors.sector}**. The seasonal coefficient for the ${anchors.sector} industry over the next 90 days is **${anchors.seasonalFactor}**. You MUST multiply your growth estimates by this factor. A coefficient > 1.0 means favorable season; < 1.0 means headwinds.

### 3. AI Risk Constraint
The calculated Base AI Risk is **${anchors.baseAiRisk}/100**.
You may adjust ai_risk_score by ONLY ±15 points from this base. Final ai_risk_score must be between ${Math.max(0, anchors.baseAiRisk - 15)} and ${Math.min(100, anchors.baseAiRisk + 15)}.

### 4. Scenario Spread (STRICT)
- pessimistic.clicks = realistic.clicks × 0.7
- aggressive.clicks = realistic.clicks × 1.4

## TRUST REBOUND PRINCIPLE
Fixing technical errors triggers a ${reboundDays}-day trust rebound window.

## OUTPUT — Return ONLY this JSON (no markdown fences, no commentary)
{
  "scenarios": {
    "pessimistic": { "clicks": <integer>, "increase_pct": <number> },
    "realistic": { "clicks": <integer>, "increase_pct": <number> },
    "aggressive": { "clicks": <integer>, "increase_pct": <number> }
  },
  "ai_risk_score": <integer ${Math.max(0, anchors.baseAiRisk - 15)}-${Math.min(100, anchors.baseAiRisk + 15)}>,
  "business_impact": {
    "monthly_value_euro": <number>,
    "annual_value_euro": <number>,
    "cpc_basis": { "high_intent_cpc": <number>, "low_intent_cpc": <number> }
  },
  "market_insights": {
    "technical_unlock_potential": <integer>,
    "ai_cannibalization_risk": "low"|"medium"|"high"
  },
  "reasoning": "<2-3 sentence strategic explanation focusing on causality and seasonality>"
}

GUARDRAILS:
- Realistic clicks MUST be between ${anchors.realisticFloor} and ${anchors.realisticCeiling}.
- Brand traffic (${seg.brandClicks}) is constant — included unchanged.
- ai_risk_score MUST be integer between ${Math.max(0, anchors.baseAiRisk - 15)} and ${Math.min(100, anchors.baseAiRisk + 15)}.
- business_impact.annual_value_euro = monthly_value_euro × 12.
- Use CPC: high-intent × €1.20, low-intent × €0.25. Only NET GAIN over baseline.`;
}

// ─── POST-PROCESSING ────────────────────────────────────────────────────────

function validateAndCorrect(
  prediction: any,
  seg: GscSegment,
  anchors: Anchors,
): any {
  const p = prediction;

  // 1. Stability check on realistic (±15% corridor)
  let realisticClicks = p.scenarios?.realistic?.clicks ?? seg.totalClicks;
  if (realisticClicks < anchors.realisticFloor || realisticClicks > anchors.realisticCeiling) {
    realisticClicks = Math.max(anchors.realisticFloor, Math.min(anchors.realisticCeiling, realisticClicks));
  }
  realisticClicks = Math.max(realisticClicks, seg.totalClicks);

  // 2. Enforce scenario spread
  const pessimisticClicks = Math.max(seg.totalClicks, Math.round(realisticClicks * 0.7));
  const aggressiveClicks = Math.round(realisticClicks * 1.4);

  p.scenarios = {
    pessimistic: { clicks: pessimisticClicks, increase_pct: pct(pessimisticClicks, seg.totalClicks) },
    realistic:   { clicks: realisticClicks,   increase_pct: pct(realisticClicks, seg.totalClicks) },
    aggressive:  { clicks: aggressiveClicks,  increase_pct: pct(aggressiveClicks, seg.totalClicks) },
  };

  // 3. Clamp AI risk
  const minRisk = Math.max(0, anchors.baseAiRisk - 15);
  const maxRisk = Math.min(100, anchors.baseAiRisk + 15);
  p.ai_risk_score = Math.min(maxRisk, Math.max(minRisk, p.ai_risk_score ?? anchors.baseAiRisk));

  // 4. ROI propagation from validated clicks
  const netGain = realisticClicks - seg.totalClicks;
  if (netGain > 0 && seg.nonBrandClicks > 0) {
    const hiRatio = seg.highIntentClicks / seg.nonBrandClicks;
    const loRatio = seg.lowIntentClicks / seg.nonBrandClicks;
    const hiCpc = p.business_impact?.cpc_basis?.high_intent_cpc ?? 1.20;
    const loCpc = p.business_impact?.cpc_basis?.low_intent_cpc ?? 0.25;
    const monthlyValue = Math.round((netGain * hiRatio * hiCpc + netGain * loRatio * loCpc) * 100) / 100;
    p.business_impact = {
      monthly_value_euro: monthlyValue,
      annual_value_euro: Math.round(monthlyValue * 12 * 100) / 100,
      cpc_basis: { high_intent_cpc: hiCpc, low_intent_cpc: loCpc },
    };
  } else {
    p.business_impact = p.business_impact || { monthly_value_euro: 0, annual_value_euro: 0, cpc_basis: { high_intent_cpc: 1.20, low_intent_cpc: 0.25 } };
  }

  return p;
}

function pct(final: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.round(((final - baseline) / baseline) * 10000) / 100;
}

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

    // ── Pre-compute intelligence ──
    const errorCount = Number(ext.errors) || 0;
    const tdiScore = computeTDI(errorCount);
    const root = domainRoot(ext.domain || audit.file_path || '');
    const depth = classifyDepth(ext);
    const reboundDays = REBOUND_DAYS[depth];
    const sector = resolveSector(ext);

    // ── GSC segmentation ──
    const seg = segmentGsc(gsc_data, root);

    // ── Deterministic anchors (now with seasonality) ──
    const anchors = computeAnchors(seg, tdiScore, sector);

    // ── Build prompt ──
    const prompt = buildPrompt(ext, seg, anchors, tdiScore, errorCount, depth, reboundDays);

    // ── Call AI ──
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

    await trackTokenUsage('generate-prediction', 'anthropic/claude-3.5-sonnet', aiData.usage);
    trackPaidApiCall('generate-prediction', 'openrouter', 'anthropic/claude-3.5-sonnet');

    let prediction: any;
    try { prediction = JSON.parse(cleaned); }
    catch { throw new Error(`Failed to parse prediction JSON: ${cleaned.substring(0, 300)}`); }

    // ── Post-processing: validate & correct ──
    prediction = validateAndCorrect(prediction, seg, anchors);

    // ── Consistency Rule: ±2% if same audit_id AND no code patch detected ──
    const siteDomain = ext.domain || root || '';
    let anchorPrediction: number | null = null;
    let consistencyClamped = false;
    let consistencySkipReason: string | null = null;

    let hasPatch = false;
    if (siteDomain) {
      const { data: codes } = await supabase
        .from('saved_corrective_codes')
        .select('id')
        .ilike('url', `%${siteDomain}%`)
        .limit(1);
      if (codes && codes.length > 0) hasPatch = true;

      if (!hasPatch) {
        const { data: wpSites } = await supabase
          .from('tracked_sites')
          .select('id, current_config')
          .ilike('domain', `%${siteDomain}%`)
          .limit(1);
        if (wpSites && wpSites.length > 0) {
          const cfg = wpSites[0].current_config as Record<string, any> | null;
          if (cfg && (cfg.fixes?.length > 0 || cfg.last_sync)) hasPatch = true;
        }
      }
    }

    if (hasPatch) {
      consistencySkipReason = 'patch_detected';
    } else if (siteDomain) {
      const { data: priorPreds } = await supabase
        .from('predictions')
        .select('predicted_traffic, prediction_details')
        .eq('audit_id', audit_id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (priorPreds && priorPreds.length > 0) {
        anchorPrediction = priorPreds[0].predicted_traffic;

        // Check if TDI has significantly changed (>30% delta) — if so, widen corridor
        const priorTdi = (priorPreds[0].prediction_details as any)?._meta?.tdi_score;
        const tdiDelta = priorTdi != null ? Math.abs(tdiScore - priorTdi) / (priorTdi || 1) : 0;
        const consistencyMargin = tdiDelta > 0.30 ? 0.10 : 0.02; // 10% if TDI changed significantly, else 2%

        const lowerBound = Math.round(anchorPrediction * (1 - consistencyMargin));
        const upperBound = Math.round(anchorPrediction * (1 + consistencyMargin));
        const currentRealistic = prediction.scenarios.realistic.clicks;

        if (currentRealistic < lowerBound || currentRealistic > upperBound) {
          const clamped = Math.max(lowerBound, Math.min(upperBound, currentRealistic));
          prediction.scenarios.realistic.clicks = clamped;
          prediction.scenarios.realistic.increase_pct = pct(clamped, seg.totalClicks);
          const pessClamped = Math.max(seg.totalClicks, Math.round(clamped * 0.7));
          const aggrClamped = Math.round(clamped * 1.4);
          prediction.scenarios.pessimistic = { clicks: pessClamped, increase_pct: pct(pessClamped, seg.totalClicks) };
          prediction.scenarios.aggressive = { clicks: aggrClamped, increase_pct: pct(aggrClamped, seg.totalClicks) };
          const netGain = clamped - seg.totalClicks;
          if (netGain > 0 && seg.nonBrandClicks > 0) {
            const hiRatio = seg.highIntentClicks / seg.nonBrandClicks;
            const loRatio = seg.lowIntentClicks / seg.nonBrandClicks;
            const hiCpc = prediction.business_impact?.cpc_basis?.high_intent_cpc ?? 1.20;
            const loCpc = prediction.business_impact?.cpc_basis?.low_intent_cpc ?? 0.25;
            const mv = Math.round((netGain * hiRatio * hiCpc + netGain * loRatio * loCpc) * 100) / 100;
            prediction.business_impact = { monthly_value_euro: mv, annual_value_euro: Math.round(mv * 12 * 100) / 100, cpc_basis: { high_intent_cpc: hiCpc, low_intent_cpc: loCpc } };
          }
          consistencyClamped = true;
        }
      } else {
        consistencySkipReason = 'new_audit';
      }
    }

    // ── Inject auditable metadata ──
    const aiRealisticRaw = JSON.parse(cleaned).scenarios?.realistic?.clicks ?? null;
    prediction._meta = {
      tdi_score: tdiScore,
      error_count: errorCount,
      semantic_depth: depth,
      trust_rebound_days: reboundDays,
      brand_clicks: seg.brandClicks,
      non_brand_clicks: seg.nonBrandClicks,
      high_intent_clicks: seg.highIntentClicks,
      low_intent_clicks: seg.lowIntentClicks,
      // Deterministic anchor fields
      theoretical_gain_anchor: anchors.theoreticalNonBrandGain,
      seasonal_gain_anchor: anchors.seasonalGain,
      seasonal_factor: anchors.seasonalFactor,
      sector: anchors.sector,
      current_month: anchors.currentMonth,
      target_position: anchors.targetPos,
      ai_adjustment_delta: (prediction.scenarios.realistic.clicks - seg.totalClicks) - anchors.seasonalGain,
      base_ai_risk: anchors.baseAiRisk,
      realistic_floor: anchors.realisticFloor,
      realistic_ceiling: anchors.realisticCeiling,
      potential_position_gain: anchors.potentialPositionGain,
      ai_raw_realistic_clicks: aiRealisticRaw,
      // Consistency tracking
      consistency_anchor: anchorPrediction,
      consistency_clamped: consistencyClamped,
      consistency_skip_reason: consistencySkipReason,
    };

    // ── Persist ──
    const realisticClicks = prediction.scenarios.realistic.clicks;
    const realisticPct = prediction.scenarios.realistic.increase_pct;

    const { data: saved, error: saveErr } = await supabase
      .from('predictions')
      .insert({
        audit_id,
        client_id,
        domain: siteDomain || null,
        predicted_increase_pct: realisticPct,
        predicted_traffic: realisticClicks,
        baseline_traffic: seg.totalClicks,
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
