/**
 * studio.server.ts (L3.6)
 *
 * Studio de création : trois variantes d'insertion générées en UNE seule passe
 * par variante (coût borné), sur un brief figé côté serveur. Le vendeur
 * approuve, l'acheteur choisit la version finale.
 *
 * La version « action » disparaît au-delà de `studio_version_c_max_authority` :
 * une page de forte autorité ne porte pas de formulation commerciale.
 * Chaque génération consomme un tour du compteur PARTAGÉ avec les révisions.
 */

import { loadConstants, num } from './constants.server';
import { consumeRound } from './revisions.server';
import { roundsRemaining } from './revisions.server';
import type { StudioState, StudioVariant, VariantKind } from './studioTypes';
import { VARIANT_INTENT } from './studioTypes';

type Sb = { from: (table: string) => any };

const MODEL = 'google/gemini-3.1-flash-lite';

interface OrderBrief {
  id: string;
  buyer_id: string;
  seller_id: string;
  seller_domain: string;
  buyer_domain: string;
  target_url: string;
  anchor: string | null;
  link_attribute: string;
  need_objective: string | null;
  asset_id: string;
  status: string;
}

async function loadOrder(sb: Sb, orderId: string, userId: string): Promise<OrderBrief & { role: 'buyer' | 'seller' }> {
  const { data, error } = await sb
    .from('marketplace_orders')
    .select(
      'id, buyer_id, seller_id, seller_domain, buyer_domain, target_url, anchor, link_attribute, need_objective, asset_id, status, revision_rounds_used',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Commande illisible : ${error.message}`);
  if (!data || (data.buyer_id !== userId && data.seller_id !== userId)) {
    throw new Error('Commande introuvable pour ce compte');
  }
  return { ...(data as OrderBrief), role: data.buyer_id === userId ? 'buyer' : 'seller' };
}

/** Autorité de la page vendeuse : décide de la disponibilité de la version action. */
async function sellerAuthority(assetId: string): Promise<number> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin
    .from('marketplace_link_assets')
    .select('authority_score, url, topic_clusters')
    .eq('id', assetId)
    .maybeSingle();
  return Number(data?.authority_score ?? 0);
}

function buildPrompt(variant: VariantKind, brief: Record<string, unknown>): string {
  return [
    `Intention de la variante : ${VARIANT_INTENT[variant]}`,
    `Page hôte : ${brief['seller_url'] ?? brief['seller_domain']}`,
    `Thématiques de la page hôte : ${(brief['clusters'] as string[] | undefined)?.join(', ') || 'non renseignées'}`,
    `Page citée : ${brief['target_url']}`,
    `Ancre imposée : ${brief['anchor'] ?? 'ancre naturelle de marque'}`,
    `Attribut du lien : ${brief['link_attribute']}`,
    `Objectif de l'acheteur : ${brief['need_objective'] ?? 'autorité'}`,
    '',
    "Rédige UN SEUL paragraphe en français, prêt à insérer dans la page hôte.",
    "Contraintes : aucun emoji, aucune promesse chiffrée non fournie, aucune mention de partenariat ou d'échange,",
    "un seul lien HTML <a href> portant exactement l'ancre imposée, pas de titre, pas de liste.",
    'Réponds uniquement par le paragraphe HTML.',
  ].join('\n');
}

async function generateOne(variant: VariantKind, brief: Record<string, unknown>, maxChars: number): Promise<{ output: string; cost_cents: number }> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error('Studio indisponible : clé IA absente');

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content:
            "Tu rédiges des insertions éditoriales sobres pour des pages existantes. Tu respectes le ton d'un site professionnel français, sans emoji, sans superlatif, sans mention d'échange commercial.",
        },
        { role: 'user', content: buildPrompt(variant, brief) },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Studio : génération refusée (${resp.status})`);
  const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!raw) throw new Error('Studio : réponse vide');

  return { output: raw.slice(0, maxChars), cost_cents: 1 };
}

/** Génère les variantes d'une commande (une passe par variante). */
export async function generateVariants(
  sb: Sb,
  params: { userId: string; orderId: string },
): Promise<StudioState> {
  const constants = await loadConstants();
  const order = await loadOrder(sb, params.orderId, params.userId);
  if (!['frozen', 'pending'].includes(order.status)) {
    throw new Error('Le Studio n’est ouvert qu’entre le gel des conditions et la publication');
  }

  const authority = await sellerAuthority(order.asset_id);
  const maxAuthority = num(constants, 'studio_version_c_max_authority');
  const actionAvailable = authority <= maxAuthority;

  const { round_index, rounds_remaining } = await consumeRound(sb, {
    userId: params.userId,
    orderId: params.orderId,
  });

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: asset } = await supabaseAdmin
    .from('marketplace_link_assets')
    .select('url, domain, topic_clusters')
    .eq('id', order.asset_id)
    .maybeSingle();

  const brief: Record<string, unknown> = {
    seller_url: asset?.url ?? null,
    seller_domain: order.seller_domain,
    clusters: asset?.topic_clusters ?? [],
    target_url: order.target_url,
    anchor: order.anchor,
    link_attribute: order.link_attribute,
    need_objective: order.need_objective,
    constants_version: constants.version,
    round_index,
  };

  const kinds: VariantKind[] = actionAvailable
    ? ['editorial', 'utility_geo', 'action']
    : ['editorial', 'utility_geo'];

  const rows: Record<string, unknown>[] = [];
  for (const kind of kinds) {
    const { output, cost_cents } = await generateOne(kind, brief, num(constants, 'studio_max_output_chars'));
    rows.push({
      order_id: order.id,
      variant: kind,
      brief,
      output,
      anchor: order.anchor,
      model: MODEL,
      cost_cents,
      round_index,
    });
  }

  const { error } = await supabaseAdmin.from('marketplace_content_variants').insert(rows);
  if (error) throw new Error(`Variantes non enregistrées : ${error.message}`);

  return {
    ...(await listVariants(sb, params)),
    rounds_remaining,
    action_variant_available: actionAvailable,
    action_variant_reason: actionAvailable
      ? null
      : `Version orientée action retirée : autorité de la page hôte (${authority}) au-delà du seuil de ${maxAuthority}`,
  };
}

/** Variantes existantes d'une commande. */
export async function listVariants(sb: Sb, params: { userId: string; orderId: string }): Promise<StudioState> {
  const constants = await loadConstants();
  const { data: orderRow, error: orderError } = await sb
    .from('marketplace_orders')
    .select('id, buyer_id, seller_id, revision_rounds_used, asset_id')
    .eq('id', params.orderId)
    .maybeSingle();
  if (orderError) throw new Error(`Commande illisible : ${orderError.message}`);
  if (!orderRow || (orderRow.buyer_id !== params.userId && orderRow.seller_id !== params.userId)) {
    throw new Error('Commande introuvable pour ce compte');
  }

  const { data, error } = await sb
    .from('marketplace_content_variants')
    .select('id, variant, output, anchor, model, round_index, seller_approved_at, buyer_selected_at, created_at')
    .eq('order_id', params.orderId)
    .order('round_index', { ascending: false })
    .order('variant', { ascending: true });
  if (error) throw new Error(`Variantes illisibles : ${error.message}`);

  const authority = await sellerAuthority(orderRow.asset_id as string);
  const maxAuthority = num(constants, 'studio_version_c_max_authority');
  const used = Number(orderRow.revision_rounds_used ?? 0);

  return {
    variants: (data ?? []) as StudioVariant[],
    rounds_used: used,
    rounds_remaining: roundsRemaining(used, constants),
    action_variant_available: authority <= maxAuthority,
    action_variant_reason:
      authority <= maxAuthority
        ? null
        : `Version orientée action retirée : autorité de la page hôte (${authority}) au-delà du seuil de ${maxAuthority}`,
  };
}

/** Le vendeur approuve une variante : elle devient proposable à l'acheteur. */
export async function approveVariant(
  sb: Sb,
  params: { userId: string; variantId: string },
): Promise<{ approved: true }> {
  const { data, error } = await sb
    .from('marketplace_content_variants')
    .select('id, order_id')
    .eq('id', params.variantId)
    .maybeSingle();
  if (error) throw new Error(`Variante illisible : ${error.message}`);
  if (!data) throw new Error('Variante introuvable');

  const order = await loadOrder(sb, data.order_id as string, params.userId);
  if (order.role !== 'seller') throw new Error("Seul le vendeur approuve une variante : elle paraît sur sa page");

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error: upError } = await supabaseAdmin
    .from('marketplace_content_variants')
    .update({ seller_approved_at: new Date().toISOString() })
    .eq('id', params.variantId);
  if (upError) throw new Error(`Approbation refusée : ${upError.message}`);
  return { approved: true };
}

/** L'acheteur choisit la version finale parmi celles approuvées. */
export async function selectVariant(
  sb: Sb,
  params: { userId: string; variantId: string },
): Promise<{ selected: true }> {
  const { data, error } = await sb
    .from('marketplace_content_variants')
    .select('id, order_id, seller_approved_at')
    .eq('id', params.variantId)
    .maybeSingle();
  if (error) throw new Error(`Variante illisible : ${error.message}`);
  if (!data) throw new Error('Variante introuvable');
  if (!data.seller_approved_at) throw new Error("Cette variante n'est pas encore approuvée par le vendeur");

  const order = await loadOrder(sb, data.order_id as string, params.userId);
  if (order.role !== 'buyer') throw new Error("Seul l'acheteur choisit la version finale");

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  await supabaseAdmin
    .from('marketplace_content_variants')
    .update({ buyer_selected_at: null })
    .eq('order_id', data.order_id);
  const { error: upError } = await supabaseAdmin
    .from('marketplace_content_variants')
    .update({ buyer_selected_at: new Date().toISOString() })
    .eq('id', params.variantId);
  if (upError) throw new Error(`Choix refusé : ${upError.message}`);
  return { selected: true };
}
