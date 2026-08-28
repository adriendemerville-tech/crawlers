/**
 * Scoring déterministe d'un contenu généré par le Content Architect.
 * Aucun appel LLM : uniquement des constats sur le résultat structuré.
 * Les critères évalués dépendent du type de page.
 */

export type ArticleCheckKey =
  | 'structure'
  | 'sources'
  | 'internal_links'
  | 'external_links'
  | 'expert_quotes'
  | 'figures'
  | 'alt_texts'
  | 'semantic_keywords'
  | 'faq'
  | 'meta';

export interface ArticleCheck {
  key: ArticleCheckKey;
  label: string;
  ok: boolean;
  hint: string;
}

export interface ArticleMetric {
  label: string;
  value: string;
}

export interface ArticleScore {
  score: number;
  checks: ArticleCheck[];
  metrics: ArticleMetric[];
}

const LABELS: Record<ArticleCheckKey, string> = {
  structure: 'Structure optimale',
  sources: 'Sources citées',
  internal_links: 'Liens internes',
  external_links: 'Liens externes',
  expert_quotes: "Citations d'experts",
  figures: 'Données chiffrées',
  alt_texts: 'Textes alternatifs',
  semantic_keywords: 'Mots-clés sémantiques',
  faq: 'Section FAQ',
  meta: 'Balises méta',
};

/** Critères retenus selon le type de page. */
const CRITERIA_BY_TYPE: Record<string, ArticleCheckKey[]> = {
  article: ['structure', 'sources', 'internal_links', 'external_links', 'expert_quotes', 'figures', 'alt_texts', 'semantic_keywords', 'faq', 'meta'],
  landing: ['structure', 'internal_links', 'figures', 'alt_texts', 'semantic_keywords', 'faq', 'meta'],
  product: ['structure', 'internal_links', 'figures', 'alt_texts', 'semantic_keywords', 'faq', 'meta'],
  homepage: ['structure', 'internal_links', 'figures', 'alt_texts', 'semantic_keywords', 'meta'],
  category: ['structure', 'internal_links', 'alt_texts', 'semantic_keywords', 'meta'],
  faq: ['structure', 'faq', 'internal_links', 'sources', 'semantic_keywords', 'meta'],
};

function collectBodyText(result: any): string {
  const cs = result?.content_structure || {};
  const sections = Array.isArray(cs.sections) ? cs.sections : [];
  return [
    cs.introduction || '',
    cs.tldr_summary || '',
    ...sections.map((s: any) => `${s?.title || ''} ${s?.body_text || ''}`),
    ...(Array.isArray(cs.faq) ? cs.faq.map((f: any) => `${f?.question || ''} ${f?.answer || ''}`) : []),
  ].join('\n');
}

function collectSources(result: any): any[] {
  const candidates = [
    result?.sources,
    result?.content_structure?.sources,
    result?.metadata_enrichment?.sources,
    result?.eeat_signals?.sources,
  ];
  for (const c of candidates) if (Array.isArray(c) && c.length > 0) return c;
  return [];
}

function collectExternalLinks(result: any): any[] {
  const candidates = [
    result?.external_linking?.recommended_external_links,
    result?.external_linking?.links,
    result?.external_links,
  ];
  for (const c of candidates) if (Array.isArray(c) && c.length > 0) return c;
  return collectSources(result);
}

export function computeArticleScore(result: any, pageType: string): ArticleScore | null {
  if (!result?.content_structure) return null;

  const cs = result.content_structure;
  const hn: any[] = Array.isArray(cs.hn_hierarchy) ? cs.hn_hierarchy : [];
  const h1 = hn.filter(h => h.level === 'h1').length || (cs.recommended_h1 ? 1 : 0);
  const h2 = hn.filter(h => h.level === 'h2').length || (Array.isArray(cs.sections) ? cs.sections.length : 0);
  const body = collectBodyText(result);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const medias: any[] = Array.isArray(cs.media_recommendations) ? cs.media_recommendations : [];
  const internal: any[] = Array.isArray(result.internal_linking?.anchor_strategy) ? result.internal_linking.anchor_strategy : [];
  const internalCount = internal.length || result.internal_linking?.recommended_internal_links || 0;
  const external = collectExternalLinks(result);
  const sources = collectSources(result);
  const faq: any[] = Array.isArray(cs.faq) ? cs.faq : [];
  const ks = result.keyword_strategy || {};
  const semantic = [
    ...(Array.isArray(ks.secondary_keywords) ? ks.secondary_keywords : []),
    ...(Array.isArray(ks.lsi_terms) ? ks.lsi_terms : []),
  ];
  const metaTitle: string = result.seo_metadata?.meta_title || result.metadata_enrichment?.meta_title || '';
  const metaDesc: string = result.seo_metadata?.meta_description || result.metadata_enrichment?.meta_description || '';

  const quoteHits = /(selon\s+[A-ZÉÀ]|d'après\s+[A-ZÉÀ]|«[^»]{20,}»|"[^"]{25,}")/.test(body);
  const figureHits = (body.match(/\b\d{1,3}([.,\s]\d{3})*(\s?%|\s?€|\s?\$)?\b/g) || []).length >= 5;
  const altOk = medias.length > 0 && medias.every((m: any) => (m?.alt || m?.description || '').length >= 15);

  const all: Record<ArticleCheckKey, ArticleCheck> = {
    structure: { key: 'structure', label: LABELS.structure, ok: h1 === 1 && h2 >= 3, hint: 'Un seul H1 et au moins 3 H2' },
    sources: { key: 'sources', label: LABELS.sources, ok: sources.length >= 2, hint: 'Au moins 2 sources référencées' },
    internal_links: { key: 'internal_links', label: LABELS.internal_links, ok: internalCount >= 3, hint: 'Au moins 3 liens internes' },
    external_links: { key: 'external_links', label: LABELS.external_links, ok: external.length >= 2, hint: 'Au moins 2 liens externes de référence' },
    expert_quotes: { key: 'expert_quotes', label: LABELS.expert_quotes, ok: quoteHits, hint: 'Citer un expert ou une déclaration attribuée' },
    figures: { key: 'figures', label: LABELS.figures, ok: figureHits, hint: 'Intégrer des données chiffrées vérifiables' },
    alt_texts: { key: 'alt_texts', label: LABELS.alt_texts, ok: altOk, hint: 'Chaque visuel doit avoir une description exploitable' },
    semantic_keywords: { key: 'semantic_keywords', label: LABELS.semantic_keywords, ok: semantic.length >= 3, hint: 'Au moins 3 mots-clés secondaires ou LSI' },
    faq: { key: 'faq', label: LABELS.faq, ok: faq.length >= 2, hint: 'Au moins 2 questions/réponses' },
    meta: {
      key: 'meta',
      label: LABELS.meta,
      ok: metaTitle.length >= 30 && metaTitle.length <= 65 && metaDesc.length >= 100 && metaDesc.length <= 165,
      hint: 'Title 30–65 car. et description 100–165 car.',
    },
  };

  const keys = CRITERIA_BY_TYPE[pageType] || CRITERIA_BY_TYPE.article;
  const checks = keys.map(k => all[k]);
  const passed = checks.filter(c => c.ok).length;
  const base = Math.round((passed / checks.length) * 92);
  // Bonus de volume : un contenu trop court plafonne le score.
  const volumeBonus = words >= 1500 ? 8 : words >= 900 ? 5 : words >= 500 ? 2 : 0;
  const score = Math.max(0, Math.min(100, base + volumeBonus));

  const metrics: ArticleMetric[] = [
    { label: 'Nombre de mots', value: words.toLocaleString('fr-FR') },
    { label: 'Mots-clés', value: String(semantic.length + (ks.primary_keyword ? 1 : 0)) },
    { label: 'Images', value: String(medias.length) },
    { label: 'Liens internes', value: String(internalCount) },
    { label: 'Liens externes', value: String(external.length) },
  ];

  return { score, checks, metrics };
}
