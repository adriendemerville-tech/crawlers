/**
 * contentIntegrity/thinContent.ts
 *
 * Score composite de "minceur" du contenu — remplace le seuil fixe
 * word_count < 100. 100 % déterministe, 0 token.
 *
 * thin_score : 0 (contenu riche) → 100 (contenu très pauvre).
 */

import type { NormalizedPage } from './normalize.ts';

export type PageKind =
  | 'article'
  | 'product'
  | 'category'
  | 'local'
  | 'landing'
  | 'conversion'
  | 'other';

/**
 * Nombre de mots utiles considéré comme suffisant, par type de page.
 * `conversion` = page volontairement courte (contact, devis, démo, essai) :
 * son objectif est l'action, pas le volume rédactionnel.
 */
const IDEAL_WORDS: Record<PageKind, number> = {
  article: 900,
  product: 250,
  category: 200,
  local: 350,
  landing: 500,
  conversion: 150,
  other: 400,
};

/** Seuil de thin_score au-delà duquel la page est signalée. */
const THIN_THRESHOLD: Record<PageKind, number> = {
  article: 60,
  product: 70,
  category: 75,
  local: 65,
  landing: 65,
  conversion: 85,
  other: 65,
};

export interface ThinContentInput {
  url: string;
  kind: PageKind;
  htmlSizeBytes?: number | null;
  h2Count?: number | null;
  h3Count?: number | null;
  internalLinks?: number | null;
  crawlDepth?: number | null;
  isIndexable?: boolean | null;
  /** Formulaire détecté sur la page (signal d'intention de conversion). */
  hasForm?: boolean | null;
  /** Nombre d'appels à l'action détectés. */
  ctaCount?: number | null;
}

export interface ThinContentResult {
  url: string;
  thin_score: number;
  is_thin: boolean;
  useful_words: number;
  text_to_html_ratio: number;
  template_ratio: number;
  kind: PageKind;
  reasons: string[];
}

export function scoreThinContent(
  normalized: NormalizedPage,
  input: ThinContentInput,
): ThinContentResult {
  const reasons: string[] = [];
  const ideal = IDEAL_WORDS[input.kind] ?? IDEAL_WORDS.other;

  // 1. Manque de mots utiles (0-100) — pondération 50 %
  // Une page de conversion (formulaire + CTA) est courte par intention : son
  // déficit de mots est minoré, on ne la traite pas comme un contenu pauvre.
  const conversionIntent =
    (input.kind === 'conversion' || input.kind === 'landing')
    && (input.hasForm === true || (input.ctaCount || 0) >= 1);
  const rawWordDeficit = Math.max(0, Math.min(1, 1 - normalized.usefulWords / ideal));
  const wordDeficit = conversionIntent ? rawWordDeficit * 0.5 : rawWordDeficit;
  if (conversionIntent && rawWordDeficit > 0.5) {
    reasons.push('page d\'intention conversion (formulaire/CTA) — volume rédactionnel court assumé');
  } else if (normalized.usefulWords < ideal * 0.35) {
    reasons.push(`contenu utile faible (${normalized.usefulWords} mots pour ~${ideal} attendus)`);
  }

  // 2. Ratio texte/HTML — pondération 15 %
  const bytes = input.htmlSizeBytes && input.htmlSizeBytes > 0 ? input.htmlSizeBytes : null;
  const textBytes = normalized.tokens.join(' ').length;
  const textToHtml = bytes ? Math.min(1, textBytes / bytes) : 0.25;
  const ratioDeficit = Math.max(0, Math.min(1, (0.15 - textToHtml) / 0.15));
  if (bytes && textToHtml < 0.05) reasons.push('ratio texte/HTML très faible');

  // 3. Part de gabarit — pondération 20 %
  const templateDeficit = Math.max(0, Math.min(1, (normalized.templateRatio - 0.4) / 0.6));
  if (normalized.templateRatio > 0.7) reasons.push('page majoritairement composée de gabarit');

  // 4. Structure éditoriale absente — pondération 15 %
  const headings = (input.h2Count || 0) + (input.h3Count || 0);
  const structureDeficit = headings === 0 ? 1 : headings === 1 ? 0.5 : 0;
  if (headings === 0 && input.kind === 'article') reasons.push('aucun sous-titre H2/H3');

  const raw =
    wordDeficit * 50 + ratioDeficit * 15 + templateDeficit * 20 + structureDeficit * 15;
  const thinScore = Math.round(Math.max(0, Math.min(100, raw)));

  const isThin =
    input.isIndexable !== false && thinScore >= (THIN_THRESHOLD[input.kind] ?? 65);

  return {
    url: normalized.url,
    thin_score: thinScore,
    is_thin: isThin,
    useful_words: normalized.usefulWords,
    text_to_html_ratio: Math.round(textToHtml * 1000) / 1000,
    template_ratio: normalized.templateRatio,
    kind: input.kind,
    reasons,
  };
}

/** Heuristique de type de page (URL + signaux crawl), sans LLM. */
export function inferPageKind(page: {
  url: string;
  path?: string | null;
  schemaOrgTypes?: string[] | null;
  pageIntent?: string | null;
}): PageKind {
  const path = (page.path || page.url || '').toLowerCase();
  const types = (page.schemaOrgTypes || []).map((t) => t.toLowerCase());

  if (types.includes('product') || /\/(produit|product|shop|boutique)\//.test(path)) return 'product';
  if (types.includes('localbusiness') || /\/(agence|ville|city|magasin|store)\//.test(path)) return 'local';
  if (types.some((t) => t.includes('article') || t === 'blogposting')) return 'article';
  if (/\/(blog|article|actualite|news|guide|lexique|ressource)/.test(path)) return 'article';
  if (/\/(categorie|category|collection|tag|rubrique)\//.test(path)) return 'category';
  if (/\/(contact|devis|demo|démo|essai|rendez-vous|rdv|inscription|signup|demander)/.test(path)) {
    return 'conversion';
  }
  if (page.pageIntent === 'buy' || /\/(offre|tarif|pricing|solution)/.test(path)) return 'landing';
  return 'other';
}
