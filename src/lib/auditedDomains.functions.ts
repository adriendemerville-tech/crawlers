import { createServerFn } from '@tanstack/react-start';

// Compteur public de noms de domaine audités (preuve sociale).
// La valeur vient d'un agrégat SQL sur les audits réellement enregistrés :
// aucun chiffre n'est arrondi à la hausse ni saisi à la main.
// L'agrégat balaie 9 tables : il est donc mis en cache (table + mémoire de
// l'isolat) pour ne pas être recalculé à chaque affichage de la home.
const METRIC = 'audited_domains_count';
const TTL_MS = 6 * 3600 * 1000;

export const getAuditedDomainsCount = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const { data: cached } = await supabaseAdmin
    .from('public_metrics_cache')
    .select('value, updated_at')
    .eq('metric', METRIC)
    .maybeSingle();

  const fresh = cached?.updated_at && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS;
  if (fresh) return { count: Number(cached!.value) };

  const { data, error } = await supabaseAdmin.rpc('get_audited_domains_count');
  if (error) {
    console.error('[audited-domains] count failed', error.message);
    // Une valeur périmée reste préférable à un compteur vide.
    return { count: cached ? Number(cached.value) : (null as number | null) };
  }
  const count = typeof data === 'number' ? data : null;
  if (count !== null) {
    await supabaseAdmin
      .from('public_metrics_cache')
      .upsert({ metric: METRIC, value: count, updated_at: new Date().toISOString() } as never);
  }
  return { count };
});
