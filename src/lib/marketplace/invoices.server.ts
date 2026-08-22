/**
 * invoices.server.ts (L3.5)
 *
 * Pièces comptables figées à l'émission :
 *   - commission Crawlers (facture de la plateforme au bénéficiaire de valeur) ;
 *   - auto-facturation vendeur → acheteur pour la jambe cash ;
 *   - soulte lorsqu'un écart de valeur subsiste ;
 *   - avoir en cas de remboursement.
 *
 * Série continue par mandant, numérotation sans trou, exigibilité déclenchée
 * par la première preuve de publication. Export DAC7 incluant les jambes en
 * troc et en crédits (§2.5.2).
 */

import { loadConstants, num, str, type MarketplaceConstants } from './constants.server';
import type { TaxStatus } from './types';

type Sb = { from: (table: string) => any };

export type InvoiceKind = 'commission' | 'self_billing' | 'soulte' | 'refund';

export interface IssuedInvoice {
  id: string;
  kind: InvoiceKind;
  series: string;
  number: number;
  amount_cents: number;
  vat_cents: number;
  vat_rule: string;
  recipient_id: string;
}

/** Numéro suivant d'une série : jamais de trou, jamais de réutilisation. */
export function nextInvoiceNumber(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

/** Règle de TVA appliquée, déterministe et auditable. */
export function vatFor(
  amountCents: number,
  profile: { tax_status: TaxStatus | null; country_code: string | null; vat_number: string | null } | null,
  c: MarketplaceConstants,
): { vat_cents: number; vat_rule: string } {
  const country = (profile?.country_code ?? 'FR').toUpperCase();
  if (country !== 'FR') {
    return { vat_cents: 0, vat_rule: 'autoliquidation hors France : TVA non collectée' };
  }
  if (profile?.tax_status === 'company_vat' && profile.vat_number) {
    const rate = num(c, 'vat_rate_fr');
    return { vat_cents: Math.round(amountCents * rate), vat_rule: `TVA France ${Math.round(rate * 100)} %` };
  }
  return { vat_cents: 0, vat_rule: 'franchise de TVA (statut non assujetti)' };
}

export function seriesFor(kind: InvoiceKind, date: Date, c: MarketplaceConstants): string {
  return `${str(c, 'invoice_series_prefix')}-${kind.toUpperCase()}-${date.getUTCFullYear()}`;
}

async function taxProfileOf(sb: Sb, userId: string) {
  const { data } = await sb
    .from('marketplace_tax_profiles')
    .select('tax_status, country_code, vat_number, legal_name')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

async function allocateNumber(sb: Sb, issuerId: string, series: string): Promise<number> {
  const { data } = await sb
    .from('marketplace_invoices')
    .select('number')
    .eq('issuer_id', issuerId)
    .eq('series', series)
    .order('number', { ascending: false })
    .limit(1);
  return nextInvoiceNumber(((data ?? []) as { number: number }[]).map((r) => r.number));
}

/**
 * Émet les pièces d'une commande dès la première preuve de publication.
 * Idempotent : une commande déjà facturée n'est pas refacturée.
 */
export async function issueInvoicesForOrder(orderId: string): Promise<IssuedInvoice[]> {
  const constants = await loadConstants();
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const sb = supabaseAdmin as unknown as Sb;

  const { data: order, error } = await sb
    .from('marketplace_orders')
    .select(
      'id, buyer_id, seller_id, deal_type, price_cents, commission_cents, commission_support, commission_credits, soulte_cents, soulte_payer_id, soulte_payee_id, credit_eur_rate_at_freeze, published_at, status, constants_version',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!order) throw new Error('Commande introuvable');
  if (!order.published_at) throw new Error("Aucune preuve de publication : facturation non exigible");

  const { data: already } = await sb.from('marketplace_invoices').select('id').eq('order_id', orderId).limit(1);
  if (already && already.length > 0) {
    const { data: rows } = await sb
      .from('marketplace_invoices')
      .select('id, kind, series, number, amount_cents, vat_cents, vat_rule, recipient_id')
      .eq('order_id', orderId);
    return (rows ?? []) as IssuedInvoice[];
  }

  const issuedAt = new Date();
  const sellerProfile = await taxProfileOf(sb, order.seller_id as string);
  const buyerProfile = await taxProfileOf(sb, order.buyer_id as string);
  const issued: IssuedInvoice[] = [];

  const push = async (payload: {
    kind: InvoiceKind;
    issuer_id: string;
    recipient_id: string;
    amount_cents: number;
    profile: Awaited<ReturnType<typeof taxProfileOf>>;
    leg_id?: string | null;
    dac7: boolean;
  }) => {
    if (payload.amount_cents <= 0) return;
    const series = seriesFor(payload.kind, issuedAt, constants);
    const number = await allocateNumber(sb, payload.issuer_id, series);
    const { vat_cents, vat_rule } = vatFor(payload.amount_cents, payload.profile as never, constants);

    const { data, error: insError } = await sb
      .from('marketplace_invoices')
      .insert({
        order_id: orderId,
        leg_id: payload.leg_id ?? null,
        kind: payload.kind,
        issuer_id: payload.issuer_id,
        recipient_id: payload.recipient_id,
        series,
        number,
        amount_cents: payload.amount_cents,
        vat_cents,
        vat_rule,
        credit_eur_rate: order.credit_eur_rate_at_freeze ?? num(constants, 'credit_eur_rate'),
        dac7_reportable: payload.dac7,
        snapshot: {
          deal_type: order.deal_type,
          price_cents: order.price_cents,
          commission_cents: order.commission_cents,
          commission_support: order.commission_support,
          commission_credits: order.commission_credits,
          soulte_cents: order.soulte_cents,
          constants_version: order.constants_version,
          published_at: order.published_at,
        },
        issued_at: issuedAt.toISOString(),
      })
      .select('id, kind, series, number, amount_cents, vat_cents, vat_rule, recipient_id')
      .single();
    if (insError) throw new Error(`Facture non émise : ${insError.message}`);
    issued.push(data as IssuedInvoice);
  };

  // 1. Commission : émise par la plateforme au bénéficiaire de valeur.
  const commissionPayer = order.deal_type === 'barter' ? (order.buyer_id as string) : (order.seller_id as string);
  await push({
    kind: 'commission',
    issuer_id: commissionPayer,
    recipient_id: commissionPayer,
    amount_cents: Number(order.commission_cents ?? 0),
    profile: commissionPayer === order.seller_id ? sellerProfile : buyerProfile,
    dac7: false,
  });

  // 2. Jambe cash : auto-facturation pour le compte du vendeur.
  if (order.deal_type !== 'barter') {
    await push({
      kind: 'self_billing',
      issuer_id: order.seller_id as string,
      recipient_id: order.buyer_id as string,
      amount_cents: Number(order.price_cents ?? 0),
      profile: sellerProfile,
      dac7: true,
    });
  }

  // 3. Soulte comblant l'écart de valeur du troc.
  if (Number(order.soulte_cents ?? 0) > 0 && order.soulte_payee_id) {
    await push({
      kind: 'soulte',
      issuer_id: order.soulte_payee_id as string,
      recipient_id: order.soulte_payer_id as string,
      amount_cents: Number(order.soulte_cents),
      profile: order.soulte_payee_id === order.seller_id ? sellerProfile : buyerProfile,
      dac7: true,
    });
  }

  return issued;
}

/** Avoir sur remboursement au prorata : ne crée ni commission ni prix nouveau. */
export async function issueRefundCredit(params: {
  orderId: string;
  amountCents: number;
  reason: string;
}): Promise<IssuedInvoice | null> {
  if (params.amountCents <= 0) return null;
  const constants = await loadConstants();
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const sb = supabaseAdmin as unknown as Sb;

  const { data: order } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id, credit_eur_rate_at_freeze')
    .eq('id', params.orderId)
    .maybeSingle();
  if (!order) throw new Error('Commande introuvable');

  const series = seriesFor('refund', new Date(), constants);
  const number = await allocateNumber(sb, order.seller_id as string, series);
  const { data, error } = await sb
    .from('marketplace_invoices')
    .insert({
      order_id: params.orderId,
      kind: 'refund',
      issuer_id: order.seller_id,
      recipient_id: order.buyer_id,
      series,
      number,
      amount_cents: -Math.abs(params.amountCents),
      vat_cents: 0,
      vat_rule: 'avoir : TVA régularisée sur la pièce initiale',
      credit_eur_rate: order.credit_eur_rate_at_freeze ?? num(constants, 'credit_eur_rate'),
      dac7_reportable: true,
      snapshot: { reason: params.reason },
      issued_at: new Date().toISOString(),
    })
    .select('id, kind, series, number, amount_cents, vat_cents, vat_rule, recipient_id')
    .single();
  if (error) throw new Error(`Avoir non émis : ${error.message}`);
  return data as IssuedInvoice;
}

export interface Dac7Line {
  seller_id: string;
  legal_name: string | null;
  country_code: string | null;
  transactions: number;
  gross_cents: number;
  commission_cents: number;
}

/** Agrégat DAC7 d'une année : jambes cash, soultes et troc valorisé. */
export function aggregateDac7(
  rows: { recipient_id: string; issuer_id: string; amount_cents: number; kind: string; dac7_reportable: boolean }[],
  profiles: Record<string, { legal_name: string | null; country_code: string | null }>,
): Dac7Line[] {
  const bySeller = new Map<string, Dac7Line>();
  for (const row of rows) {
    if (!row.dac7_reportable) continue;
    const seller = row.issuer_id;
    const line =
      bySeller.get(seller) ??
      ({
        seller_id: seller,
        legal_name: profiles[seller]?.legal_name ?? null,
        country_code: profiles[seller]?.country_code ?? null,
        transactions: 0,
        gross_cents: 0,
        commission_cents: 0,
      } satisfies Dac7Line);
    line.transactions += 1;
    line.gross_cents += row.amount_cents;
    bySeller.set(seller, line);
  }
  return [...bySeller.values()].sort((a, b) => b.gross_cents - a.gross_cents);
}

/** Export DAC7 pour une année civile (réservé aux administrateurs). */
export async function exportDac7(year: number): Promise<Dac7Line[]> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const from = `${year}-01-01T00:00:00.000Z`;
  const to = `${year + 1}-01-01T00:00:00.000Z`;

  const { data, error } = await supabaseAdmin
    .from('marketplace_invoices')
    .select('issuer_id, recipient_id, amount_cents, kind, dac7_reportable, issued_at')
    .gte('issued_at', from)
    .lt('issued_at', to);
  if (error) throw new Error(`Export DAC7 illisible : ${error.message}`);

  const rows = (data ?? []) as any[];
  const ids = Array.from(new Set(rows.map((r) => r.issuer_id)));
  const profiles: Record<string, { legal_name: string | null; country_code: string | null }> = {};
  if (ids.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from('marketplace_tax_profiles')
      .select('user_id, legal_name, country_code')
      .in('user_id', ids);
    for (const p of (profs ?? []) as any[]) {
      profiles[p.user_id] = { legal_name: p.legal_name, country_code: p.country_code };
    }
  }

  return aggregateDac7(rows, profiles);
}
