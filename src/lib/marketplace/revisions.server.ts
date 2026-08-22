/**
 * revisions.server.ts (L3.7)
 *
 * Tours de révision d'une insertion : compteur UNIQUE partagé entre la
 * prévisualisation (§2.3) et le Studio (§2.9). Épuisement du plafond
 * `revision_rounds_max` → la seule issue est l'ouverture d'un litige.
 */

import { loadConstants, num, type MarketplaceConstants } from './constants.server';

type Sb = { from: (table: string) => any };

export interface RevisionRow {
  id: string;
  order_id: string;
  variant_id: string | null;
  round_index: number;
  proposed_by: string;
  role: 'buyer' | 'seller';
  html_before: string;
  html_after: string;
  paragraph_excerpt: string | null;
  status: string;
  created_at: string;
  feedback: { author_role: string; verdict: string; comment: string | null; created_at: string }[];
}

export function roundsRemaining(used: number, c: MarketplaceConstants): number {
  return Math.max(0, num(c, 'revision_rounds_max') - used);
}

async function loadOrderParty(
  sb: Sb,
  orderId: string,
  userId: string,
): Promise<{ id: string; buyer_id: string; seller_id: string; status: string; revision_rounds_used: number; role: 'buyer' | 'seller' }> {
  const { data, error } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id, status, revision_rounds_used')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!data || (data.buyer_id !== userId && data.seller_id !== userId)) {
    throw new Error('Commande introuvable pour ce compte');
  }
  return { ...data, revision_rounds_used: data.revision_rounds_used ?? 0, role: data.buyer_id === userId ? 'buyer' : 'seller' };
}

/**
 * Consomme un tour de révision. Utilisé aussi bien par la prévisualisation
 * que par une nouvelle passe du Studio : le compteur est commun.
 */
export async function consumeRound(
  sb: Sb,
  params: { userId: string; orderId: string },
): Promise<{ round_index: number; rounds_remaining: number }> {
  const constants = await loadConstants();
  const order = await loadOrderParty(sb, params.orderId, params.userId);
  const max = num(constants, 'revision_rounds_max');
  if (order.revision_rounds_used >= max) {
    throw new Error(
      `Plafond de ${max} tours de révision atteint : ouvrez un litige pour trancher la livraison`,
    );
  }

  const round = order.revision_rounds_used + 1;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ revision_rounds_used: round })
    .eq('id', params.orderId);
  if (error) throw new Error(`Compteur de révision non mis à jour : ${error.message}`);

  return { round_index: round, rounds_remaining: max - round };
}

/** Propose une insertion (diff avant/après) et consomme un tour. */
export async function proposeRevision(
  sb: Sb,
  params: {
    userId: string;
    orderId: string;
    variantId?: string | null;
    htmlBefore: string;
    htmlAfter: string;
    paragraphExcerpt?: string | null;
  },
): Promise<{ revision_id: string; round_index: number; rounds_remaining: number }> {
  const order = await loadOrderParty(sb, params.orderId, params.userId);
  if (['cancelled', 'refunded', 'resolved'].includes(order.status)) {
    throw new Error('Commande clôturée : aucune révision possible');
  }

  const { round_index, rounds_remaining } = await consumeRound(sb, {
    userId: params.userId,
    orderId: params.orderId,
  });

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin
    .from('marketplace_link_revisions')
    .insert({
      order_id: params.orderId,
      variant_id: params.variantId ?? null,
      round_index,
      proposed_by: params.userId,
      html_before: params.htmlBefore,
      html_after: params.htmlAfter,
      paragraph_excerpt: params.paragraphExcerpt ?? null,
      status: 'proposed',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Révision non enregistrée : ${error.message}`);

  return { revision_id: data.id as string, round_index, rounds_remaining };
}

/** Verdict de l'autre partie sur une révision. */
export async function decideRevision(
  sb: Sb,
  params: { userId: string; revisionId: string; verdict: 'accepted' | 'rejected'; comment?: string | null },
): Promise<{ status: string; rounds_remaining: number }> {
  const { data: rev, error } = await sb
    .from('marketplace_link_revisions')
    .select('id, order_id, proposed_by, status')
    .eq('id', params.revisionId)
    .maybeSingle();
  if (error) throw new Error(`Révision illisible : ${error.message}`);
  if (!rev) throw new Error('Révision introuvable');
  if (rev.proposed_by === params.userId) throw new Error('La partie qui propose ne valide pas sa propre révision');

  const order = await loadOrderParty(sb, rev.order_id as string, params.userId);
  const constants = await loadConstants();

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error: upError } = await supabaseAdmin
    .from('marketplace_link_revisions')
    .update({ status: params.verdict })
    .eq('id', params.revisionId);
  if (upError) throw new Error(`Verdict non enregistré : ${upError.message}`);

  await supabaseAdmin.from('marketplace_feedback').insert({
    order_id: rev.order_id,
    revision_id: rev.id,
    author_id: params.userId,
    author_role: order.role,
    verdict: params.verdict,
    comment: params.comment ?? null,
  });

  if (params.verdict === 'accepted') {
    await supabaseAdmin
      .from('marketplace_orders')
      .update({ approved_revision_id: rev.id })
      .eq('id', rev.order_id);
  }

  return { status: params.verdict, rounds_remaining: roundsRemaining(order.revision_rounds_used, constants) };
}

/** Historique complet des révisions d'une commande, avec feedback bilatéral. */
export async function listRevisions(
  sb: Sb,
  params: { userId: string; orderId: string },
): Promise<{ revisions: RevisionRow[]; rounds_used: number; rounds_remaining: number }> {
  const order = await loadOrderParty(sb, params.orderId, params.userId);
  const constants = await loadConstants();

  const { data, error } = await sb
    .from('marketplace_link_revisions')
    .select('id, order_id, variant_id, round_index, proposed_by, html_before, html_after, paragraph_excerpt, status, created_at')
    .eq('order_id', params.orderId)
    .order('round_index', { ascending: true });
  if (error) throw new Error(`Historique illisible : ${error.message}`);

  const { data: fb } = await sb
    .from('marketplace_feedback')
    .select('revision_id, author_role, verdict, comment, created_at')
    .eq('order_id', params.orderId);

  const feedbackByRevision = new Map<string, RevisionRow['feedback']>();
  for (const f of (fb ?? []) as any[]) {
    if (!f.revision_id) continue;
    const list = feedbackByRevision.get(f.revision_id) ?? [];
    list.push({ author_role: f.author_role, verdict: f.verdict, comment: f.comment, created_at: f.created_at });
    feedbackByRevision.set(f.revision_id, list);
  }

  const revisions = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    order_id: r.order_id,
    variant_id: r.variant_id,
    round_index: r.round_index,
    proposed_by: r.proposed_by,
    role: (r.proposed_by === order.buyer_id ? 'buyer' : 'seller') as 'buyer' | 'seller',
    html_before: r.html_before,
    html_after: r.html_after,
    paragraph_excerpt: r.paragraph_excerpt,
    status: r.status,
    created_at: r.created_at,
    feedback: feedbackByRevision.get(r.id) ?? [],
  }));

  return {
    revisions,
    rounds_used: order.revision_rounds_used,
    rounds_remaining: roundsRemaining(order.revision_rounds_used, constants),
  };
}
