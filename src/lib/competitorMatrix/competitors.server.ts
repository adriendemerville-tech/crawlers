// Étape 2 — résolution typée des concurrents (taxonomie de la matrice).
// DataForSEO Labs fournit les concurrents de VISIBILITÉ (fait mesuré) ;
// un appel LLM unique propose les concurrents métier / silencieux / substituts /
// goliaths, que les étapes suivantes vérifieront dans la SERP.

import { aiChat, parseJsonLoose } from './ai.server';
import { dfsPost, cleanDomain } from './dfs.server';
import { LOCATION_FR, type Competitor, type Identity } from './types';

const BLOCKLIST = new Set([
  'google.com', 'google.fr', 'youtube.com', 'facebook.com', 'linkedin.com',
  'wikipedia.org', 'fr.wikipedia.org', 'pinterest.fr', 'pinterest.com',
  'instagram.com', 'x.com', 'twitter.com', 'amazon.fr', 'amazon.com',
  'pagesjaunes.fr', 'societe.com', 'leboncoin.fr', 'indeed.com', 'tiktok.com',
]);

function acceptable(domain: string, self: string): boolean {
  const d = cleanDomain(domain);
  if (!d || !d.includes('.') || d.length > 80) return false;
  if (d === self || d.endsWith(`.${self}`) || self.endsWith(`.${d}`)) return false;
  return !BLOCKLIST.has(d);
}

export async function fetchVisibilityCompetitors(domain: string, limit = 8): Promise<Competitor[]> {
  const data = await dfsPost('dataforseo_labs/google/competitors_domain/live', [{
    target: domain,
    location_code: LOCATION_FR,
    language_code: 'fr',
    limit: 20,
    order_by: ['sum_position,asc'],
  }]);
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  const out: Competitor[] = [];
  for (const item of items) {
    const d = cleanDomain(item.domain || '');
    if (!acceptable(d, domain)) continue;
    const common = item.intersections ?? item.full_domain_metrics?.organic?.count ?? 0;
    out.push({
      domain: d,
      name: d,
      type: 'visibilite',
      reason: common ? `Positionné sur ${common} mots-clés communs dans Google` : 'Positionné sur les mêmes requêtes dans Google',
      source: 'dataforseo',
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function proposeCompetitorsWithLlm(identity: Identity): Promise<Competitor[]> {
  const raw = await aiChat({
    model: 'google/gemini-3.7-flash',
    json: true,
    prompt: `Tu analyses le marché d'une entreprise française.

Entreprise : ${identity.name}
Domaine : ${identity.domain}
Activité : ${identity.activity}
Zone : ${identity.locality || 'nationale'}

Donne des entreprises réelles et vérifiables, avec leur nom de domaine exact, réparties en 4 catégories :
- "metier" : même produit ou service, même marché (4 maximum)
- "silencieux" : même offre mais très peu visible en ligne (2 maximum)
- "substitut" : répond au même besoin par un moyen différent (2 maximum)
- "goliath" : grande plateforme dominante qui pourrait absorber ce marché (2 maximum)

N'invente aucun domaine : si tu n'es pas certain de son existence, ne le cite pas.
JSON strict : {"competitors":[{"domain":"exemple.fr","name":"Exemple","type":"metier","reason":"..."}]}`,
  });

  const parsed = parseJsonLoose(raw);
  const list: any[] = Array.isArray(parsed?.competitors) ? parsed.competitors : [];
  const allowed = new Set(['metier', 'silencieux', 'substitut', 'goliath']);
  const out: Competitor[] = [];
  for (const c of list) {
    const d = cleanDomain(c?.domain || '');
    const type = String(c?.type || '').toLowerCase();
    if (!acceptable(d, identity.domain) || !allowed.has(type)) continue;
    out.push({
      domain: d,
      name: String(c.name || d).slice(0, 60),
      type: type as Competitor['type'],
      reason: String(c.reason || '').slice(0, 180),
      source: 'llm',
    });
  }
  return out;
}

/**
 * Fusionne les sources, déduplique par domaine et borne la matrice.
 * Priorité quand un domaine remonte deux fois :
 * fourni par l'utilisateur > métier > visibilité > silencieux.
 */
export function mergeCompetitors(
  userProvided: string[],
  proposed: Competitor[],
  visibility: Competitor[],
  self: string,
): { matrix: Competitor[]; outOfScope: Competitor[] } {
  const byDomain = new Map<string, Competitor>();

  for (const raw of userProvided) {
    const d = cleanDomain(raw);
    if (!acceptable(d, self)) continue;
    byDomain.set(d, {
      domain: d, name: d, type: 'metier',
      reason: 'Concurrent désigné par l’utilisateur', source: 'user',
    });
  }
  for (const c of proposed) if (!byDomain.has(c.domain)) byDomain.set(c.domain, c);
  for (const c of visibility) if (!byDomain.has(c.domain)) byDomain.set(c.domain, c);

  const all = [...byDomain.values()];
  const order: Record<string, number> = { metier: 0, visibilite: 1, silencieux: 2 };
  const matrix = all
    .filter((c) => c.type in order)
    .sort((a, b) => order[a.type] - order[b.type])
    .slice(0, 6);
  const outOfScope = all.filter((c) => c.type === 'substitut' || c.type === 'goliath').slice(0, 4);
  return { matrix, outOfScope };
}
