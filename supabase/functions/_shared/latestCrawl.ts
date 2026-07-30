/**
 * Résolution du dernier crawl d'un site.
 *
 * ATTENTION : la table `site_crawls` n'a PAS de colonne `tracked_site_id`.
 * Elle est indexée par (user_id, domain). Toute requête `.eq('tracked_site_id', ...)`
 * sur `site_crawls` renvoie une erreur PostgREST silencieuse (data = null),
 * ce qui faisait retourner 0 finding à tous les diagnostics Cocoon.
 */

export async function resolveDomainForSite(
  supabase: any,
  trackedSiteId: string | null | undefined,
  fallbackDomain?: string | null,
): Promise<string | null> {
  if (fallbackDomain) return fallbackDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  if (!trackedSiteId) return null;
  const { data } = await supabase
    .from('tracked_sites')
    .select('domain')
    .eq('id', trackedSiteId)
    .maybeSingle();
  return data?.domain ?? null;
}

/** Retourne l'id du dernier crawl (complété par défaut) pour un site. */
export async function getLatestCrawlId(
  supabase: any,
  opts: { trackedSiteId?: string | null; domain?: string | null; completedOnly?: boolean },
): Promise<string | null> {
  const domain = await resolveDomainForSite(supabase, opts.trackedSiteId, opts.domain);
  if (!domain) return null;

  let query = supabase
    .from('site_crawls')
    .select('id')
    .eq('domain', domain);

  if (opts.completedOnly !== false) query = query.eq('status', 'completed');

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[latestCrawl] query error:', error.message);
    return null;
  }
  return data?.id ?? null;
}
