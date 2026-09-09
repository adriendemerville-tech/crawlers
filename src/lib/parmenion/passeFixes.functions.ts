/**
 * Passe unique — registre des correctifs et délégation unique.
 *
 * Règle produit : l'autorisation est demandée UNE SEULE FOIS, après que
 * l'utilisateur a pu retirer des correctifs de la liste. Aucune demande
 * n'est ensuite refaite au moment du déploiement.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { FIX_BY_KEY, FIX_CATALOG, type FixChannel } from './passeFixCatalog';

type LooseFix = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Déduit la clé de correctif du catalogue à partir d'une proposition d'audit. */
function resolveFixKey(item: LooseFix): string | null {
  const direct = str(item['fix_key']) ?? str(item['key']);
  if (direct && FIX_BY_KEY.has(direct)) return direct;

  const haystack = [str(item['scope']), str(item['zone']), str(item['type']), str(item['label'])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!haystack) return null;

  const rules: [RegExp, string][] = [
    [/meta[_\s-]?title|balise title|titre de page/, 'meta_title'],
    [/meta[_\s-]?desc|description/, 'meta_description'],
    [/canonical/, 'meta_canonical'],
    [/hreflang/, 'meta_hreflang'],
    [/open ?graph|og[_:\s-]/, 'meta_opengraph'],
    [/robots ?meta|noindex/, 'meta_robots'],
    [/\bh1\b/, 'heading_h1'],
    [/\bh2\b|\bh3\b|hiérarchie|hierarchie/, 'heading_hierarchy'],
    [/faq/, 'faq_section'],
    [/tableau|table/, 'data_table'],
    [/puce|bullet|résumé|resume|synth/, 'bullet_summary'],
    [/citable|passage/, 'citable_passage'],
    [/json[-_\s]?ld|schema|donnée structurée|donnees structurees/, 'schema_localbusiness'],
    [/301|redirect/, 'redirect_301'],
    [/cannibal/, 'cannibalization_merge'],
    [/maillage|lien interne|internal link/, 'internal_links'],
    [/\balt\b/, 'image_alt'],
    [/webp|avif|format d'image|compress/, 'image_format'],
    [/lazy/, 'image_lazy'],
    [/lcp|preload|précharg|prechar/, 'lcp_preload'],
    [/css critique|critical css/, 'critical_css'],
    [/police|font/, 'font_display'],
    [/robots\.txt/, 'file_robots_txt'],
    [/sitemap/, 'file_sitemap'],
    [/llms?\.txt/, 'file_llms_txt'],
    [/google ?(maps|business)|gmb|fiche/, 'gmb_description'],
  ];
  for (const [re, key] of rules) if (re.test(haystack)) return key;
  return null;
}

function payloadFor(channel: FixChannel, item: LooseFix): Record<string, unknown> {
  const after = str(item['after']) ?? str(item['value']) ?? '';
  const before = str(item['before']) ?? str(item['old_value']);
  if (channel === 'redirect') {
    return { from: str(item['from']) ?? str(item['before']) ?? '', to: str(item['to']) ?? after, type: 301 };
  }
  if (channel === 'code') {
    return { code: after, placement: str(item['placement']) ?? 'header', label: str(item['label']) ?? '' };
  }
  return { value: after, old_value: before, action: str(item['action']) ?? (before ? 'replace' : 'append') };
}

/** Zones acceptées par cms-patch-content, par clé de correctif. */
const CONTENT_ZONE: Record<string, string> = {
  meta_title: 'meta_title',
  meta_description: 'meta_description',
  heading_h1: 'h1',
  heading_hierarchy: 'h2',
  bullet_summary: 'body_section',
  faq_section: 'faq',
  data_table: 'body_section',
  info_section: 'body_section',
  internal_links: 'body_section',
  image_alt: 'alt_text',
};

/* ── Construction du plan de correctifs (déterministe, sans LLM) ───── */

export const buildPasseFixPlan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order } = await supabase
      .from('passe_orders')
      .select('id, url, fixes, findings, gmb_location_id')
      .eq('id', data.orderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!order) return { error: 'not_found' as const };

    // La délégation déjà accordée gèle le plan : on ne le régénère pas.
    const { data: consent } = await supabase
      .from('passe_order_consents')
      .select('id')
      .eq('order_id', data.orderId)
      .maybeSingle();
    if (consent) return { frozen: true as const };

    const proposals = Array.isArray(order.fixes) ? (order.fixes as LooseFix[]) : [];
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    for (const item of proposals) {
      const key = resolveFixKey(item);
      if (!key) continue;
      const def = FIX_BY_KEY.get(key);
      if (!def) continue;
      const pageUrl = str(item['url']) ?? str(item['page_url']) ?? str(order.url) ?? '';
      const dedup = `${key}|${pageUrl}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      rows.push({
        order_id: data.orderId,
        user_id: userId,
        family: def.family,
        fix_key: def.key,
        injection_slug: def.injectionSlug ?? null,
        label: def.label,
        detail: str(item['detail']) ?? def.detail,
        page_url: pageUrl,
        channel: def.channel,
        seo_impact: def.seoImpact,
        payload: payloadFor(def.channel, item),
        before_state: { value: str(item['before']) ?? null },
        status: 'proposed',
      });
    }

    // Correctifs de fiche Google Maps proposés dès qu'une fiche est reliée.
    if (order.gmb_location_id) {
      for (const def of FIX_CATALOG.filter((f) => f.channel === 'gmb')) {
        const dedup = `${def.key}|`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        rows.push({
          order_id: data.orderId,
          user_id: userId,
          family: def.family,
          fix_key: def.key,
          injection_slug: null,
          label: def.label,
          detail: def.detail,
          page_url: null,
          channel: 'gmb',
          seo_impact: def.seoImpact,
          payload: {},
          before_state: {},
          status: 'proposed',
        });
      }
    }

    if (rows.length > 0) {
      await supabase
        .from('passe_order_fixes')
        .upsert(rows as never, { onConflict: 'order_id,fix_key,page_url', ignoreDuplicates: true });
    }

    return { built: rows.length };
  });

/* ── Lecture du registre + état de la délégation ───────────────────── */

export const getPasseFixes = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: fixes }, { data: consent }] = await Promise.all([
      supabase
        .from('passe_order_fixes')
        .select('*')
        .eq('order_id', data.orderId)
        .eq('user_id', userId)
        .order('family', { ascending: true })
        .order('label', { ascending: true }),
      supabase
        .from('passe_order_consents')
        .select('granted_at, authorized_fix_ids, declined_fix_ids, scope_version')
        .eq('order_id', data.orderId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    return { fixes: fixes ?? [], consent: consent ?? null };
  });

/* ── Délégation : une seule fois, horodatée, avec la liste exacte ──── */

export const grantPasseDelegation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        authorizedFixIds: z.array(z.string().uuid()).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from('passe_order_consents')
      .select('granted_at')
      .eq('order_id', data.orderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return { alreadyGranted: true as const, grantedAt: existing.granted_at };

    const { data: all } = await supabase
      .from('passe_order_fixes')
      .select('id, fix_key, label, family, channel, page_url')
      .eq('order_id', data.orderId)
      .eq('user_id', userId);
    if (!all || all.length === 0) return { error: 'no_fixes' as const };

    const allowed = new Set(all.map((f) => f.id));
    const authorized = data.authorizedFixIds.filter((id) => allowed.has(id));
    if (authorized.length === 0) return { error: 'no_fixes' as const };
    const declined = all.map((f) => f.id).filter((id) => !authorized.includes(id));

    await supabase
      .from('passe_order_fixes')
      .update({ status: 'authorized', updated_at: new Date().toISOString() })
      .in('id', authorized)
      .eq('user_id', userId);
    if (declined.length > 0) {
      await supabase
        .from('passe_order_fixes')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .in('id', declined)
        .eq('user_id', userId);
    }

    const { error } = await supabase.from('passe_order_consents').insert({
      order_id: data.orderId,
      user_id: userId,
      authorized_fix_ids: authorized,
      declined_fix_ids: declined,
      summary_snapshot: { fixes: all } as never,
      scope_version: 'v1',
    });
    if (error) return { error: 'consent_failed' as const, message: error.message };

    await supabase.from('passe_order_events').insert({
      order_id: data.orderId,
      user_id: userId,
      event: 'delegation_granted',
      payload: { authorized: authorized.length, declined: declined.length } as never,
    });

    return { granted: true as const, authorized: authorized.length, declined: declined.length };
  });
