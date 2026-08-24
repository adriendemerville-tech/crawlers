/**
 * marketplace.functions.ts — RPC typés de la Place d'échange (L1a).
 *
 * Fichier volontairement mince : uniquement des imports et des déclarations
 * de server functions. Toute logique vit dans les modules `*.server.ts`
 * (le découpage automatique supprime les helpers laissés ici).
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { listInventory, setOptIn } from './inventory.server';
import { verifyOwnership, recordClaim, buildToken, normalizeDomain } from './ownership.server';
import { loadConstants } from './constants.server';
import { readTaxProfile, saveTaxProfile } from './taxProfile.server';
import { deriveNeeds, confirmObjective } from './needs.server';
import { evaluateBuyerLimits, loadLegs, countersFrom } from './buyerLimits.server';
import { computeMatches, listIncomingMatches } from './matching.server';
import { getMatchValues } from './matchValue.server';
import { freezeOrder, acceptOrder, cancelOrder, declarePublication, listOrders } from './orders.server';
import { findBarterRoute } from './barter.server';
import { listRevisions, proposeRevision, decideRevision } from './revisions.server';
import { listVariants, generateVariants, approveVariant, selectVariant } from './studio.server';
import { openDispute, listDisputes } from './disputes.server';

export const getMarketplaceConstants = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    void context;
    const c = await loadConstants();
    const values = c.values as Record<string, number | string | Record<string, number>>;
    return { version: c.version, values };
  });

export const getMarketplaceInventory = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return listInventory(context.supabase as never, context.userId);
  });

export const setMarketplaceOptIn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ assetId: z.string().uuid(), optIn: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return setOptIn(context.supabase as never, {
      userId: context.userId,
      assetId: data.assetId,
      optIn: data.optIn,
      termsVersion: 1,
    });
  });

export const getOwnershipToken = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domain: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const domain = normalizeDomain(data.domain);
    return { domain, token: await buildToken(context.userId, domain) };
  });

export const acceptOwnershipClaim = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ domain: z.string().min(3), claimText: z.string().min(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await recordClaim(context.supabase as never, {
      userId: context.userId,
      domain: data.domain,
      claimText: data.claimText,
      claimVersion: 1,
    });
    return { accepted: true };
  });

export const verifyMarketplaceOwnership = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ domain: z.string().min(3), method: z.enum(['dns_txt', 'gsc']) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return verifyOwnership(context.supabase as never, {
      userId: context.userId,
      domain: data.domain,
      method: data.method,
    });
  });

export const getMarketplaceTaxProfile = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return readTaxProfile(context.supabase as never, context.userId);
  });

export const saveMarketplaceTaxProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tax_status: z.enum(['company_vat', 'company_no_vat', 'micro', 'individual', 'association']),
        legal_name: z.string().min(2),
        address: z.string().optional(),
        country_code: z.string().length(2).default('FR'),
        siren_siret: z.string().optional(),
        vat_number: z.string().optional(),
        accept_self_billing: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return saveTaxProfile(context.supabase as never, context.userId, data);
  });

export const getMarketplaceNeeds = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return deriveNeeds(context.supabase as never, context.userId);
  });

export const confirmNeedObjective = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        needId: z.string().uuid(),
        objective: z.enum(['autorite', 'geo', 'trafic', 'mixte']),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return confirmObjective(context.supabase as never, {
      userId: context.userId,
      needId: data.needId,
      objective: data.objective,
    });
  });

export const getMarketplaceBuyerLimits = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return evaluateBuyerLimits(context.supabase as never, context.userId);
  });

export const getMarketplaceMatches = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as never;
    const needs = await deriveNeeds(sb, context.userId);
    const limits = await evaluateBuyerLimits(sb, context.userId);
    const counters = countersFrom(await loadLegs(sb, context.userId));
    const matches = await computeMatches(sb, {
      userId: context.userId,
      needs: needs.filter((n) => n.need_objective_confirmed_at !== null),
      perSeller: counters.perSeller,
      perTarget: counters.perTarget,
      perSellerMax: limits.per_seller_12m_max,
      sameTargetMax: limits.same_target_url_12m_max,
    });
    return { needs, limits, matches };
  });

export const getMarketplaceIncomingMatches = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return listIncomingMatches(context.supabase as never, context.userId);
  });

export const getMarketplaceMatchValues = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ domain: z.string().min(3), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return getMatchValues(context.supabase as never, {
      userId: context.userId,
      domain: data.domain,
      force: data.force,
    });
  });

export const getMarketplaceOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return listOrders(context.supabase as never, context.userId);
  });

export const freezeMarketplaceOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        matchId: z.string().uuid(),
        anchor: z.string().min(2).max(120),
        anchorKind: z.enum(['brand', 'exact', 'semi', 'url', 'natural']),
        dealType: z.enum(['cash', 'credits', 'barter']),
        commissionSupport: z.enum(['cash', 'credits']).optional(),
        tradeType: z
          .enum([
            'link_chain',
            'link_for_link',
            'link_for_linkedin',
            'link_for_insta',
            'linkedin_for_linkedin',
            'insta_for_insta',
          ])
          .optional(),
        currencyKind: z.enum(['link', 'story', 'linkedin']).optional(),
        counterValueCents: z.number().int().min(0).max(35000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return freezeOrder(context.supabase as never, { userId: context.userId, ...data });
  });

export const acceptMarketplaceOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return acceptOrder(context.supabase as never, { userId: context.userId, orderId: data.orderId });
  });

export const cancelMarketplaceOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ orderId: z.string().uuid(), reason: z.string().min(3).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return cancelOrder(context.supabase as never, {
      userId: context.userId,
      orderId: data.orderId,
      reason: data.reason,
    });
  });

export const declareMarketplacePublication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return declarePublication(context.supabase as never, {
      userId: context.userId,
      orderId: data.orderId,
    });
  });

export const getMarketplaceBarterRoute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        buyerDomain: z.string().min(3),
        sellerUserId: z.string().uuid(),
        sellerDomain: z.string().min(3),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return findBarterRoute({ buyerUserId: context.userId, ...data });
  });

export const getMarketplaceRevisions = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return listRevisions(context.supabase as never, { userId: context.userId, orderId: data.orderId });
  });

export const proposeMarketplaceRevision = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        variantId: z.string().uuid().nullable().optional(),
        htmlBefore: z.string().max(20000),
        htmlAfter: z.string().min(10).max(20000),
        paragraphExcerpt: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return proposeRevision(context.supabase as never, { userId: context.userId, ...data });
  });

export const decideMarketplaceRevision = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        revisionId: z.string().uuid(),
        verdict: z.enum(['accepted', 'rejected']),
        comment: z.string().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return decideRevision(context.supabase as never, { userId: context.userId, ...data });
  });

export const getMarketplaceStudio = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return listVariants(context.supabase as never, { userId: context.userId, orderId: data.orderId });
  });

export const generateMarketplaceVariants = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return generateVariants(context.supabase as never, { userId: context.userId, orderId: data.orderId });
  });

export const approveMarketplaceVariant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ variantId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return approveVariant(context.supabase as never, { userId: context.userId, variantId: data.variantId });
  });

export const selectMarketplaceVariant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ variantId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return selectVariant(context.supabase as never, { userId: context.userId, variantId: data.variantId });
  });

export const openMarketplaceDispute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.enum([
          'not_published',
          'attribute_mismatch',
          'anchor_mismatch',
          'removed_early',
          'content_refused',
          'payment',
          'other',
        ]),
        detail: z.string().max(2000).optional(),
        appealOf: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return openDispute(context.supabase as never, { userId: context.userId, ...data });
  });

export const getMarketplaceDisputes = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    return listDisputes(context.supabase as never, data.orderId);
  });

export const getMarketplaceVerifications = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { listVerifications } = await import('./verification.server');
    return listVerifications(context.supabase as never, { userId: context.userId, orderId: data.orderId });
  });

export const getMarketplaceBuyQueue = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listBuyQueue } = await import('./balance.server');
    return listBuyQueue(context.supabase as never, context.userId);
  });

export const refreshMarketplaceBuyQueue = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { refreshBuyQueue } = await import('./balance.server');
    return refreshBuyQueue(context.userId);
  });

export const getMarketplaceBalances = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSiteBalances } = await import('./balance.server');
    return listSiteBalances(context.supabase as never, context.userId);
  });

// ─── L6 — Collab Instagram / LinkedIn ───────────────────────────────

export const getMarketplaceSocialAssets = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSocialAssets, listConnectableAccounts } = await import('./socialAssets.server');
    const [assets, accounts] = await Promise.all([
      listSocialAssets(context.supabase as never, context.userId),
      listConnectableAccounts(context.supabase as never, context.userId),
    ]);
    return { assets, accounts };
  });

export const syncMarketplaceSocialAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        socialAccountId: z.string().uuid(),
        formats: z.array(z.enum(['feed', 'reel', 'story', 'linkedin_post'])).min(1),
        affinity: z.number().min(0).max(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { syncSocialAsset } = await import('./socialAssets.server');
    return syncSocialAsset({ userId: context.userId, ...data });
  });

export const setMarketplaceSocialOptIn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ assetId: z.string().uuid(), optIn: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { setSocialOptIn } = await import('./socialAssets.server');
    return setSocialOptIn({ userId: context.userId, ...data });
  });

export const revokeMarketplaceSocialAsset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ assetId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { revokeSocialAsset } = await import('./socialAssets.server');
    return revokeSocialAsset({ userId: context.userId, assetId: data.assetId });
  });

export const verifyMarketplaceSocialPublication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { verifySocialPublication } = await import('./socialVerification.server');
    const { data: order, error } = await context.supabase
      .from('marketplace_orders')
      .select('id')
      .eq('id', data.orderId)
      .maybeSingle();
    if (error) throw new Error(`Commande illisible : ${error.message}`);
    if (!order) throw new Error('Commande introuvable ou hors de votre périmètre');
    return verifySocialPublication(data.orderId);
  });

