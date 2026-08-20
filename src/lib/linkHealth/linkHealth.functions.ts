import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Actions admin sur la file « Santé des liens ».
 *
 * La lecture de la file se fait directement en base (RLS : admin uniquement).
 * Ici on n'expose que les actions qui font du travail serveur : lancer un
 * scan, revérifier une page, écarter un constat.
 */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'admin',
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('Administrateur uniquement');
}

/** Lance un lot de vérification de liens (rotation par ancienneté). */
export const scanLinkHealth = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) => ({
    limit: Math.max(1, Math.min(30, Number(input?.limit) || 12)),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { runLinkScan } = await import('./audit.server');
    return await runLinkScan(supabaseAdmin as never, data.limit);
  });

/** Revérifie une page précise de la file (après correction d'un lien). */
export const recheckLinkHealthItem = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => {
    if (!input?.itemId) throw new Error('itemId requis');
    return { itemId: String(input.itemId) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { recheckItem } = await import('./audit.server');
    return await recheckItem(supabaseAdmin as never, data.itemId);
  });

/** Écarte un constat (faux positif, lien volontairement mort). */
export const dismissLinkHealthItem = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => {
    if (!input?.itemId) throw new Error('itemId requis');
    return { itemId: String(input.itemId) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from('link_health_queue')
      .update({ status: 'dismissed', reviewed_by: context.userId })
      .eq('id', data.itemId);
    if (error) throw new Error(error.message);
    return { itemId: data.itemId };
  });
