import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: generate-prediction
 * 
 * Combines extracted PDF audit data with GSC baseline data
 * to generate a traffic growth prediction using Gemini AI.
 * 
 * The prediction uses industry CTR curves and benchmark data
 * to estimate future traffic after implementing audit recommendations.
 */
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

    // 1. Get the extracted audit data
    const { data: audit, error: auditErr } = await supabase
      .from('pdf_audits')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (auditErr || !audit || audit.status !== 'processed') {
      throw new Error('Audit not found or not yet processed');
    }

    const extractedData = audit.extracted_data;

    // 2. Compute baseline traffic from GSC data or use provided value
    let baselineTraffic = 0;
    let baselineImpressions = 0;
    let avgPosition = 0;

    if (gsc_data && gsc_data.rows) {
      for (const row of gsc_data.rows) {
        baselineTraffic += row.clicks || 0;
        baselineImpressions += row.impressions || 0;
        avgPosition += row.position || 0;
      }
      if (gsc_data.rows.length > 0) {
        avgPosition /= gsc_data.rows.length;
      }
    } else if (gsc_data?.total_clicks) {
      baselineTraffic = gsc_data.total_clicks;
      baselineImpressions = gsc_data.total_impressions || 0;
      avgPosition = gsc_data.avg_position || 0;
    }

    // 3. Build prediction prompt with industry benchmarks
    const prompt = `You are a senior SEO traffic prediction engine. Based on the following data, predict the organic traffic growth over the next 90 days if all audit recommendations are implemented.

## Current SEO Audit Data (from PDF analysis):
- Technical errors found: ${extractedData.errors || 0}
- Technical SEO score: ${extractedData.technical_score || 'N/A'}/100
- Content quality score: ${extractedData.content_quality_score || 'N/A'}/100
- GEO keywords: ${JSON.stringify(extractedData.geo_keywords || [])}
- Location target: ${extractedData.location_target || 'N/A'}
- Page speed score: ${extractedData.page_speed_score || 'N/A'}
- Mobile score: ${extractedData.mobile_score || 'N/A'}
- Structured data present: ${extractedData.structured_data_present || false}
- Domain authority: ${extractedData.domain_authority || 'N/A'}

## Current Google Search Console Data (last 30 days):
- Total clicks: ${baselineTraffic}
- Total impressions: ${baselineImpressions}
- Average position: ${avgPosition.toFixed(1)}

## Industry CTR Benchmarks by Position:
Position 1: 31.7% CTR | Position 2: 24.7% | Position 3: 18.6%
Position 4: 13.6% | Position 5: 9.5% | Position 6-10: 3-6%

## Instructions:
Calculate the predicted traffic increase considering:
1. How many positions the site could gain by fixing technical errors
2. The CTR improvement from position gains
3. The impact of content quality improvements
4. The effect of structured data implementation
5. GEO optimization benefits for local searches

Return ONLY valid JSON:
{
  "predicted_increase_pct": <percentage increase as number, e.g. 25.5>,
  "predicted_traffic": <total predicted monthly clicks after 90 days>,
  "confidence_level": <"low"|"medium"|"high">,
  "key_factors": [<top 3 factors driving the prediction>],
  "reasoning": "<2-3 sentence explanation>"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a precise SEO traffic prediction engine. Return only valid JSON.' },
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

    let prediction;
    try {
      prediction = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse prediction JSON: ${cleaned.substring(0, 200)}`);
    }

    // 4. Save prediction to database
    const { data: savedPrediction, error: saveErr } = await supabase
      .from('predictions')
      .insert({
        audit_id,
        client_id,
        predicted_increase_pct: prediction.predicted_increase_pct || 0,
        predicted_traffic: prediction.predicted_traffic || 0,
        baseline_traffic: baselineTraffic,
        baseline_data: gsc_data || {},
        prediction_details: prediction,
      })
      .select()
      .single();

    if (saveErr) throw new Error(`Failed to save prediction: ${saveErr.message}`);

    // 5. Update system metrics
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
