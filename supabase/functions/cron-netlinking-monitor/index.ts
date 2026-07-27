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
  provider_slug: 'accesslink' | 'rocketlinks' | 'getfluence';
  provider_order_id: string | null;
  target_url: string;
  anchor_text: string;
  published_url: string | null;
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
  const summary = { checked: 0, updated: 0, lost: 0, errors: [] as string[] };

  try {
    const { data: orders, error } = await service
      .from('netlinking_orders')
      .select('id,user_id,provider_slug,provider_order_id,target_url,anchor_text,published_url,status')
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
            if (remote.published_url) patch.published_url = remote.published_url;
          } else if (s === 'rejected' || s === 'cancelled' || s === 'failed') {
            patch.status = 'rejected';
          }
        }
      }

      // 2) Vérification hebdo des liens vivants
      const urlToCheck = (patch.published_url as string | undefined) ?? order.published_url;
      if (urlToCheck && (patch.status === 'live' || order.status === 'live')) {
        const health = await verifyLiveLink(urlToCheck, order.target_url);
        if (health === 'lost') {
          patch.status = 'lost';
          summary.lost++;
          await service.from('anomaly_alerts').insert({
            user_id: order.user_id,
            metric_name: 'netlinking_link_lost',
            metric_source: 'netlinking',
            severity: 'high',
            direction: 'down',
            description: `Backlink perdu : ${order.target_url} n'est plus détecté sur ${urlToCheck}. Contacte ${order.provider_slug} pour recours.`,
            domain: (() => { try { return new URL(order.target_url).hostname; } catch { return null; } })(),
          });
        }
      }

      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        const { error: uerr } = await service.from('netlinking_orders').update(patch).eq('id', order.id);
        if (uerr) summary.errors.push(`${order.id}: ${uerr.message}`);
        else summary.updated++;
      }
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
