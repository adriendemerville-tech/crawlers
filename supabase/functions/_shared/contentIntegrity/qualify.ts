/**
 * contentIntegrity/qualify.ts
 *
 * Qualification adaptative des clusters quasi-dupliqués.
 *
 * Couche 1 (0 token) : tolérance ajustée par secteur / modèle d'affaires issu
 * de la carte d'identité du site + part de gabarit mesurée.
 * Couche 2 (LLM d'appoint) : uniquement pour les clusters ambigus, plafonnée.
 */

import { callRoutedAI } from '../aiRouter.ts';
import type { NearDuplicateCluster } from './nearDuplicate.ts';

export type Verdict = 'cannibalization' | 'watch' | 'normal';

export interface SiteIdentity {
  domain: string;
  site_name?: string | null;
  market_sector?: string | null;
  business_type?: string | null;
  entity_type?: string | null;
  commercial_model?: string | null;
  target_audience?: string | null;
}

export interface QualifiedCluster extends NearDuplicateCluster {
  verdict: Verdict;
  /** 'deterministic' ou 'llm' */
  verdict_source: 'deterministic' | 'llm';
  rationale: string;
  recommended_action: 'merge_and_redirect' | 'differentiate' | 'enrich' | 'none';
}

/** Tolérance de similarité par profil : au-delà, c'est anormal. */
const SECTOR_TOLERANCE: Array<{ match: RegExp; tolerance: number }> = [
  { match: /ecommerce|e-commerce|retail|boutique|marketplace/i, tolerance: 0.93 },
  { match: /immobilier|automobile|voyage|tourisme|hotel|location/i, tolerance: 0.94 },
  { match: /annuaire|directory|petites annonces/i, tolerance: 0.95 },
  { match: /local|artisan|restaurant|sante|medical|avocat|cabinet/i, tolerance: 0.9 },
  { match: /saas|logiciel|software|tech|agence|conseil|consulting/i, tolerance: 0.85 },
  { match: /media|blog|presse|magazine|edition/i, tolerance: 0.82 },
];

const AMBIGUITY_BAND = 0.04;
const MAX_LLM_CALLS = 5;

export function toleranceFor(identity: SiteIdentity): number {
  const haystack = [identity.market_sector, identity.business_type, identity.entity_type, identity.commercial_model]
    .filter(Boolean)
    .join(' ');
  for (const rule of SECTOR_TOLERANCE) {
    if (rule.match.test(haystack)) return rule.tolerance;
  }
  return 0.88;
}

/** Verdict déterministe. Renvoie null si le cluster est ambigu. */
export function qualifyDeterministic(
  cluster: NearDuplicateCluster,
  identity: SiteIdentity,
): QualifiedCluster | null {
  const tolerance = toleranceFor(identity);
  const sim = cluster.avg_similarity;

  // Pages majoritairement gabarit : similarité structurelle, pas éditoriale.
  if (cluster.template_ratio >= 0.75) {
    return {
      ...cluster,
      verdict: 'normal',
      verdict_source: 'deterministic',
      rationale: `Similarité portée par le gabarit du site (${Math.round(cluster.template_ratio * 100)} % de contenu répété), pas par le contenu éditorial.`,
      recommended_action: 'none',
    };
  }

  if (sim >= tolerance + AMBIGUITY_BAND) {
    return {
      ...cluster,
      verdict: 'cannibalization',
      verdict_source: 'deterministic',
      rationale: `Similarité de ${Math.round(sim * 100)} % entre ${cluster.pages.length} pages, au-delà de la tolérance du secteur (${Math.round(tolerance * 100)} %).`,
      recommended_action: 'merge_and_redirect',
    };
  }

  if (sim <= tolerance - AMBIGUITY_BAND) {
    return {
      ...cluster,
      verdict: 'normal',
      verdict_source: 'deterministic',
      rationale: `Similarité de ${Math.round(sim * 100)} % conforme aux usages du secteur (tolérance ${Math.round(tolerance * 100)} %).`,
      recommended_action: 'none',
    };
  }

  return null; // zone ambiguë → LLM d'appoint
}

interface LlmVerdict {
  cluster_id: string;
  verdict: Verdict;
  rationale: string;
  recommended_action: QualifiedCluster['recommended_action'];
}

/**
 * Qualifie tous les clusters : déterministe d'abord, LLM d'appoint pour les
 * clusters ambigus (plafonné à MAX_LLM_CALLS par crawl).
 */
export async function qualifyClusters(
  clusters: NearDuplicateCluster[],
  identity: SiteIdentity,
  excerpts: Map<string, string>,
): Promise<{ clusters: QualifiedCluster[]; llm_calls: number }> {
  const qualified: QualifiedCluster[] = [];
  const ambiguous: NearDuplicateCluster[] = [];

  for (const cluster of clusters) {
    const deterministic = qualifyDeterministic(cluster, identity);
    if (deterministic) qualified.push(deterministic);
    else ambiguous.push(cluster);
  }

  const toAsk = ambiguous.slice(0, MAX_LLM_CALLS);
  const skipped = ambiguous.slice(MAX_LLM_CALLS);

  for (const cluster of skipped) {
    qualified.push({
      ...cluster,
      verdict: 'watch',
      verdict_source: 'deterministic',
      rationale: `Similarité de ${Math.round(cluster.avg_similarity * 100)} % en zone limite ; qualification détaillée non effectuée (plafond d'analyse atteint).`,
      recommended_action: 'differentiate',
    });
  }

  let llmCalls = 0;
  for (const cluster of toAsk) {
    const verdict = await askLlm(cluster, identity, excerpts);
    llmCalls++;
    qualified.push({
      ...cluster,
      verdict: verdict?.verdict ?? 'watch',
      verdict_source: verdict ? 'llm' : 'deterministic',
      rationale:
        verdict?.rationale ??
        `Similarité de ${Math.round(cluster.avg_similarity * 100)} % en zone limite, à surveiller.`,
      recommended_action: verdict?.recommended_action ?? 'differentiate',
    });
  }

  return { clusters: qualified, llm_calls: llmCalls };
}

async function askLlm(
  cluster: NearDuplicateCluster,
  identity: SiteIdentity,
  excerpts: Map<string, string>,
): Promise<LlmVerdict | null> {
  const pagesBlock = cluster.pages
    .slice(0, 4)
    .map((p) => {
      const excerpt = (excerpts.get(p.url) || '').slice(0, 500);
      return `- ${p.url} (similarité ${Math.round(p.similarity * 100)} %, ${p.usefulWords} mots)\n  Extrait : ${excerpt}`;
    })
    .join('\n');

  const system = `Tu es un auditeur SEO. Tu qualifies un groupe de pages proches en contenu.
Réponds en JSON strict : {"verdict":"cannibalization|watch|normal","rationale":"une phrase","recommended_action":"merge_and_redirect|differentiate|enrich|none"}.
Règles :
- "normal" si la similarité est attendue pour ce type de site (variantes de produits, pages locales, pagination).
- "cannibalization" si plusieurs pages visent la même intention de recherche et se concurrencent.
- "watch" en cas de doute.
Aucun emoji.`;

  const user = `Site : ${identity.domain}${identity.site_name ? ` (${identity.site_name})` : ''}
Secteur : ${identity.market_sector || 'inconnu'}
Modèle : ${identity.business_type || identity.commercial_model || 'inconnu'}
Audience : ${identity.target_audience || 'inconnue'}

Groupe de ${cluster.pages.length} pages, similarité moyenne ${Math.round(cluster.avg_similarity * 100)} %, part de gabarit ${Math.round(cluster.template_ratio * 100)} % :
${pagesBlock}`;

  try {
    const res = await callRoutedAI('content_integrity_qualify', {
      system,
      user,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 300,
      fallbackModel: 'google/gemini-3-flash-preview',
      timeoutMs: 25_000,
    });
    const parsed = JSON.parse(res.content);
    const verdict: Verdict = ['cannibalization', 'watch', 'normal'].includes(parsed.verdict)
      ? parsed.verdict
      : 'watch';
    return {
      cluster_id: cluster.id,
      verdict,
      rationale: String(parsed.rationale || '').slice(0, 300),
      recommended_action: ['merge_and_redirect', 'differentiate', 'enrich', 'none'].includes(
        parsed.recommended_action,
      )
        ? parsed.recommended_action
        : 'differentiate',
    };
  } catch (e) {
    console.warn('[contentIntegrity] LLM qualification failed:', (e as Error).message);
    return null;
  }
}
