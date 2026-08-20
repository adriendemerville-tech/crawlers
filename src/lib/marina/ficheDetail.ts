/**
 * Niveau de détail des fiches par URL dans un rapport Marina multipages.
 *
 * Toutes les URLs d'un lot n'ont pas le même intérêt de lecture : dans un
 * réseau d'agences, quinze pages `/agence/*` partagent un gabarit unique, et
 * détailler quinze fois le même diagnostic technique et GEO produit des
 * centaines de pages PDF sans apporter un seul constat nouveau.
 *
 * Règle retenue (déterministe, aucune perte d'information mesurée) :
 *   - les URLs sont regroupées par gabarit (`detectTemplates`) ;
 *   - un gabarit de 3 pages ou plus est détaillé une fois, par l'URL la plus
 *     instructive (score global le plus bas — c'est là que sont les correctifs) ;
 *   - ses autres instances passent en fiche condensée : leur conclusion
 *     intermédiaire (scores, verdict, actions) reste intégralement présente ;
 *   - une URL citée nominativement par la synthèse réseau (quasi-doublon
 *     mesuré, page pauvre, page isolée) reste toujours détaillée.
 */

import { detectTemplates } from './networkSynthesis';
import type { PageMeta } from './mergeReports';
import type { NetworkSynthesisFacts } from './networkSynthesis';

export type FicheLevel = 'full' | 'condensed';

export interface FicheDetailPlan {
  /** Niveau retenu par chemin d'URL. */
  level: Map<string, FicheLevel>;
  /** Gabarit de rattachement par chemin, pour l'expliquer au lecteur. */
  templateOf: Map<string, string>;
  /** URL représentative retenue par gabarit condensé. */
  representativeOf: Map<string, string>;
  condensedCount: number;
}

/** Seuil au-delà duquel un gabarit est détaillé une seule fois. */
const MIN_FAMILY_FOR_CONDENSATION = 3;

function citedPaths(facts: NetworkSynthesisFacts | null): Set<string> {
  const set = new Set<string>();
  if (!facts) return set;
  for (const d of facts.measuredDuplicates || []) {
    if (d.a) set.add(d.a);
    if (d.b) set.add(d.b);
  }
  for (const p of facts.thinPages || []) set.add(p);
  for (const p of facts.orphanPages || []) set.add(p);
  return set;
}

export function planFicheDetail(
  metas: PageMeta[],
  facts: NetworkSynthesisFacts | null,
): FicheDetailPlan {
  const level = new Map<string, FicheLevel>();
  const templateOf = new Map<string, string>();
  const representativeOf = new Map<string, string>();
  let condensedCount = 0;

  const protectedPaths = citedPaths(facts);
  for (const m of metas) level.set(m.path, 'full');
  if (metas.length < MIN_FAMILY_FOR_CONDENSATION) {
    return { level, templateOf, representativeOf, condensedCount };
  }

  for (const family of detectTemplates(metas)) {
    for (const p of family.pages) templateOf.set(p.path, family.pattern);
    if (family.pages.length < MIN_FAMILY_FOR_CONDENSATION) continue;

    // Représentante : score global le plus bas (constats les plus riches),
    // à défaut de score, la première page du gabarit.
    const scored = family.pages.filter((p) => typeof p.global === 'number');
    const representative = scored.length
      ? scored.reduce((worst, p) => ((p.global as number) < (worst.global as number) ? p : worst))
      : family.pages[0];

    for (const p of family.pages) {
      if (p.path === representative.path) continue;
      if (protectedPaths.has(p.path)) continue;
      level.set(p.path, 'condensed');
      representativeOf.set(p.path, representative.path);
      condensedCount += 1;
    }
  }

  return { level, templateOf, representativeOf, condensedCount };
}
