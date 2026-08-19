import { createServerFn } from '@tanstack/react-start';

/**
 * Structure connue d'un domaine, lue dans le dernier crawl complet.
 *
 * Sert un seul objectif : permettre à la synthèse réseau des rapports Marina
 * multipages de distinguer « pilier absent du site » de « pilier existant mais
 * hors du périmètre audité ». On ne renvoie que des chemins d'URL publics,
 * jamais de contenu ni de métrique privée.
 */
export const getSiteStructure = createServerFn({ method: 'GET' })
  .inputValidator((data: { domain: string }) => {
    const raw = String(data?.domain || '').trim().toLowerCase();
    const host = raw
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    if (!host || !host.includes('.') || host.length > 253) throw new Error('invalid_domain');
    return { domain: host };
  })
  .handler(async ({ data }) => {
    const empty = { knownPaths: [] as string[], crawlPages: 0, crawlDate: null as string | null };
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

      const { data: crawl } = await supabaseAdmin
        .from('site_crawls')
        .select('id, created_at')
        .or(`domain.eq.${data.domain},domain.eq.www.${data.domain}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!crawl?.id) return empty;

      const { data: pages } = await supabaseAdmin
        .from('crawl_pages')
        .select('path')
        .eq('crawl_id', crawl.id)
        .limit(10000);

      const knownPaths = [...new Set((pages || []).map((p: any) => String(p.path || '')).filter(Boolean))];
      if (!knownPaths.length) return empty;

      return {
        knownPaths,
        crawlPages: knownPaths.length,
        crawlDate: (crawl.created_at as string) ?? null,
      };
    } catch {
      return empty;
    }
  });
