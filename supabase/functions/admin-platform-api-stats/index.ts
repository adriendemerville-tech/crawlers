/**
 * admin-platform-api-stats — KPIs agrégés pour la plateforme API Crawlers (admin only).
 *
 * GET /admin-platform-api-stats?days=30
 *
 * Renvoie :
 *  - usage   : jobs (total, par status, par feature), top users
 *  - signups : nb clés API créées, devs uniques
 *  - revenue : crédits Paddle (montant total, nb recharges, par jour)
 *  - wallets : balance totale, nb wallets actifs
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
    const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 30), 1), 365);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    // ── Jobs
    const { data: jobs } = await service
      .from('crawlers_api_jobs')
      .select('id, user_id, feature, status, created_at')
      .gte('created_at', since);

    const jobsArr = jobs ?? [];
    const byStatus: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const jobsDaily: Record<string, number> = {};
    for (const j of jobsArr) {
      byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
      byFeature[j.feature] = (byFeature[j.feature] ?? 0) + 1;
      byUser[j.user_id] = (byUser[j.user_id] ?? 0) + 1;
      const d = String(j.created_at).slice(0, 10);
      jobsDaily[d] = (jobsDaily[d] ?? 0) + 1;
    }
    const topFeatures = Object.entries(byFeature)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([feature, count]) => ({ feature, count }));
    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user_id, count]) => ({ user_id, count }));

    // ── API keys (signups dev)
    const { data: keys } = await service
      .from('crawlers_api_keys')
      .select('id, user_id, created_at, revoked_at')
      .gte('created_at', since);
    const { count: totalKeys } = await service
      .from('crawlers_api_keys')
      .select('id', { count: 'exact', head: true });
    const { count: activeKeys } = await service
      .from('crawlers_api_keys')
      .select('id', { count: 'exact', head: true })
      .is('revoked_at', null);
    const keysArr = keys ?? [];
    const uniqueDevs = new Set(keysArr.map((k) => k.user_id)).size;

    // ── Revenue (Paddle credits)
    const { data: tx } = await service
      .from('dev_wallet_transactions')
      .select('amount_cents, source, created_at, user_id')
      .eq('source', 'paddle')
      .gte('created_at', since);
    const txArr = tx ?? [];
    const totalRevenueCents = txArr.reduce((s, t) => s + Number(t.amount_cents ?? 0), 0);
    const revenueDaily: Record<string, number> = {};
    for (const t of txArr) {
      const d = String(t.created_at).slice(0, 10);
      revenueDaily[d] = (revenueDaily[d] ?? 0) + Number(t.amount_cents ?? 0);
    }
    const payingDevs = new Set(txArr.map((t) => t.user_id)).size;

    // ── Wallets
    const { data: wallets } = await service
      .from('dev_wallets')
      .select('balance_cents');
    const totalBalanceCents = (wallets ?? []).reduce((s, w) => s + Number(w.balance_cents ?? 0), 0);
    const walletsCount = wallets?.length ?? 0;
    const activeWallets = (wallets ?? []).filter((w) => Number(w.balance_cents ?? 0) > 0).length;

    // Daily series
    const daily: { date: string; jobs: number; revenue_cents: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      daily.push({ date: d, jobs: jobsDaily[d] ?? 0, revenue_cents: revenueDaily[d] ?? 0 });
    }

    return jsonOk({
      window_days: days,
      usage: {
        total_jobs: jobsArr.length,
        by_status: byStatus,
        top_features: topFeatures,
        top_users: topUsers,
        unique_users: Object.keys(byUser).length,
      },
      signups: {
        keys_created_window: keysArr.length,
        unique_devs_window: uniqueDevs,
        total_keys: totalKeys ?? 0,
        active_keys: activeKeys ?? 0,
      },
      revenue: {
        total_cents: totalRevenueCents,
        recharges: txArr.length,
        paying_devs: payingDevs,
      },
      wallets: {
        count: walletsCount,
        active: activeWallets,
        total_balance_cents: totalBalanceCents,
      },
      daily,
    });
  } catch (e) {
    console.error('[admin-platform-api-stats] Erreur:', e);
    return jsonError((e as Error).message, 500);
  }
});

function jsonOk(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
}
function jsonError(m: string, s = 400) {
  return new Response(JSON.stringify({ error: m }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: s });
}
