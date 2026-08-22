/**
 * refunds.server.ts (L4.4)
 *
 * Remboursement au prorata d'une jambe rompue (§2.13).
 *
 * Le prix couvre une durée d'engagement de maintien. Une rupture constatée et
 * non remise en conformité rembourse la fraction non servie :
 *   refund = prix × (mois restants / mois d'engagement)
 * La commission Crawlers suit la même proportion : la plateforme ne conserve
 * pas de commission sur une période non servie.
 *
 * Le remboursement s'effectue sur le support de paiement de l'acheteur, et la
 * balance d'autorité est contre-passée de la fraction remboursée : un lien
 * disparu ne doit pas créer de crédit d'autorité durable.
 */

import { loadConstants, type MarketplaceConstants } from './constants.server';

export interface RefundResult {
  order_id: string;
  refund_cents: number;
  commission_refund_cents: number;
  months_served: number;
  months_remaining: number;
  support: 'cash' | 'credits';
  notes: string[];
}

export function computeProrataRefund(params: {
  price_cents: number;
  commission_cents: number;
  commitment_months: number;
  published_at: Date;
  broken_at: Date;
}): { refund_cents: number; commission_refund_cents: number; months_served: number; months_remaining: number } {
  const months = Math.max(1, params.commitment_months);
  const servedMonths = Math.max(
    0,
    (params.broken_at.getTime() - params.published_at.getTime()) / (30 * 86_400_000),
  );
  const served = Math.min(months, servedMonths);
  const remaining = Math.max(0, months - served);
  const ratio = remaining / months;

  return {
    refund_cents: Math.round(params.price_cents * ratio),
    commission_refund_cents: Math.round(params.commission_cents * ratio),
    months_served: Math.round(served * 10) / 10,
    months_remaining: Math.round(remaining * 10) / 10,
  };
}

/**
 * Rembourse une commande rompue au-delà de la fenêtre de remise en conformité :
 * écrit le mouvement de remboursement, contre-passe la balance et clôture.
 */
export async function refundBrokenLeg(
  orderId: string,
  now = new Date(),
  constants?: MarketplaceConstants,
): Promise<RefundResult> {
  const c = constants ?? (await loadConstants());
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select(
      'id, buyer_id, seller_id, buyer_domain, seller_domain, price_cents, commission_cents, commitment_months, published_at, broken_since, buyer_payment_support, deal_type',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!data) throw new Error('Commande introuvable');

  const order = data as unknown as {
    buyer_id: string;
    seller_domain: string;
    price_cents: number | null;
    commission_cents: number | null;
    commitment_months: number | null;
    published_at: string | null;
    broken_since: string | null;
    buyer_payment_support: string | null;
    deal_type: string;
  };

  const publishedAt = order.published_at ? new Date(order.published_at) : now;
  const brokenAt = order.broken_since ? new Date(order.broken_since) : now;

  const prorata = computeProrataRefund({
    price_cents: order.price_cents ?? 0,
    commission_cents: order.commission_cents ?? 0,
    commitment_months: order.commitment_months ?? 12,
    published_at: publishedAt,
    broken_at: brokenAt,
  });

  const support: 'cash' | 'credits' = order.buyer_payment_support === 'credits' ? 'credits' : 'cash';
  const notes = [
    `Engagement de ${order.commitment_months ?? 12} mois, ${prorata.months_served} mois servis.`,
    `Remboursement de la fraction non servie : ${(prorata.refund_cents / 100).toFixed(2)} €.`,
    `Commission Crawlers restituée au même prorata : ${(prorata.commission_refund_cents / 100).toFixed(2)} €.`,
  ];

  if (prorata.refund_cents > 0) {
    await supabaseAdmin.from('marketplace_payouts').insert({
      order_id: orderId,
      beneficiary_id: order.buyer_id,
      kind: 'refund',
      support,
      amount_cents: support === 'cash' ? prorata.refund_cents : 0,
      amount_credits: support === 'credits' ? prorata.refund_cents : null,
      status: 'pending',
      occurred_at: now.toISOString(),
    } as never);
  }

  await supabaseAdmin
    .from('marketplace_orders')
    .update({
      status: 'refunded',
      refund_cents: prorata.refund_cents,
      refund_support: support,
      remediation_due_at: null,
      next_check_at: null,
    })
    .eq('id', orderId);

  const { reverseBalanceForOrder } = await import('./balance.server');
  await reverseBalanceForOrder(orderId, prorata.refund_cents / Math.max(1, order.price_cents ?? 1), c);

  return {
    order_id: orderId,
    refund_cents: prorata.refund_cents,
    commission_refund_cents: prorata.commission_refund_cents,
    months_served: prorata.months_served,
    months_remaining: prorata.months_remaining,
    support,
    notes,
  };
}
