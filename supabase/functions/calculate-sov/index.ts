/**
 * calculate-sov — Share of Voice / Share of Recommendation
 * 
 * Strict 7-day cooldown per tracked site to protect API costs.
 * Returns 429 if called within 7 days of last calculation.
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const COOLDOWN_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const ctx = await getUserContext(req);
    if (!ctx) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fair Use ──
    const fairUse = await checkFairUse(ctx.userId, 'expert_audit', ctx.planType);
    if (!fairUse.allowed) {
      return new Response(JSON.stringify({ error: fairUse.reason }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse body ──
    const body = await req.json();
    const trackedSiteId = body.tracked_site_id;
    if (!trackedSiteId) {
      return new Response(JSON.stringify({ error: 'tracked_site_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = getServiceClient();

    // ── Cooldown check ──
    const { data: site, error: siteErr } = await adminClient
      .from('tracked_sites')
      .select('id, domain, last_sov_update, user_id')
      .eq('id', trackedSiteId)
      .single();

    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: 'Site introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership
    if (site.user_id !== ctx.userId) {
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Strict 7-day cooldown
    if (site.last_sov_update) {
      const lastUpdate = new Date(site.last_sov_update);
      const now = new Date();
      const diffMs = now.getTime() - lastUpdate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < COOLDOWN_DAYS) {
        const nextDate = new Date(lastUpdate.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        return new Response(JSON.stringify({
          error: `Le Share of Voice a déjà été mis à jour cette semaine. Prochaine mise à jour disponible le ${nextDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          next_available: nextDate.toISOString(),
          cooldown_days: COOLDOWN_DAYS,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Compute Share of Voice (estimation) ──
    // Retrieve latest LLM visibility data for this site
    const { data: llmScores } = await adminClient
      .from('llm_visibility_scores')
      .select('llm_name, score_percentage, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(10);

    // Retrieve latest SERP data
    const { data: serpSnapshots } = await adminClient
      .from('serp_snapshots')
      .select('total_keywords, top_3, top_10, top_50, etv')
      .eq('tracked_site_id', trackedSiteId)
      .order('measured_at', { ascending: false })
      .limit(1);

    // Calculate SoV estimation
    // Weighted formula: LLM citation coverage (40%) + SERP top-10 share (35%) + ETV relative (25%)
    let sovScore = 0;

    // LLM component: average visibility across LLMs
    const latestLlm = llmScores?.filter(s => s.week_start_date === llmScores[0]?.week_start_date) || [];
    const avgLlmVisibility = latestLlm.length > 0
      ? latestLlm.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / latestLlm.length
      : 0;

    // SERP component: top-10 keyword share
    const serpData = serpSnapshots?.[0];
    const serpTop10Share = serpData && serpData.total_keywords > 0
      ? (serpData.top_10 / serpData.total_keywords) * 100
      : 0;

    // ETV component (normalized to 0-100 scale, capped)
    const etvNormalized = serpData ? Math.min(100, (serpData.etv / 1000) * 100) : 0;

    sovScore = Math.round(
      avgLlmVisibility * 0.40 +
      serpTop10Share * 0.35 +
      etvNormalized * 0.25
    );

    // Clamp 0-100
    sovScore = Math.max(0, Math.min(100, sovScore));

    // ── Persist result ──
    const { error: updateErr } = await adminClient
      .from('tracked_sites')
      .update({ last_sov_update: new Date().toISOString() })
      .eq('id', trackedSiteId);

    if (updateErr) {
      console.error('[SoV] Failed to update last_sov_update:', updateErr);
    }

    // Save to user_stats_history via voice_share
    const { error: statsErr } = await adminClient
      .from('user_stats_history')
      .insert({
        tracked_site_id: trackedSiteId,
        user_id: ctx.userId,
        voice_share: sovScore,
        recorded_at: new Date().toISOString(),
      });

    if (statsErr) {
      console.error('[SoV] Failed to save stats:', statsErr);
    }

    console.log(`[SoV] Calculated for ${site.domain}: ${sovScore}% (LLM: ${avgLlmVisibility.toFixed(1)}, SERP: ${serpTop10Share.toFixed(1)}, ETV: ${etvNormalized.toFixed(1)})`);

    return new Response(JSON.stringify({
      success: true,
      sov_score: sovScore,
      breakdown: {
        llm_visibility: Math.round(avgLlmVisibility * 10) / 10,
        serp_top10_share: Math.round(serpTop10Share * 10) / 10,
        etv_normalized: Math.round(etvNormalized * 10) / 10,
      },
      next_available: new Date(Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[SoV] Error:', err);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
