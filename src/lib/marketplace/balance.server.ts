/**
 * balance.server.ts (L4.5)
 *
 * Balance d'autorité long terme et file de priorité d'achat (§4.5).
 *
 * Chaque jambe livrée crée un événement signé : céder de l'autorité (un lien
 * sortant) débite, en recevoir crédite. La valeur s'amortit linéairement sur
 * 24 mois : un troc ancien ne pèse plus dans la priorité d'aujourd'hui.
 *
 * La file d'achat classe les besoins par déficit d'autorité amorti, gravité du
 * besoin diagnostiqué et ancienneté du besoin non servi. Elle ne réserve jamais
 * qu'un emplacement à la fois par besoin, pour une durée bornée.
 *
 * 100 % déterministe : aucun appel LLM.
 */

import { loadConstants, num, type MarketplaceConstants } from './constants.server';

export interface BalanceEventInput {
  user_id: string;
  site_domain: string;
  order_id: string;
  /** `given` : le site a cédé de l'autorité. `received` : il en a reçu. */
  direction: 'given' | 'received';
  currency_kind: 'link' | 'story' | 'linkedin';
  trade_type: string | null;
  leg: string | null;
  value_cents: number;
  reciprocal_discount?: number;
}

/** Valeur résiduelle d'un événement après amortissement linéaire. */
export function amortizedValue(valueCents: number, occurredAt: Date, now: Date, months: number): number {
  const elapsed = (now.getTime() - occurredAt.getTime()) / (30 * 86_400_000);
  const remaining = Math.max(0, 1 - elapsed / Math.max(1, months));
  return Math.round(valueCents * remaining);
}

export interface SiteBalance {
  site_domain: string;
  authority_balance_cents: number;
  visibility_balance_cents: number;
  authority_given_cents: number;
  authority_received_cents: number;
  legs_count: number;
  can_sell_link: boolean;
  buyer_priority_score: number;
}

interface EventRow {
  direction: string;
  currency_kind: string;
  value_cents: number | null;
  occurred_at: string;
  reversal_of: string | null;
}

export function computeBalanceFromEvents(rows: EventRow[], now: Date, months: number): Omit<SiteBalance, 'site_domain'> {
  let givenAuthority = 0;
  let receivedAuthority = 0;
  let givenVisibility = 0;
  let receivedVisibility = 0;

  for (const row of rows) {
    const value = amortizedValue(row.value_cents ?? 0, new Date(row.occurred_at), now, months);
    const isAuthority = row.currency_kind === 'link';
    if (row.direction === 'given') {
      if (isAuthority) givenAuthority += value;
      else givenVisibility += value;
    } else {
      if (isAuthority) receivedAuthority += value;
      else receivedVisibility += value;
    }
  }

  const authorityBalance = receivedAuthority - givenAuthority;
  const visibilityBalance = receivedVisibility - givenVisibility;

  return {
    authority_balance_cents: authorityBalance,
    visibility_balance_cents: visibilityBalance,
    authority_given_cents: givenAuthority,
    authority_received_cents: receivedAuthority,
    legs_count: rows.length,
    // Un site déjà lourdement déficitaire en autorité ne doit plus en céder.
    can_sell_link: authorityBalance > -25_000,
    buyer_priority_score: Math.max(0, Math.round(-authorityBalance / 100)),
  };
}

/** Enregistre une jambe livrée dans la balance puis recalcule le site. */
export async function recordBalanceEvent(input: BalanceEventInput, constants?: MarketplaceConstants): Promise<void> {
  const c = constants ?? (await loadConstants());
  const months = num(c, 'balance_amortization_months');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  await supabaseAdmin.from('marketplace_balance_events').insert({
    user_id: input.user_id,
    site_domain: input.site_domain,
    order_id: input.order_id,
    order_source: 'marketplace',
    direction: input.direction,
    currency_kind: input.currency_kind,
    trade_type: input.trade_type,
    leg: input.leg,
    value_cents: input.value_cents,
    reciprocal_discount: input.reciprocal_discount ?? 1,
    amortization_months: months,
    occurred_at: new Date().toISOString(),
  } as never);

  await recomputeSiteBalance(input.site_domain, input.user_id, c);
}

/**
 * Contre-passe la part remboursée d'une commande : symétrie des événements
 * d'origine, sans jamais supprimer l'historique.
 */
export async function reverseBalanceForOrder(
  orderId: string,
  ratio: number,
  constants?: MarketplaceConstants,
): Promise<void> {
  if (ratio <= 0) return;
  const c = constants ?? (await loadConstants());
  const months = num(c, 'balance_amortization_months');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data } = await supabaseAdmin
    .from('marketplace_balance_events')
    .select('id, user_id, site_domain, direction, currency_kind, trade_type, leg, value_cents')
    .eq('order_id', orderId)
    .is('reversal_of', null);

  const events = (data ?? []) as unknown as {
    id: string;
    user_id: string;
    site_domain: string;
    direction: string;
    currency_kind: string;
    trade_type: string | null;
    leg: string | null;
    value_cents: number | null;
  }[];

  for (const event of events) {
    const amount = Math.round((event.value_cents ?? 0) * Math.min(1, ratio));
    if (amount <= 0) continue;
    await supabaseAdmin.from('marketplace_balance_events').insert({
      user_id: event.user_id,
      site_domain: event.site_domain,
      order_id: orderId,
      order_source: 'marketplace',
      direction: event.direction === 'given' ? 'received' : 'given',
      currency_kind: event.currency_kind,
      trade_type: event.trade_type,
      leg: event.leg,
      value_cents: amount,
      amortization_months: months,
      occurred_at: new Date().toISOString(),
      reversal_of: event.id,
      metadata: { reason: 'lien rompu — contre-passation au prorata' },
    } as never);
  }

  const domains = [...new Set(events.map((e) => `${e.site_domain}|${e.user_id}`))];
  for (const key of domains) {
    const [domain, userId] = key.split('|');
    await recomputeSiteBalance(domain, userId, c);
  }
}

/** Recalcule la balance amortie d'un site et la persiste. */
export async function recomputeSiteBalance(
  siteDomain: string,
  userId: string,
  constants?: MarketplaceConstants,
): Promise<SiteBalance> {
  const c = constants ?? (await loadConstants());
  const months = num(c, 'balance_amortization_months');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data, error } = await supabaseAdmin
    .from('marketplace_balance_events')
    .select('direction, currency_kind, value_cents, occurred_at, reversal_of')
    .eq('site_domain', siteDomain);
  if (error) throw new Error(`Balance illisible : ${error.message}`);

  const computed = computeBalanceFromEvents((data ?? []) as unknown as EventRow[], new Date(), months);
  const row: SiteBalance = { site_domain: siteDomain, ...computed };

  await supabaseAdmin.from('marketplace_site_balances').upsert(
    {
      site_domain: siteDomain,
      user_id: userId,
      ...computed,
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'site_domain' },
  );

  return row;
}

export interface QueueEntry {
  user_id: string;
  site_domain: string;
  need_id: string;
  need_score: number;
  deficit_cede_cents: number;
  priority_score: number;
  unserved_since: string | null;
}

/**
 * Score de priorité d'achat : le déficit d'autorité amorti pèse le plus, la
 * gravité du besoin ensuite, l'ancienneté du besoin non servi en appoint.
 */
export function computePriority(params: {
  deficit_cents: number;
  need_score: number;
  unserved_days: number;
  unserved_threshold_days: number;
}): number {
  const deficitPart = Math.min(100, params.deficit_cents / 500);
  const needPart = Math.min(100, params.need_score);
  const agePart = Math.min(100, (params.unserved_days / Math.max(1, params.unserved_threshold_days)) * 100);
  return Math.round(deficitPart * 0.5 + needPart * 0.35 + agePart * 0.15);
}

/** Reconstruit la file d'achat d'un utilisateur à partir de ses besoins ouverts. */
export async function refreshBuyQueue(userId: string, constants?: MarketplaceConstants): Promise<QueueEntry[]> {
  const c = constants ?? (await loadConstants());
  const months = num(c, 'balance_amortization_months');
  const unservedThreshold = num(c, 'queue_unserved_days');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data: needsData, error } = await supabaseAdmin
    .from('marketplace_needs')
    .select('id, user_id, domain, need_score, status, created_at')
    .eq('user_id', userId)
    .eq('status', 'open');
  if (error) throw new Error(`Besoins illisibles : ${error.message}`);

  const needs = (needsData ?? []) as unknown as {
    id: string;
    domain: string;
    need_score: number | null;
    created_at: string;
  }[];
  if (needs.length === 0) return [];

  const now = new Date();
  const balances = new Map<string, number>();
  for (const domain of new Set(needs.map((n) => n.domain))) {
    const { data: events } = await supabaseAdmin
      .from('marketplace_balance_events')
      .select('direction, currency_kind, value_cents, occurred_at, reversal_of')
      .eq('site_domain', domain);
    const computed = computeBalanceFromEvents((events ?? []) as unknown as EventRow[], now, months);
    balances.set(domain, Math.max(0, -computed.authority_balance_cents));
  }

  const entries: QueueEntry[] = needs.map((need) => {
    const deficit = balances.get(need.domain) ?? 0;
    const unservedDays = (now.getTime() - new Date(need.created_at).getTime()) / 86_400_000;
    return {
      user_id: userId,
      site_domain: need.domain,
      need_id: need.id,
      need_score: need.need_score ?? 0,
      deficit_cede_cents: deficit,
      priority_score: computePriority({
        deficit_cents: deficit,
        need_score: need.need_score ?? 0,
        unserved_days: unservedDays,
        unserved_threshold_days: unservedThreshold,
      }),
      unserved_since: need.created_at,
    };
  });

  for (const entry of entries) {
    await supabaseAdmin.from('marketplace_link_queue').upsert(
      {
        ...entry,
        status: 'queued',
        computed_at: now.toISOString(),
        updated_at: now.toISOString(),
      } as never,
      { onConflict: 'site_domain,need_id' },
    );
  }

  return entries.sort((a, b) => b.priority_score - a.priority_score);
}

/** File d'achat lisible par son propriétaire (RLS côté client authentifié). */
export async function listBuyQueue(
  sb: { from: (t: string) => any },
  userId: string,
): Promise<QueueEntry[]> {
  const { data, error } = await sb
    .from('marketplace_link_queue')
    .select('user_id, site_domain, need_id, need_score, deficit_cede_cents, priority_score, unserved_since')
    .eq('user_id', userId)
    .eq('status', 'queued')
    .order('priority_score', { ascending: false })
    .limit(50);
  if (error) throw new Error(`File d'achat illisible : ${error.message}`);
  return (data ?? []) as QueueEntry[];
}

export interface SiteBalanceRow extends SiteBalance {
  computed_at: string | null;
}

/**
 * Balances lisibles par leur propriétaire (L5.8) — aucun recalcul ici : on
 * relit la table persistée par `recomputeSiteBalance`, seule source de vérité.
 */
export async function listSiteBalances(
  sb: { from: (t: string) => any },
  userId: string,
): Promise<SiteBalanceRow[]> {
  const { data, error } = await sb
    .from('marketplace_site_balances')
    .select(
      'site_domain, authority_balance_cents, visibility_balance_cents, authority_given_cents, authority_received_cents, legs_count, can_sell_link, buyer_priority_score, computed_at',
    )
    .eq('user_id', userId)
    .order('authority_balance_cents', { ascending: true })
    .limit(50);
  if (error) throw new Error(`Balances illisibles : ${error.message}`);
  return (data ?? []) as SiteBalanceRow[];
}
