/**
 * copilot-admin-stats — KPIs agrégés du Copilot pour le dashboard admin.
 *
 * GET /copilot-admin-stats?days=7
 *
 * Réservé aux admins (vérifié via has_role).
 * Renvoie :
 *   - totals : nb sessions, nb actions, coût LLM total, durée moyenne
 *   - by_persona : breakdown par persona (felix / strategist)
 *   - top_skills : 10 skills les plus utilisés avec taux d'erreur
 *   - approvals : nb awaiting / approved (taux d'approbation)
 *   - daily : série temporelle (jour, sessions, actions, coût)
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonError('Non authentifié', 401);

    const userClient = getUserClient(authHeader);
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return jsonError('Token invalide', 401);
    const userId = claims.claims.sub as string;

    const service = getServiceClient();
    const { data: isAdmin } = await service.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) return jsonError('Réservé administrateurs', 403);

    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 90);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    // ── Sessions
    const { data: sessions } = await service
      .from('copilot_sessions')
      .select('id, persona, created_at, status')
      .gte('created_at', since);

    // ── Actions
    const { data: actions } = await service
      .from('copilot_actions')
      .select('skill, persona, status, duration_ms, llm_cost_usd, created_at')
      .gte('created_at', since);

    const sessionsArr = sessions ?? [];
    const actionsArr = actions ?? [];

    // Filtrer les skills internes pour les stats
    const realActions = actionsArr.filter(
      (a) => a.skill !== '_user_message' && a.skill !== '_assistant_reply',
    );

    // ── Totals
    const totalCostUsd = actionsArr.reduce((s, a) => s + Number(a.llm_cost_usd ?? 0), 0);
    const avgDuration = realActions.length > 0
      ? realActions.reduce((s, a) => s + Number(a.duration_ms ?? 0), 0) / realActions.length
      : 0;

    // ── By persona
    const byPersona: Record<string, { sessions: number; actions: number; cost: number }> = {};
    for (const s of sessionsArr) {
      byPersona[s.persona] ??= { sessions: 0, actions: 0, cost: 0 };
      byPersona[s.persona].sessions++;
    }
    for (const a of actionsArr) {
      byPersona[a.persona] ??= { sessions: 0, actions: 0, cost: 0 };
      byPersona[a.persona].actions++;
      byPersona[a.persona].cost += Number(a.llm_cost_usd ?? 0);
    }

    // ── Top skills
    const skillStats: Record<string, { total: number; errors: number; rejected: number; awaiting: number }> = {};
    for (const a of realActions) {
      skillStats[a.skill] ??= { total: 0, errors: 0, rejected: 0, awaiting: 0 };
      skillStats[a.skill].total++;
      if (a.status === 'error') skillStats[a.skill].errors++;
      if (a.status === 'rejected') skillStats[a.skill].rejected++;
      if (a.status === 'awaiting_approval') skillStats[a.skill].awaiting++;
    }
    const topSkills = Object.entries(skillStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([skill, stats]) => ({
        skill,
        total: stats.total,
        error_rate: stats.total > 0 ? stats.errors / stats.total : 0,
        rejected_rate: stats.total > 0 ? stats.rejected / stats.total : 0,
      }));

    // ── Approvals
    const awaiting = realActions.filter((a) => a.status === 'awaiting_approval').length;
    const totalApprovalEligible = realActions.filter(
      (a) => a.status === 'awaiting_approval' || a.status === 'success' || a.status === 'rejected',
    ).length;
    const approvalRate = totalApprovalEligible > 0 ? (totalApprovalEligible - awaiting) / totalApprovalEligible : 0;

    // ── Daily series
    const daily: Record<string, { sessions: number; actions: number; cost: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      daily[d] = { sessions: 0, actions: 0, cost: 0 };
    }
    for (const s of sessionsArr) {
      const d = String(s.created_at).slice(0, 10);
      if (daily[d]) daily[d].sessions++;
    }
    for (const a of actionsArr) {
      const d = String(a.created_at).slice(0, 10);
      if (daily[d]) {
        daily[d].actions++;
        daily[d].cost += Number(a.llm_cost_usd ?? 0);
      }
    }
    const dailySeries = Object.entries(daily)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return jsonOk({
      window_days: days,
      totals: {
        sessions: sessionsArr.length,
        actions: realActions.length,
        cost_usd: Number(totalCostUsd.toFixed(4)),
        avg_duration_ms: Math.round(avgDuration),
      },
      by_persona: byPersona,
      top_skills: topSkills,
      approvals: {
        awaiting,
        approval_rate: Number(approvalRate.toFixed(3)),
      },
      daily: dailySeries,
    });
  } catch (e) {
    console.error('[copilot-admin-stats] Erreur:', e);
    return jsonError((e as Error).message, 500);
  }
});

function jsonOk(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
}
function jsonError(m: string, s = 400) {
  return new Response(JSON.stringify({ error: m }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: s });
}
