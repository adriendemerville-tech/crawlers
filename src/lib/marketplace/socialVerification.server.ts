/**
 * socialVerification.server.ts (L6.5)
 *
 * Contrôle de publication et de maintien d'une jambe Collab via l'API Meta :
 * récupération du `media_id`, contrôle de la mention de conformité (ARPP/FTC),
 * archivage de la preuve, relevé des insights à J+7 pour le reporting acheteur.
 *
 * Une story est éphémère : passé 24 h, l'absence du média n'est pas une rupture,
 * seule l'absence de preuve à la première vérification en est une.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { loadConstants, num, obj } from './constants.server';
import { hasComplianceMention } from './socialPricing';

const GRAPH = 'https://graph.facebook.com/v21.0';

export type SocialVerdict = 'ok' | 'missing_mention' | 'not_published' | 'unreadable';

export interface SocialCheckResult {
  order_id: string;
  verdict: SocialVerdict;
  media_id: string | null;
  permalink: string | null;
  mention_found: boolean;
  compliance_found: boolean;
  insights: Record<string, number> | null;
  message: string;
  checked_at: string;
}

interface MediaItem {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  timestamp?: string;
}

function mentionNeedle(order: { buyer_domain: string | null; anchor: string | null; target_url: string | null }): string[] {
  const needles = new Set<string>();
  if (order.buyer_domain) needles.add(order.buyer_domain.toLowerCase().replace(/^www\./, ''));
  if (order.anchor) needles.add(order.anchor.toLowerCase());
  if (order.target_url) {
    try {
      needles.add(new URL(order.target_url).hostname.toLowerCase().replace(/^www\./, ''));
    } catch {
      /* URL invalide : on garde les autres indices */
    }
  }
  return [...needles].filter((n) => n.length >= 3);
}

async function graph(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params).toString()}`, { redirect: 'follow' });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json;
}

/** Insights d'un média (portée, impressions, interactions) — reporting acheteur. */
export async function fetchMediaInsights(mediaId: string, token: string): Promise<Record<string, number> | null> {
  try {
    const json = await graph(`${mediaId}/insights`, {
      metric: 'reach,impressions,total_interactions',
      access_token: token,
    });
    const out: Record<string, number> = {};
    for (const entry of json?.data ?? []) {
      out[entry.name] = Number(entry.values?.[0]?.value) || 0;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function verifySocialPublication(orderId: string): Promise<SocialCheckResult> {
  const constants = await loadConstants();
  const complianceTags = (constants.values.insta_compliance_tags as string[]) ?? [];
  const insightsDelay = num(constants, 'insta_insights_delay_days');
  const schedule = obj<Record<string, number>>(constants, 'verification_schedule_days');
  const now = new Date();

  const { data: order, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id, seller_id, asset_id, asset_kind, buyer_domain, anchor, target_url, published_at, status')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!order) throw new Error('Commande introuvable');

  const fail = (verdict: SocialVerdict, message: string): SocialCheckResult => ({
    order_id: orderId,
    verdict,
    media_id: null,
    permalink: null,
    mention_found: false,
    compliance_found: false,
    insights: null,
    message,
    checked_at: now.toISOString(),
  });

  const { data: asset } = await supabaseAdmin
    .from('marketplace_social_assets')
    .select('id, platform, account_id, social_account_id')
    .eq('id', order.asset_id)
    .maybeSingle();
  if (!asset) return fail('unreadable', 'Actif Collab introuvable pour cette commande');

  const { data: account } = await supabaseAdmin
    .from('social_accounts')
    .select('access_token, status')
    .eq('id', asset.social_account_id)
    .maybeSingle();
  if (!account?.access_token || account.status !== 'active') {
    return fail('unreadable', 'Compte social déconnecté : vérification impossible');
  }

  let items: MediaItem[] = [];
  try {
    const media = await graph(`${String(asset.account_id)}/media`, {
      fields: 'id,caption,permalink,media_type,timestamp',
      limit: '25',
      access_token: account.access_token as string,
    });
    items = (media?.data ?? []) as MediaItem[];
  } catch (e) {
    return fail('unreadable', `API Meta injoignable : ${(e as Error).message}`);
  }

  const publishedAt = order.published_at ? new Date(order.published_at) : null;
  const needles = mentionNeedle(order);
  const candidates = publishedAt
    ? items.filter((m) => (m.timestamp ? new Date(m.timestamp).getTime() >= publishedAt.getTime() - 86_400_000 : true))
    : items;

  const match = candidates.find((m) => {
    const caption = (m.caption ?? '').toLowerCase();
    return needles.some((n) => caption.includes(n));
  });

  let result: SocialCheckResult;
  if (!match) {
    result = fail('not_published', 'Aucune publication citant l\u2019acheteur trouvée sur le compte');
  } else {
    const caption = match.caption ?? '';
    const compliance = hasComplianceMention(caption, complianceTags);
    const ageDays = match.timestamp ? (now.getTime() - new Date(match.timestamp).getTime()) / 86_400_000 : 0;
    const insights = ageDays >= insightsDelay
      ? await fetchMediaInsights(match.id, account.access_token as string)
      : null;

    result = {
      order_id: orderId,
      verdict: compliance ? 'ok' : 'missing_mention',
      media_id: match.id,
      permalink: match.permalink ?? null,
      mention_found: true,
      compliance_found: compliance,
      insights,
      message: compliance
        ? 'Publication constatée, mention de conformité présente.'
        : 'Publication constatée, mais aucune mention de partenariat rémunéré : ajout requis sous 48 h.',
      checked_at: now.toISOString(),
    };
  }

  const nextDays = result.verdict === 'ok' ? (schedule.recurring ?? 30) : (schedule.first ?? 1);
  await supabaseAdmin.from('marketplace_verifications').insert({
    order_id: orderId,
    method: 'meta_api',
    verdict: result.verdict === 'ok' ? 'ok' : result.verdict === 'not_published' ? 'hard_broken' : 'soft_broken',
    link_present: result.mention_found,
    observed_anchor: order.anchor,
    leg_state: result.verdict === 'ok' ? 'verified' : 'pending',
    proof: {
      media_id: result.media_id,
      permalink: result.permalink,
      compliance_found: result.compliance_found,
      insights: result.insights,
      needles,
    },
    checked_at: result.checked_at,
    next_check_at: new Date(now.getTime() + nextDays * 86_400_000).toISOString(),
  });

  if (result.verdict === 'ok') {
    await supabaseAdmin
      .from('marketplace_orders')
      .update({
        status: 'verified',
        last_checked_at: result.checked_at,
        next_check_at: new Date(now.getTime() + nextDays * 86_400_000).toISOString(),
        consecutive_check_failures: 0,
      })
      .eq('id', orderId);
  } else {
    await supabaseAdmin
      .from('marketplace_orders')
      .update({
        last_checked_at: result.checked_at,
        next_check_at: new Date(now.getTime() + nextDays * 86_400_000).toISOString(),
      })
      .eq('id', orderId);
  }

  return result;
}
