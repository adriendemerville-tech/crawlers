/**
 * orders.server.ts (L3.2 / L3.4)
 *
 * Cycle de commande : gel des conditions, acceptation vendeur, déclaration de
 * publication. Toutes les écritures passent par le service role après contrôle
 * explicite de l'appelant : jamais de `user_id` fourni par le client.
 *
 * Le gel recalcule tout côté serveur (prix, attribut, plafonds, garde-fous
 * acheteur) : la valeur affichée par le front n'est jamais reprise telle quelle.
 */

import { loadConstants, num } from './constants.server';
import { computeEconomicsWith, legPublishDelayDays } from './commission.server';
import { evaluateCapsWith } from './caps.server';
import { decideAttributeWith } from './attribute.server';
import { evaluateBuyerLimits } from './buyerLimits.server';
import type { CurrencyKind, DealType, OrderEconomics, OrderRow, TradeType } from './orderTypes';
import type { NeedObjective } from './matchTypes';
import type { PriceTier } from './types';

type Sb = { from: (table: string) => any };

export interface FreezeInput {
  userId: string;
  matchId: string;
  anchor: string;
  anchorKind: 'brand' | 'exact' | 'semi' | 'url' | 'natural';
  dealType: DealType;
  commissionSupport?: 'cash' | 'credits';
  tradeType?: TradeType;
  currencyKind?: CurrencyKind;
  counterValueCents?: number;
  /** Le vendeur peut rester en sponsored : le veto est lu sur l'emplacement. */
}

interface MatchRecord {
  id: string;
  need_id: string;
  asset_id: string;
  buyer_user_id: string;
  buyer_domain: string;
  seller_user_id: string;
  seller_domain: string;
  price_cents: number;
  price_tier: PriceTier | null;
  expires_at: string;
}

/** Gèle une commande depuis un appariement proposé (§4.3). */
export async function freezeOrder(
  sb: Sb,
  input: FreezeInput,
): Promise<{ order_id: string; economics: OrderEconomics; link_attribute: string; reasons: string[] }> {
  const constants = await loadConstants();
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  // 1. L'appariement doit appartenir à l'acheteur appelant et être encore valide.
  const { data: match, error: matchError } = await sb
    .from('marketplace_matches')
    .select(
      'id, need_id, asset_id, buyer_user_id, buyer_domain, seller_user_id, seller_domain, price_cents, price_tier, expires_at',
    )
    .eq('id', input.matchId)
    .maybeSingle();

  if (matchError) throw new Error(`Appariement illisible : ${matchError.message}`);
  if (!match || (match as MatchRecord).buyer_user_id !== input.userId) {
    throw new Error('Appariement introuvable pour ce compte');
  }
  const m = match as MatchRecord;
  if (new Date(m.expires_at).getTime() < Date.now()) {
    throw new Error('Appariement expiré : relancez le calcul avant de commander');
  }

  // 2. Garde-fous acheteur revalidés au moment du gel.
  const limits = await evaluateBuyerLimits(sb, input.userId);
  if (!limits.purchase_allowed) {
    throw new Error(limits.throttle_reason ?? 'Achat momentanément bloqué par les garde-fous de profil de lien');
  }

  // 3. Besoin confirmé : l'étape « Mon objectif » est bloquante.
  const { data: need, error: needError } = await sb
    .from('marketplace_needs')
    .select('id, target_url, authority_deficit, need_primary, need_objective, need_objective_source, need_objective_confirmed_at')
    .eq('id', m.need_id)
    .maybeSingle();
  if (needError) throw new Error(`Besoin illisible : ${needError.message}`);
  if (!need) throw new Error('Besoin introuvable');
  if (!need.need_objective_confirmed_at) {
    throw new Error("Confirmez d'abord votre objectif d'achat");
  }

  // 4. État vendeur relu en service role : plafonds et coût d'autorité.
  const { data: asset, error: assetError } = await supabaseAdmin
    .from('marketplace_link_assets')
    .select(
      'id, user_id, domain, url, opted_in, ownership_status, price_cents, price_tier, dofollow_sold_lifetime, insertions_12m, seller_veto_dofollow',
    )
    .eq('id', m.asset_id)
    .maybeSingle();
  if (assetError) throw new Error(`Emplacement illisible : ${assetError.message}`);
  if (!asset || !asset.opted_in || asset.ownership_status !== 'verified') {
    throw new Error("L'emplacement n'est plus disponible à la vente");
  }

  const { data: domainAssets } = await supabaseAdmin
    .from('marketplace_link_assets')
    .select('dofollow_sold_lifetime')
    .eq('user_id', asset.user_id)
    .eq('domain', asset.domain);
  const domainDofollow = ((domainAssets ?? []) as { dofollow_sold_lifetime: number }[]).reduce(
    (s, a) => s + (a.dofollow_sold_lifetime ?? 0),
    0,
  );

  const caps = evaluateCapsWith(
    {
      dofollow_page_lifetime_used: asset.dofollow_sold_lifetime ?? 0,
      dofollow_domain_12m_used: domainDofollow,
      insertions_page_12m_used: asset.insertions_12m ?? 0,
    },
    constants,
  );
  if (!caps.insertion_available) {
    throw new Error(caps.blocking_reason ?? "Plafond d'insertions atteint sur cette page");
  }

  const { data: risk } = await supabaseAdmin
    .from('marketplace_page_sell_risk')
    .select('sell_risk, risk_class, hard_exclusion_reason')
    .eq('user_id', asset.user_id)
    .eq('url', asset.url)
    .maybeSingle();
  if (!risk || risk.hard_exclusion_reason) {
    throw new Error(risk?.hard_exclusion_reason ?? "Coût d'autorité inconnu : emplacement écarté");
  }

  const objective = (need.need_objective ?? need.need_primary) as NeedObjective;
  const decision = decideAttributeWith(
    {
      buyer_objective:
        objective === 'geo' ? 'geo_visibility' : objective === 'trafic' ? 'traffic' : 'authority',
      buyer_authority_deficit: Number(need.authority_deficit ?? 0),
      placement: 'editorial',
      seller_sell_risk: Number(risk.sell_risk ?? 1),
      seller_tier: (asset.price_tier ?? 'P1') as PriceTier,
      caps,
      seller_veto_dofollow: Boolean(asset.seller_veto_dofollow),
    },
    constants,
  );

  // 5. Économie figée.
  const economics = computeEconomicsWith(
    {
      deal_type: input.dealType,
      price_cents: asset.price_cents ?? m.price_cents ?? 0,
      counter_value_cents: input.counterValueCents,
      trade_type: input.tradeType,
      currency_kind: input.currencyKind ?? 'link',
      commission_support: input.commissionSupport ?? 'cash',
    },
    constants,
  );

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('marketplace_orders')
    .insert({
      buyer_id: input.userId,
      seller_id: asset.user_id,
      buyer_domain: m.buyer_domain,
      seller_domain: asset.domain,
      asset_id: asset.id,
      asset_kind: 'link',
      need_id: m.need_id,
      match_id: m.id,
      target_url: need.target_url,
      anchor: input.anchor,
      anchor_kind: input.anchorKind,
      link_attribute: decision.attribute,
      need_attribute: decision.need_attribute,
      permit_attribute: decision.permit_attribute,
      need_objective: need.need_objective,
      need_objective_source: need.need_objective_source,
      need_objective_confirmed_at: need.need_objective_confirmed_at,
      attribute_basis: decision.attribute_basis as Record<string, never>,
      deal_type: input.dealType,
      price_cents: economics.price_cents,
      commission_cents: economics.commission_cents,
      commission_settlement: economics.commission_support,
      commission_support: economics.commission_support,
      buyer_payment_support: input.dealType,
      commission_credits: economics.commission_credits,
      credit_eur_rate_at_freeze: num(constants, 'credit_eur_rate'),
      soulte_cents: economics.soulte_cents,
      soulte_currency: economics.commission_support === 'credits' ? 'credits' : 'eur',
      soulte_payer_id: economics.soulte_cents === 0 ? null : input.userId,
      soulte_payee_id: economics.soulte_cents === 0 ? null : asset.user_id,
      commitment_months: economics.commitment_months,
      escrow_cents: input.dealType === 'barter' ? economics.commission_cents : economics.price_cents,
      status: 'frozen',
      constants_version: constants.version,
      frozen_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) throw new Error(`Commande non créée : ${insertError.message}`);

  await sb.from('marketplace_matches').update({ status: 'ordered' }).eq('id', m.id);

  const delay = legPublishDelayDays(input.tradeType, constants);
  if (delay > 0 && input.dealType === 'barter') {
    await supabaseAdmin.from('marketplace_exchanges').insert({
      order_id: inserted.id,
      exchange_id: inserted.id,
      leg_index: 1,
      giver_id: asset.user_id,
      receiver_id: input.userId,
      giver_domain: asset.domain,
      receiver_domain: m.buyer_domain,
      currency_kind: input.currencyKind ?? 'link',
      trade_type: input.tradeType ?? 'link_for_link',
      value_cents: economics.price_cents,
      publish_after: new Date(Date.now() + delay * 86_400_000).toISOString(),
      commission_payer_id: input.userId,
      commission_cents: economics.commission_cents,
    });
  }

  return {
    order_id: inserted.id as string,
    economics,
    link_attribute: decision.attribute,
    reasons: decision.reasons,
  };
}

/** Acceptation vendeur : la commande passe en attente de publication. */
export async function acceptOrder(sb: Sb, params: { userId: string; orderId: string }): Promise<{ status: string }> {
  const { data, error } = await sb
    .from('marketplace_orders')
    .select('id, seller_id, status')
    .eq('id', params.orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!data || data.seller_id !== params.userId) throw new Error('Commande introuvable pour ce compte');
  if (data.status !== 'frozen') throw new Error('Seule une commande aux conditions gelées peut être acceptée');

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error: upError } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: 'pending' })
    .eq('id', params.orderId);
  if (upError) throw new Error(`Acceptation refusée : ${upError.message}`);
  return { status: 'pending' };
}

/** Annulation avant publication, par l'une ou l'autre partie. */
export async function cancelOrder(
  sb: Sb,
  params: { userId: string; orderId: string; reason: string },
): Promise<{ status: string }> {
  const { data, error } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id, status, risk_flags')
    .eq('id', params.orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!data || (data.buyer_id !== params.userId && data.seller_id !== params.userId)) {
    throw new Error('Commande introuvable pour ce compte');
  }
  if (!['draft', 'frozen', 'pending'].includes(data.status)) {
    throw new Error('Une commande publiée ne peut plus être annulée : ouvrez un litige');
  }

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error: upError } = await supabaseAdmin
    .from('marketplace_orders')
    .update({
      status: 'cancelled',
      risk_flags: [...((data.risk_flags ?? []) as string[]), `cancelled:${params.reason.slice(0, 80)}`],
    })
    .eq('id', params.orderId);
  if (upError) throw new Error(`Annulation refusée : ${upError.message}`);
  return { status: 'cancelled' };
}

/** Déclaration de publication par le vendeur : ouvre la fenêtre de vérification (L4). */
export async function declarePublication(
  sb: Sb,
  params: { userId: string; orderId: string },
): Promise<{ status: string; commitment_ends_at: string }> {
  const { data, error } = await sb
    .from('marketplace_orders')
    .select('id, seller_id, status, commitment_months')
    .eq('id', params.orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!data || data.seller_id !== params.userId) throw new Error('Commande introuvable pour ce compte');
  if (data.status !== 'pending') throw new Error('La commande doit être acceptée avant publication');

  const publishedAt = new Date();
  const ends = new Date(publishedAt);
  ends.setMonth(ends.getMonth() + Number(data.commitment_months ?? 12));

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error: upError } = await supabaseAdmin
    .from('marketplace_orders')
    .update({
      status: 'published',
      published_at: publishedAt.toISOString(),
      commitment_ends_at: ends.toISOString(),
    })
    .eq('id', params.orderId);
  if (upError) throw new Error(`Déclaration refusée : ${upError.message}`);
  return { status: 'published', commitment_ends_at: ends.toISOString() };
}

/** Commandes des deux côtés pour l'utilisateur courant. */
export async function listOrders(sb: Sb, userId: string): Promise<OrderRow[]> {
  const { data, error } = await sb
    .from('marketplace_orders')
    .select(
      'id, buyer_id, seller_id, buyer_domain, seller_domain, target_url, anchor, link_attribute, need_objective, deal_type, price_cents, commission_cents, soulte_cents, commitment_months, status, published_at, commitment_ends_at, revision_rounds_used, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Commandes illisibles : ${error.message}`);

  return ((data ?? []) as any[]).map((o) => {
    const role: 'buyer' | 'seller' = o.buyer_id === userId ? 'buyer' : 'seller';
    return {
      id: o.id,
      role,
      counterpart_domain: role === 'buyer' ? o.seller_domain : o.buyer_domain,
      seller_url: null,
      // Le vendeur ne découvre la page cible qu'une fois la commande gelée.
      target_url: o.target_url,
      anchor: o.anchor,
      link_attribute: o.link_attribute,
      need_objective: o.need_objective,
      deal_type: o.deal_type,
      price_cents: o.price_cents ?? 0,
      commission_cents: o.commission_cents ?? 0,
      soulte_cents: o.soulte_cents ?? 0,
      commitment_months: o.commitment_months ?? 12,
      status: o.status,
      published_at: o.published_at,
      commitment_ends_at: o.commitment_ends_at,
      revision_rounds_used: o.revision_rounds_used ?? 0,
      created_at: o.created_at,
    };
  });
}
