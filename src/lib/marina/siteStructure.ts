import type { SiteStructureContext } from './networkSynthesis';
import { getSiteStructure } from './siteStructure.functions';

/**
 * Récupère, en meilleur effort, la structure connue du domaine pour vérifier
 * l'existence des pages piliers hors périmètre audité. Un échec n'est jamais
 * bloquant : la synthèse déclare alors l'absence de vérification.
 */
export async function fetchSiteStructure(url: string): Promise<SiteStructureContext | undefined> {
  try {
    const res = await getSiteStructure({ data: { domain: url } });
    if (!res || !res.crawlPages) return undefined;
    return res;
  } catch {
    return undefined;
  }
}
