/**
 * disputes.server.ts (L3.8)
 *
 * Arbitrage humain : accusé de réception sous `dispute_ack_hours` ouvrées,
 * décision sous `dispute_sla_days` jours ouvrés, une seule contestation.
 *
 * Invariant : aucune décision ne crée de commission ni ne modifie un prix figé.
 * Les seules issues sont l'exécution forcée, l'annulation sans frais, le
 * remboursement au prorata ou le maintien de la commande.
 */

import { loadConstants, num } from './constants.server';
import { issueRefundCredit } from './invoices.server';
import type { OrderStatus } from './orderTypes';

type Sb = { from: (table: string) => any };

export type DisputeOutcome = 'upheld' | 'cancelled_no_fee' | 'prorata_refund' | 'forced_execution';
export type DisputeReason =
  | 'not_published'
  | 'attribute_mismatch'
  | 'anchor_mismatch'
  | 'removed_early'
  | 'content_refused'
  | 'payment'
  | 'other';

export interface DisputeRow {
  id: string;
  order_id: string;
  opened_by: string;
  reason: DisputeReason;
  detail: string | null;
  status: string;
  acknowledged_at: string | null;
  due_at: string | null;
  decision: string | null;
  decision_outcome: DisputeOutcome | null;
  decision_notes: string | null;
  appeal_of: string | null;
  created_at: string;
}

/** Ajoute des jours ouvrés (samedi et dimanche exclus). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

/** Ajoute des heures ouvrées, en sautant les week-ends. */
export function addBusinessHours(from: Date, hours: number): Date {
  const d = new Date(from);
  let left = hours;
  while (left > 0) {
    d.setUTCHours(d.getUTCHours() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

/** Part non servie d'un engagement, base du remboursement au prorata. */
export function prorataRefundCents(params: {
  priceCents: number;
  publishedAt: string | null;
  commitmentEndsAt: string | null;
  brokenAt: Date;
}): number {
  if (!params.publishedAt || !params.commitmentEndsAt) return params.priceCents;
  const start = new Date(params.publishedAt).getTime();
  const end = new Date(params.commitmentEndsAt).getTime();
  if (end <= start) return 0;
  const served = Math.min(Math.max(params.brokenAt.getTime() - start, 0), end - start);
  const remaining = 1 - served / (end - start);
  return Math.round(params.priceCents * remaining);
}

/** Ouverture d'un litige par l'une des deux parties. */
export async function openDispute(
  sb: Sb,
  params: { userId: string; orderId: string; reason: DisputeReason; detail?: string; appealOf?: string | null },
): Promise<{ dispute_id: string; due_at: string; acknowledge_before: string }> {
  const constants = await loadConstants();

  const { data: order, error } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id, status')
    .eq('id', params.orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!order || (order.buyer_id !== params.userId && order.seller_id !== params.userId)) {
    throw new Error('Commande introuvable pour ce compte');
  }

  const { data: existing } = await sb
    .from('marketplace_disputes')
    .select('id, status, appeal_of')
    .eq('order_id', params.orderId);
  const rows = (existing ?? []) as { id: string; status: string; appeal_of: string | null }[];

  if (rows.some((d) => ['open', 'acknowledged'].includes(d.status))) {
    throw new Error('Un litige est déjà en cours sur cette commande');
  }
  if (params.appealOf) {
    if (!rows.some((d) => d.id === params.appealOf && d.status === 'resolved')) {
      throw new Error('Seule une décision rendue peut être contestée');
    }
    if (rows.some((d) => d.appeal_of)) throw new Error('Une seule contestation est admise par commande');
  }

  const now = new Date();
  const dueAt = addBusinessDays(now, num(constants, 'dispute_sla_days'));
  const ackBefore = addBusinessHours(now, num(constants, 'dispute_ack_hours'));

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error: insError } = await supabaseAdmin
    .from('marketplace_disputes')
    .insert({
      order_id: params.orderId,
      opened_by: params.userId,
      reason: params.reason,
      detail: params.detail ?? null,
      status: params.appealOf ? 'appealed' : 'open',
      due_at: dueAt.toISOString(),
      appeal_of: params.appealOf ?? null,
    })
    .select('id')
    .single();
  if (insError) throw new Error(`Litige non ouvert : ${insError.message}`);

  return { dispute_id: data.id as string, due_at: dueAt.toISOString(), acknowledge_before: ackBefore.toISOString() };
}

/** Accusé de réception (administrateur). */
export async function acknowledgeDispute(params: { adminId: string; disputeId: string }): Promise<{ acknowledged_at: string }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('marketplace_disputes')
    .update({ status: 'acknowledged', acknowledged_at: at })
    .eq('id', params.disputeId)
    .in('status', ['open', 'appealed']);
  if (error) throw new Error(`Accusé de réception refusé : ${error.message}`);
  void params.adminId;
  return { acknowledged_at: at };
}

/**
 * Décision d'arbitrage. Le prix figé n'est jamais modifié : seuls le statut de
 * la commande et, le cas échéant, un avoir au prorata sont produits.
 */
export async function decideDispute(params: {
  adminId: string;
  disputeId: string;
  decision: 'buyer' | 'seller' | 'split' | 'void';
  outcome: DisputeOutcome;
  notes: string;
}): Promise<{ order_status: string; refund_cents: number }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data: dispute, error } = await supabaseAdmin
    .from('marketplace_disputes')
    .select('id, order_id, status')
    .eq('id', params.disputeId)
    .maybeSingle();
  if (error) throw new Error(`Litige illisible : ${error.message}`);
  if (!dispute) throw new Error('Litige introuvable');
  if (dispute.status === 'resolved') throw new Error('Litige déjà tranché');

  const { data: order } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id, price_cents, published_at, commitment_ends_at, status')
    .eq('id', dispute.order_id)
    .maybeSingle();
  if (!order) throw new Error('Commande introuvable');

  let refund = 0;
  let orderStatus = order.status as string;

  if (params.outcome === 'prorata_refund') {
    refund = prorataRefundCents({
      priceCents: Number(order.price_cents ?? 0),
      publishedAt: order.published_at as string | null,
      commitmentEndsAt: order.commitment_ends_at as string | null,
      brokenAt: new Date(),
    });
    orderStatus = 'refunded';
    await issueRefundCredit({ orderId: order.id as string, amountCents: refund, reason: params.notes });
  } else if (params.outcome === 'cancelled_no_fee') {
    orderStatus = 'cancelled';
  } else if (params.outcome === 'forced_execution') {
    orderStatus = 'pending';
  } else {
    orderStatus = 'resolved';
  }

  const { error: upDispute } = await supabaseAdmin
    .from('marketplace_disputes')
    .update({
      status: 'resolved',
      decision: params.decision,
      decision_outcome: params.outcome,
      decision_notes: params.notes,
      decided_by: params.adminId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', params.disputeId);
  if (upDispute) throw new Error(`Décision non enregistrée : ${upDispute.message}`);

  const { error: upOrder } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: orderStatus })
    .eq('id', order.id);
  if (upOrder) throw new Error(`Statut de commande non mis à jour : ${upOrder.message}`);

  return { order_status: orderStatus, refund_cents: refund };
}

/** Litiges visibles par l'utilisateur courant (RLS par partie). */
export async function listDisputes(sb: Sb, orderId?: string): Promise<DisputeRow[]> {
  let query = sb
    .from('marketplace_disputes')
    .select(
      'id, order_id, opened_by, reason, detail, status, acknowledged_at, due_at, decision, decision_outcome, decision_notes, appeal_of, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) throw new Error(`Litiges illisibles : ${error.message}`);
  return (data ?? []) as DisputeRow[];
}
