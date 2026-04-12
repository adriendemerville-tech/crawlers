import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Parménion Feedback Loop
 * 
 * Runs at T+30 after a decision was executed.
 * Compares predicted impact with actual GSC data.
 * Calibrates risk scores and flags errors for few-shot learning.
 * 
 * Conservative mode threshold: 20% error rate on last 10 decisions.
 */

const IMPACT_MAP: Record<string, number> = {
  'très_avancé': 5,
  'avancé': 4,
  'neutre': 3,
  'modéré': 2,
  'faible': 1,
};

function classifyImpact(clicksDelta: number, ctrDelta: number, impressionsDelta: number, positionDelta: number): string {
  // Weighted score: 35% clicks, 25% CTR, 20% impressions, 20% position
  const clicksScore = clicksDelta > 20 ? 5 : clicksDelta > 10 ? 4 : clicksDelta > 0 ? 3 : clicksDelta > -5 ? 2 : 1;
  const ctrScore = ctrDelta > 15 ? 5 : ctrDelta > 5 ? 4 : ctrDelta > 0 ? 3 : ctrDelta > -5 ? 2 : 1;
  const impressionsScore = impressionsDelta > 20 ? 5 : impressionsDelta > 10 ? 4 : impressionsDelta > 0 ? 3 : impressionsDelta > -5 ? 2 : 1;
  const positionScore = positionDelta < -3 ? 5 : positionDelta < -1 ? 4 : Math.abs(positionDelta) < 1 ? 3 : positionDelta > 3 ? 1 : 2;

  const weighted = clicksScore * 0.35 + ctrScore * 0.25 + impressionsScore * 0.20 + positionScore * 0.20;

  if (weighted >= 4.5) return 'très_avancé';
  if (weighted >= 3.5) return 'avancé';
  if (weighted >= 2.5) return 'neutre';
  if (weighted >= 1.5) return 'modéré';
  return 'faible';
}

function classifyErrorCategory(predicted: string, actual: string, riskPredicted: number): string {
  const predVal = IMPACT_MAP[predicted] || 3;
  const actVal = IMPACT_MAP[actual] || 3;

  if (predVal > actVal + 1) return 'overestimated_impact';
  if (actVal < 2 && riskPredicted <= 2) return 'underestimated_risk';
  if (actVal === 1) return 'negative_impact';
  return 'general_miscalibration';
}

/**
 * Compute a formal reward signal (-100 to +100).
 * Positive = action improved metrics; Negative = harmful/neutral despite high priority.
 * 
 * Components: 40% clicks, 25% position (inverted), 20% CTR, 15% impressions.
 * Over-prioritization penalty if spiral_score was high but outcome poor.
 */
function computeRewardSignal(
  clicksDelta: number,
  ctrDelta: number,
  impressionsDelta: number,
  positionDelta: number,
  spiralScoreAtDecision: number | null,
): number {
  const clicksReward = Math.max(-25, Math.min(25, clicksDelta * 0.5));
  const positionReward = Math.max(-25, Math.min(25, -positionDelta * 3));
  const ctrReward = Math.max(-25, Math.min(25, ctrDelta * 0.8));
  const impressionsReward = Math.max(-25, Math.min(25, impressionsDelta * 0.3));

  let reward = clicksReward * 0.40 + positionReward * 0.25 + ctrReward * 0.20 + impressionsReward * 0.15;

  // Over-prioritization penalty
  if (spiralScoreAtDecision && spiralScoreAtDecision > 60 && reward < -5) {
    const overPrioPenalty = (spiralScoreAtDecision - 60) / 40 * 10;
    reward -= overPrioPenalty;
  }

  return Math.max(-100, Math.min(100, Math.round(reward * 100) / 100));
}

Deno.serve(handleRequest(async (req) => {
try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return jsonError('Unauthorized', 401);
    if (!auth.isAdmin) return jsonError('Admin only', 403);

    const { domain, decision_id } = await req.json();
    const supabase = getServiceClient();

    // Find decisions ready for feedback (completed, no measurement yet, > 30 days old)
    let query = supabase
      .from('parmenion_decision_log')
      .select('*')
      .eq('status', 'completed')
      .is('measured_at', null)
      .lt('execution_completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (decision_id) {
      query = query.eq('id', decision_id);
    } else if (domain) {
      query = query.eq('domain', domain);
    }

    const { data: decisions, error: decError } = await query.limit(20);
    if (decError || !decisions?.length) {
      return jsonOk({ message: 'No decisions ready for feedback', count: 0 });
    }

    const results: any[] = [];

    for (const decision of decisions) {
      // Fetch current GSC data for comparison
      const { data: gscSnapshot } = await supabase
        .from('audit_impact_snapshots')
        .select('gsc_t30')
        .eq('domain', decision.domain)
        .eq('tracked_site_id', decision.tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const gscT30 = gscSnapshot?.gsc_t30 as any;

      if (!gscT30 && !decision.baseline_clicks) {
        // No data to compare — skip
        results.push({ id: decision.id, status: 'skipped', reason: 'no_gsc_data' });
        continue;
      }

      // Calculate deltas
      const t30Clicks = gscT30?.clicks ?? decision.t30_clicks ?? 0;
      const t30Impressions = gscT30?.impressions ?? decision.t30_impressions ?? 0;
      const t30Ctr = gscT30?.ctr ?? decision.t30_ctr ?? 0;
      const t30Position = gscT30?.position ?? decision.t30_position ?? 0;

      const baseClicks = decision.baseline_clicks || 1;
      const baseImpressions = decision.baseline_impressions || 1;
      const baseCtr = decision.baseline_ctr || 1;
      const basePosition = decision.baseline_position || 50;

      const clicksDelta = ((t30Clicks - baseClicks) / baseClicks) * 100;
      const impressionsDelta = ((t30Impressions - baseImpressions) / baseImpressions) * 100;
      const ctrDelta = ((t30Ctr - baseCtr) / baseCtr) * 100;
      const positionDelta = t30Position - basePosition; // negative = improvement

      // Classify actual impact
      const impactActual = classifyImpact(clicksDelta, ctrDelta, impressionsDelta, positionDelta);
      const impactPredicted = decision.impact_predicted || decision.impact_level;

      // Check if this is an error
      const predVal = IMPACT_MAP[impactPredicted] || 3;
      const actVal = IMPACT_MAP[impactActual] || 3;
      const isError = Math.abs(predVal - actVal) >= 2 || (actVal <= 1 && predVal >= 3);

      // Calibrate risk
      let riskCalibrated = decision.risk_predicted;
      let calibrationNote = '';

      if (isError) {
        if (actVal <= 1) {
          riskCalibrated = Math.min(5, decision.risk_predicted + 2);
          calibrationNote = `Impact négatif détecté. Clicks: ${clicksDelta.toFixed(1)}%, Position: ${positionDelta > 0 ? '+' : ''}${positionDelta.toFixed(1)}`;
        } else if (predVal > actVal) {
          riskCalibrated = Math.min(5, decision.risk_predicted + 1);
          calibrationNote = `Impact surestimé: prévu "${impactPredicted}" vs réel "${impactActual}"`;
        }
      }

      const errorCategory = isError ? classifyErrorCategory(impactPredicted, impactActual, decision.risk_predicted) : null;

      // Compute formal reward signal (-100 to +100)
      // Positive = beneficial action, Negative = harmful or wasted effort
      const rewardSignal = computeRewardSignal(
        clicksDelta, ctrDelta, impressionsDelta, positionDelta,
        decision.spiral_score_at_decision
      );

      // Update the decision log
      const { error: updateError } = await supabase
        .from('parmenion_decision_log')
        .update({
          impact_actual: impactActual,
          risk_calibrated: riskCalibrated,
          calibration_note: calibrationNote,
          is_error: isError,
          error_category: errorCategory,
          measured_at: new Date().toISOString(),
          t30_clicks: t30Clicks,
          t30_impressions: t30Impressions,
          t30_ctr: t30Ctr,
          t30_position: t30Position,
          reward_signal: rewardSignal,
        })
        .eq('id', decision.id);

      if (updateError) {
        console.error(`[Parménion Feedback] Update error for ${decision.id}:`, updateError);
      }

      results.push({
        id: decision.id,
        domain: decision.domain,
        spiral_score_at_decision: decision.spiral_score_at_decision,
        reward_signal: rewardSignal,
        impact_predicted: impactPredicted,
        impact_actual: impactActual,
        risk_predicted: decision.risk_predicted,
        risk_calibrated: riskCalibrated,
        is_error: isError,
        error_category: errorCategory,
        deltas: { clicks: clicksDelta, impressions: impressionsDelta, ctr: ctrDelta, position: positionDelta },
      });
    }

    // Check if conservative mode should trigger
    const { data: errorRate } = await supabase.rpc('parmenion_error_rate', { p_domain: domain || decisions[0]?.domain });

    return jsonOk({
      processed: results.length,
      errors_found: results.filter(r => r.is_error).length,
      results,
      error_rate: errorRate,
      conservative_mode: errorRate?.conservative_mode,
    });

  } catch (e) {
    console.error('[Parménion Feedback] Error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
}));