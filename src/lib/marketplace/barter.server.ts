/**
 * barter.server.ts (L3.3)
 *
 * Routage du troc, entièrement déterministe :
 *   - la boucle `link_chain` (A → B → C → A) est cherchée EN PREMIER ;
 *   - `link_for_link` (réciprocité directe) n'est qu'un dernier recours :
 *     décote versionnée, jambe retour différée, quota trimestriel par paire ;
 *   - toute réciprocité non déclarée entre deux comptes est signalée.
 *
 * Aucune constante en dur : tout vient de `marketplace_pricing_constants`.
 */

import { loadConstants, num, type MarketplaceConstants } from './constants.server';
import type { TradeType } from './orderTypes';

type Sb = { from: (table: string) => any };

export interface BarterRoute {
  trade_type: TradeType;
  /** Domaines de la boucle, dans l'ordre du flux de valeur. */
  loop: string[];
  /** Nombre de jambes à publier. */
  legs: number;
  publish_after: string | null;
  reciprocity_quarter: string | null;
  cycle_check_verdict: string;
  reasons: string[];
}

/** Trimestre civil de réciprocité, format `2026-Q3`. */
export function reciprocityQuarter(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/** Choix pur : la boucle longue primes toujours sur la réciprocité directe. */
export function chooseTradeType(
  candidates: { loop: string[] }[],
  minLoopLength: number,
): { trade_type: TradeType; loop: string[] } | null {
  const chain = candidates.find((c) => c.loop.length >= minLoopLength);
  if (chain) return { trade_type: 'link_chain', loop: chain.loop };
  const direct = candidates.find((c) => c.loop.length === 2);
  if (direct) return { trade_type: 'link_for_link', loop: direct.loop };
  return null;
}

interface RouteInput {
  buyerUserId: string;
  buyerDomain: string;
  sellerUserId: string;
  sellerDomain: string;
}

/** Domaines des besoins ouverts d'un compte. */
async function openNeedDomains(sb: Sb, userId: string): Promise<string[]> {
  const { data } = await sb
    .from('marketplace_needs')
    .select('domain, status')
    .eq('user_id', userId)
    .neq('status', 'closed')
    .limit(200);
  return Array.from(new Set(((data ?? []) as { domain: string }[]).map((r) => r.domain).filter(Boolean)));
}

/** Domaines mis en vente et vérifiés d'un compte. */
async function sellableDomains(sb: Sb, userId: string): Promise<string[]> {
  const { data } = await sb
    .from('marketplace_link_assets')
    .select('domain, opted_in, ownership_status')
    .eq('user_id', userId)
    .eq('opted_in', true)
    .eq('ownership_status', 'verified')
    .limit(500);
  return Array.from(new Set(((data ?? []) as { domain: string }[]).map((r) => r.domain).filter(Boolean)));
}

/**
 * Cherche la meilleure route de troc entre l'acheteur et le vendeur.
 * Retourne `null` quand aucun troc n'est possible : la commande doit alors
 * se régler en euros ou en crédits.
 */
export async function findBarterRoute(input: RouteInput): Promise<BarterRoute | null> {
  const constants = await loadConstants();
  return findBarterRouteWith(input, constants);
}

export async function findBarterRouteWith(
  input: RouteInput,
  constants: MarketplaceConstants,
): Promise<BarterRoute | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const sb = supabaseAdmin as unknown as Sb;

  const minLoop = num(constants, 'link_chain_min_loop_length');
  const reasons: string[] = [];

  const buyerSells = await sellableDomains(sb, input.buyerUserId);
  const sellerNeeds = await openNeedDomains(sb, input.sellerUserId);

  const candidates: { loop: string[] }[] = [];

  // 1. Boucle à trois : le vendeur reçoit d'un tiers, ce tiers reçoit de l'acheteur.
  const { data: thirdAssets } = await sb
    .from('marketplace_link_assets')
    .select('user_id, domain, opted_in, ownership_status')
    .eq('opted_in', true)
    .eq('ownership_status', 'verified')
    .limit(1000);

  const byThird = new Map<string, Set<string>>();
  for (const row of (thirdAssets ?? []) as { user_id: string; domain: string }[]) {
    if (row.user_id === input.buyerUserId || row.user_id === input.sellerUserId) continue;
    const set = byThird.get(row.user_id) ?? new Set<string>();
    set.add(row.domain);
    byThird.set(row.user_id, set);
  }

  for (const [thirdId, domains] of byThird) {
    const servesSeller = [...domains].find((d) => sellerNeeds.includes(d));
    if (!servesSeller) continue;
    const thirdNeeds = await openNeedDomains(sb, thirdId);
    const servedByBuyer = buyerSells.find((d) => thirdNeeds.includes(d));
    if (!servedByBuyer) continue;
    candidates.push({ loop: [input.buyerDomain, input.sellerDomain, servesSeller] });
    break; // une seule boucle suffit : la première trouvée est déterministe (ordre stable).
  }

  // 2. Réciprocité directe, dernier recours.
  if (sellerNeeds.some((d) => buyerSells.includes(d))) {
    candidates.push({ loop: [input.buyerDomain, input.sellerDomain] });
  }

  const chosen = chooseTradeType(candidates, minLoop);
  if (!chosen) return null;

  const quarter = reciprocityQuarter(new Date());

  if (chosen.trade_type === 'link_for_link') {
    const quota = num(constants, 'link_for_link_quarter_quota');
    const used = await countDirectReciprocity(sb, input.buyerUserId, input.sellerUserId, quarter);
    if (used >= quota) {
      reasons.push(
        `Quota de réciprocité directe atteint pour ${quarter} (${used}/${quota}) : passez par une boucle ou un règlement`,
      );
      return null;
    }
    reasons.push(
      `Réciprocité directe en dernier recours : valeur décotée de ${Math.round((1 - num(constants, 'link_for_link_discount')) * 100)} %`,
    );
  } else {
    reasons.push(`Boucle de ${chosen.loop.length} domaines : aucune réciprocité directe, autorité mieux répartie`);
  }

  const delayDays =
    chosen.trade_type === 'link_for_link'
      ? num(constants, 'link_for_link_delay_days')
      : num(constants, 'link_chain_leg_delay_days');

  const verdict = await detectUndeclaredCycle(sb, input.buyerUserId, input.sellerUserId);
  if (verdict !== 'clean') reasons.push(verdict);

  return {
    trade_type: chosen.trade_type,
    loop: chosen.loop,
    legs: chosen.loop.length,
    publish_after: new Date(Date.now() + delayDays * 86_400_000).toISOString(),
    reciprocity_quarter: chosen.trade_type === 'link_for_link' ? quarter : null,
    cycle_check_verdict: verdict,
    reasons,
  };
}

/** Jambes de réciprocité directe déjà consommées sur le trimestre par la paire. */
export async function countDirectReciprocity(
  sb: Sb,
  userA: string,
  userB: string,
  quarter: string,
): Promise<number> {
  const { data } = await sb
    .from('marketplace_exchanges')
    .select('id, giver_id, receiver_id, trade_type, reciprocity_quarter')
    .eq('trade_type', 'link_for_link')
    .eq('reciprocity_quarter', quarter)
    .limit(200);

  return ((data ?? []) as { giver_id: string; receiver_id: string }[]).filter(
    (r) =>
      (r.giver_id === userA && r.receiver_id === userB) || (r.giver_id === userB && r.receiver_id === userA),
  ).length;
}

/**
 * Réciprocité non déclarée : deux commandes en sens inverse entre les mêmes
 * comptes, hors troc explicite. On ne bloque pas — on trace pour l'arbitrage.
 */
export async function detectUndeclaredCycle(sb: Sb, buyerId: string, sellerId: string): Promise<string> {
  const { data } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id, deal_type, status, created_at')
    .eq('buyer_id', sellerId)
    .eq('seller_id', buyerId)
    .in('status', ['frozen', 'pending', 'published', 'verified', 'maintained'])
    .limit(20);

  const reverse = ((data ?? []) as { deal_type: string }[]).filter((o) => o.deal_type !== 'barter');
  if (reverse.length === 0) return 'clean';
  return `Réciprocité non déclarée détectée : ${reverse.length} commande(s) en sens inverse hors troc`;
}
