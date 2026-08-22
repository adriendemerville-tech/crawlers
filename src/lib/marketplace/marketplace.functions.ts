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
