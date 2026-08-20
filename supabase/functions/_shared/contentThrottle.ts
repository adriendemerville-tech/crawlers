/**
 * contentThrottle.ts — Plafond de création de contenu par domaine (Parménion).
 *
 * Deux défauts historiques rendaient le throttle inopérant :
 *  1. le compteur cherchait des lignes `action_type='create-post'` / `status='completed'`
 *     dans `autopilot_modification_log` — qui n'étaient jamais écrites ;
 *  2. il était scopé par `tracked_site_id` alors qu'un même domaine peut avoir
 *     plusieurs sites suivis (iktracker.fr en avait 3), multipliant le quota.
 *
 * Ce module centralise donc : résolution des sites d'un domaine, comptage réel
 * des publications, et écriture de la trace de publication.
 */

export type ThrottlePeriod = 'day' | 'week';

/** Marqueurs canoniques d'une publication réellement poussée. */
const PUBLISH_ACTION_TYPE = 'create-post';
// Contraintes DB : phase ∈ {diagnostic, prescription, implementation} et
// status ∈ {applied, rolled_back, failed, simulated}. Toute autre valeur est
// rejetée par un CHECK — c'est pourquoi l'ancien compteur ('completed') ne
// trouvait jamais rien.
const PUBLISH_STATUS = 'applied';
const PUBLISH_PHASE = 'implementation';


export function periodStart(period: ThrottlePeriod): string {
  const ms = period === 'week' ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

/** Tous les tracked_sites partageant ce domaine (le quota est par domaine). */
export async function siteIdsForDomain(supabase: any, domain: string): Promise<string[]> {
  const { data } = await supabase.from('tracked_sites').select('id').eq('domain', domain);
  return (data || []).map((r: { id: string }) => r.id);
}

/** Nombre d'articles réellement publiés sur le domaine pendant la période. */
export async function countRecentContentCreations(
  supabase: any,
  domain: string,
  period: ThrottlePeriod,
  siteIds?: string[],
): Promise<number> {
  const ids = siteIds && siteIds.length > 0 ? siteIds : await siteIdsForDomain(supabase, domain);
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from('autopilot_modification_log')
    .select('id', { count: 'exact', head: true })
    .in('tracked_site_id', ids)
    .eq('action_type', PUBLISH_ACTION_TYPE)
    .eq('status', PUBLISH_STATUS)
    .gte('created_at', periodStart(period));
  return count ?? 0;
}

/**
 * Trace une publication effective. C'est cette ligne — et elle seule — qui
 * alimente le compteur du throttle.
 */
export async function logContentCreation(
  supabase: any,
  params: {
    trackedSiteId: string;
    configId?: string | null;
    userId?: string | null;
    cycleNumber?: number | null;
    phase?: string;
    slug: string;
    title?: string;
    published: boolean;
    via: string;
  },
): Promise<void> {
  try {
    await supabase.from('autopilot_modification_log').insert({
      tracked_site_id: params.trackedSiteId,
      config_id: params.configId ?? null,
      user_id: params.userId ?? null,
      phase: params.phase || 'execute',
      action_type: PUBLISH_ACTION_TYPE,
      status: PUBLISH_STATUS,
      cycle_number: params.cycleNumber ?? null,
      page_url: params.slug || null,
      description: `[PUBLISH:${params.via}] ${params.title || params.slug} (${params.published ? 'published' : 'draft'})`,
      diff_after: { slug: params.slug, published: params.published, via: params.via },
    });
  } catch (err) {
    console.error('[contentThrottle] log publication échoué:', err instanceof Error ? err.message : err);
  }
}
