// cron-netlinking-monitor — surveillance hebdomadaire des commandes netlinking.
// - Rafraîchit le statut des commandes pending/in_progress via l'API provider.
// - Détecte les liens perdus (published_url renvoyant 404, ou lien absent de la page cible).
// - Marque status='lost' + insère une alerte dans anomaly_alerts pour l'utilisateur.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Order = {
  id: string;
  user_id: string;
  tracked_site_id: string | null;
  provider_slug: 'accesslink' | 'rocketlinks' | 'getfluence';
  provider_order_id: string | null;
  target_url: string;
  anchor_text: string;
  live_url: string | null;
  status: string;
};

async function fetchProviderStatus(order: Order): Promise<{ status?: string; published_url?: string } | null> {
  try {
    if (order.provider_slug === 'accesslink') {
      const key = Deno.env.get('ACCESSLINK_API_KEY');
      if (!key || !order.provider_order_id) return null;
      const res = await fetch(`https://api.accesslink.ai/v1/orders/${order.provider_order_id}`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (!res.ok) return null;
      const j = await res.json();
      return { status: j.status, published_url: j.published_url };
    }
    if (order.provider_slug === 'rocketlinks') {
      const key = Deno.env.get('ROCKETLINKS_API_KEY');
      if (!key || !order.provider_order_id) return null;
      const res = await fetch(`https://api.rocketlinks.com/v1/orders/${order.provider_order_id}`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (!res.ok) return null;
      const j = await res.json();
      return { status: j.status, published_url: j.url };
    }
    if (order.provider_slug === 'getfluence') {
      const key = Deno.env.get('GETFLUENCE_API_KEY');
      if (!key || !order.provider_order_id) return null;
      const res = await fetch(`https://api.getfluence.com/v1/campaigns/${order.provider_order_id}`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (!res.ok) return null;
      const j = await res.json();
      return { status: j.state, published_url: j.publication_url };
    }
  } catch (_) { /* swallow */ }
  return null;
}

async function verifyLiveLink(publishedUrl: string, targetUrl: string): Promise<'live' | 'lost' | 'unknown'> {
  try {
    const res = await fetch(publishedUrl, { method: 'GET', headers: { 'User-Agent': 'CrawlersMonitor/1.0' } });
    if (!res.ok) return res.status === 404 ? 'lost' : 'unknown';
    const html = await res.text();
    const target = targetUrl.replace(/\/$/, '');
    const hasLink = html.includes(target) || html.includes(target.replace(/^https?:\/\//, ''));
    return hasLink ? 'live' : 'lost';
  } catch (_) {
    return 'unknown';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const service = createClient(SUPABASE_URL, SERVICE_ROLE);
  const summary = { checked: 0, updated: 0, lost: 0, reaped: 0, refunded: 0, errors: [] as string[] };

  try {
    const { data: orders, error } = await service
      .from('netlinking_orders')
      .select('id,user_id,tracked_site_id,provider_slug,provider_order_id,target_url,anchor_text,live_url,status')
      .in('status', ['pending', 'in_progress', 'live'])
      .limit(500);

    if (error) throw error;
    const list = (orders || []) as Order[];
    summary.checked = list.length;

    for (const order of list) {
      const patch: Record<string, unknown> = {};

      // 1) Poll provider si pas encore live
      if (order.status !== 'live') {
        const remote = await fetchProviderStatus(order);
        if (remote?.status) {
          const s = remote.status.toLowerCase();
          if (s === 'published' || s === 'live' || s === 'completed') {
            patch.status = 'live';
            patch.published_at = new Date().toISOString();
            if (remote.published_url) patch.live_url = remote.published_url;
          } else if (s === 'rejected' || s === 'cancelled' || s === 'failed') {
            patch.status = 'rejected';
          }
        }
      }

      // 2) Vérification hebdo des liens vivants
      const urlToCheck = (patch.live_url as string | undefined) ?? order.live_url;
      if (urlToCheck && (patch.status === 'live' || order.status === 'live')) {
        const health = await verifyLiveLink(urlToCheck, order.target_url);
        if (health === 'lost') {
          patch.status = 'lost';
          summary.lost++;

          const domain = (() => { try { return new URL(order.target_url).hostname; } catch { return null; } })();
          let trackedSiteId = order.tracked_site_id;
          if (!trackedSiteId && domain) {
            const { data: site } = await service
              .from('tracked_sites')
              .select('id')
              .eq('user_id', order.user_id)
              .ilike('domain', `%${domain.replace(/^www\./, '')}%`)
              .limit(1)
              .maybeSingle();
            trackedSiteId = site?.id ?? null;
          }

          // anomaly_alerts exige tracked_site_id + les colonnes statistiques NOT NULL
          if (trackedSiteId && domain) {
            const { error: aerr } = await service.from('anomaly_alerts').insert({
              tracked_site_id: trackedSiteId,
              user_id: order.user_id,
              domain,
              metric_name: 'netlinking_link_lost',
              metric_source: 'netlinking',
              severity: 'high',
              direction: 'down',
              z_score: 0,
              current_value: 0,
              baseline_mean: 1,
              baseline_stddev: 0,
              description: `Backlink perdu : ${order.target_url} n'est plus détecté sur ${urlToCheck}. Contacte ${order.provider_slug} pour recours.`,
            });
            if (aerr) summary.errors.push(`alert ${order.id}: ${aerr.message}`);
          } else {
            summary.errors.push(`alert ${order.id}: aucun tracked_site résolu pour ${domain ?? 'url invalide'}`);
          }
        }
      }

      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        const { error: uerr } = await service.from('netlinking_orders').update(patch).eq('id', order.id);
        if (uerr) summary.errors.push(`${order.id}: ${uerr.message}`);
        else summary.updated++;
      }
    }

    // 3) Reaper des commandes orphelines : provider OK mais update final échoué,
    // ou crash entre le débit wallet et la confirmation. Après 1 h, on annule et
    // on rembourse si (et seulement si) un débit existe et aucun refund n'a eu lieu.
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stale } = await service
      .from('netlinking_orders')
      .select('id,user_id,total_ht_cents,created_at')
      .eq('status', 'draft')
      .lt('created_at', cutoff)
      .limit(100);

    for (const o of (stale || []) as Array<{ id: string; user_id: string; total_ht_cents: number }>) {
      const { data: claimed } = await service
        .from('netlinking_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          metadata: { reason: 'stale_draft_reaped' },
        })
        .eq('id', o.id)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();
      if (!claimed) continue;

      const { data: debits } = await service
        .from('dev_wallet_transactions')
        .select('id')
        .eq('source_ref', `netlinking:${o.id}`)
        .limit(1);
      const { data: refunds } = await service
        .from('dev_wallet_transactions')
        .select('id')
        .eq('source_ref', `netlinking-refund:${o.id}`)
        .limit(1);

      if ((debits?.length ?? 0) > 0 && (refunds?.length ?? 0) === 0) {
        const { error: rerr } = await service.rpc('dev_wallet_credit', {
          _user_id: o.user_id,
          _amount_cents: o.total_ht_cents,
          _source: 'refund',
          _source_ref: `netlinking-refund:${o.id}`,
          _description: 'Refund commande netlinking restée en brouillon',
        });
        if (rerr) summary.errors.push(`reaper refund ${o.id}: ${rerr.message}`);
        else {
          await service.from('netlinking_orders')
            .update({ status: 'refunded', refunded_at: new Date().toISOString() })
            .eq('id', o.id);
          summary.refunded++;
        }
      }
      summary.reaped++;
    }




    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, ...summary }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
