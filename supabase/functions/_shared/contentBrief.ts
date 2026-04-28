/**
 * ContentBrief — Moteur déterministe de pré-configuration éditoriale
 * 
 * Construit un brief structuré AVANT l'appel LLM.
 * Toutes les variables sont calculées algorithmiquement.
 * Le LLM reçoit le brief et exécute — il ne décide pas de la structure.
 * 
 * Utilisé par :
 * - content-architecture-advisor (Content Architect)
 * - parmenion-orchestrator (Autopilote, phase prescribe contenu)
 */

// ═══ TYPES ═══

export type PageType = 'landing' | 'product' | 'article' | 'homepage' | 'faq' | 'category';

// ═══ ARTICLE TYPE TAXONOMY ═══
// 6 types d'articles de blog avec quotas de distribution

export type ArticleType = 
  | 'presentation'   // Présentation produit/service/outil
  | 'actualite'      // News, tendances, nouveautés sectorielles
  | 'comparatif'     // Comparaisons, vs, benchmarks
  | 'tutoriel'       // Tuto pas-à-pas, how-to
  | 'opinion'        // Avis, décryptage, prise de position
  | 'guide';         // Guide complet/référence

/** Max % par type d'article. Les guides ne doivent pas dépasser 5%. */
export const ARTICLE_TYPE_QUOTAS: Record<ArticleType, { maxPct: number; description: string }> = {
  presentation: { maxPct: 20, description: 'Présentation produit, outil, service' },
  actualite:    { maxPct: 30, description: 'Actualités, tendances, nouveautés du secteur' },
  comparatif:   { maxPct: 20, description: 'Comparatifs, benchmarks, vs' },
  tutoriel:     { maxPct: 25, description: 'Tutoriels pas-à-pas, how-to pratiques' },
  opinion:      { maxPct: 15, description: 'Avis d\'expert, décryptages, prises de position' },
  guide:        { maxPct: 5,  description: 'Guides complets de référence (RARE — max 5%)' },
};

// ═══ SEMANTIC RING SYSTEM (Concentric Expansion) ═══
// Ring 1 = core topic, Ring 2 = second circle, Ring 3+ = broader semantic space

export type SemanticRing = 1 | 2 | 3;

export interface SemanticRingConfig {
  ring: SemanticRing;
  label: string;
  description: string;
  parentLinkingRule: string;
}

export const SEMANTIC_RINGS: Record<SemanticRing, SemanticRingConfig> = {
  1: {
    ring: 1,
    label: 'Cœur de cible',
    description: 'Thématiques directement liées au produit/service principal du site',
    parentLinkingRule: 'Lien vers la homepage ou la landing principale du service',
  },
  2: {
    ring: 2,
    label: 'Second cercle',
    description: 'Thématiques adjacentes qui enrichissent les silos du cœur de cible',
    parentLinkingRule: 'Chaque article DOIT contenir un lien vers un article mère du Ring 1 (même silo)',
  },
  3: {
    ring: 3,
    label: 'Espace sémantique élargi',
    description: 'Thématiques connexes au secteur, autorité topicale large',
    parentLinkingRule: 'Chaque article DOIT contenir un lien vers un article mère du Ring 2, qui lui-même lie vers le Ring 1',
  },
};

/** Detect article type from keyword/title signals */
export function detectArticleType(keyword: string, title: string, description: string): ArticleType {
  const combined = `${keyword} ${title} ${description}`.toLowerCase();
  
  if (combined.match(/comparatif|vs|versus|meilleur|top\s?\d|alternative|concurrent/)) return 'comparatif';
  if (combined.match(/comment|tuto|tutoriel|tutorial|étape|pas.à.pas|how.to|configurer|installer|mettre en place/)) return 'tutoriel';
  if (combined.match(/avis|opinion|décryptage|analyse|notre point|pourquoi.*(bien|mal)|faut-il/)) return 'opinion';
  if (combined.match(/actualit|tendance|nouveaut|mise.à.jour|vient.de|annonce|lancement|\d{4}/)) return 'actualite';
  if (combined.match(/présentation|découvrir|qu.?est.?ce|introduction|fonctionnalit|overview/)) return 'presentation';
  if (combined.match(/guide.complet|guide.ultime|tout.savoir|a.à.z|de.a.à.z/)) return 'guide';
  
  // Default: rotate between high-quota types
  return 'actualite';
}

/** Compute current article type distribution from existing articles */
export interface ArticleDistribution {
  total: number;
  counts: Record<ArticleType, number>;
  percentages: Record<ArticleType, number>;
  recommended: ArticleType;
  overRepresented: ArticleType[];
  saturatedTopics: string[]; // core keyword groups appearing ≥3 times
}

/** Extract core keywords from a title (stop words removed) */
const BRIEF_STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'par',
  'sur', 'avec', 'dans', 'que', 'qui', 'est', 'au', 'aux', 'son', 'ses', 'ce',
  'cette', 'ces', 'ou', 'ne', 'pas', 'plus', 'tout', 'tous', 'votre', 'vos',
  'notre', 'nos', 'comment', 'pourquoi', 'quand', 'guide', 'complet', 'complete',
  'article', 'savoir', 'connaitre', 'comprendre', 'the', 'and', 'for',
]);

function extractBriefCoreTokens(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !BRIEF_STOP_WORDS.has(w));
}

export function computeArticleDistribution(
  existingArticles: { category?: string; tags?: string[]; title?: string }[]
): ArticleDistribution {
  const counts: Record<ArticleType, number> = {
    presentation: 0, actualite: 0, comparatif: 0,
    tutoriel: 0, opinion: 0, guide: 0,
  };
  
  // Track keyword frequency across all titles for topic saturation
  const keywordFreq = new Map<string, number>();

  for (const article of existingArticles) {
    const cat = (article.category || '').toLowerCase();
    const title = (article.title || '').toLowerCase();
    const tags = (article.tags || []).map(t => t.toLowerCase()).join(' ');
    const combined = `${cat} ${title} ${tags}`;
    
    const type = detectArticleType(combined, title, '');
    counts[type]++;

    // Count 2-gram and 3-gram keyword groups for saturation detection
    const tokens = extractBriefCoreTokens(title);
    for (let n = 2; n <= 3 && n <= tokens.length; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const ngram = tokens.slice(i, i + n).sort().join(' ');
        keywordFreq.set(ngram, (keywordFreq.get(ngram) || 0) + 1);
      }
    }
  }
  
  const total = existingArticles.length || 1;
  const percentages = {} as Record<ArticleType, number>;
  const overRepresented: ArticleType[] = [];
  
  for (const [type, count] of Object.entries(counts)) {
    const pct = (count / total) * 100;
    percentages[type as ArticleType] = Math.round(pct);
    if (pct > ARTICLE_TYPE_QUOTAS[type as ArticleType].maxPct) {
      overRepresented.push(type as ArticleType);
    }
  }
  
  // Recommend the most underrepresented type (excluding guide if already at 5%+)
  let recommended: ArticleType = 'actualite';
  let maxDeficit = -Infinity;
  for (const [type, quota] of Object.entries(ARTICLE_TYPE_QUOTAS)) {
    const deficit = quota.maxPct - percentages[type as ArticleType];
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      recommended = type as ArticleType;
    }
  }

  // Detect saturated topics: n-grams appearing ≥3 times
  const saturatedTopics: string[] = [];
  const seen = new Set<string>();
  for (const [ngram, freq] of [...keywordFreq.entries()].sort((a, b) => b[1] - a[1])) {
    if (freq < 3) break;
    // Deduplicate: skip if a longer ngram already covers these tokens
    const tokens = ngram.split(' ');
    if (tokens.some(t => seen.has(t) && saturatedTopics.length > 0)) continue;
    saturatedTopics.push(ngram);
    tokens.forEach(t => seen.add(t));
    if (saturatedTopics.length >= 10) break;
  }
  
  return { total, counts, percentages, recommended, overRepresented, saturatedTopics };
}

/** Determine which semantic ring to target based on existing coverage.
 * 
 * Contraction = recentrage du centre de gravité vers R1, PAS suppression de R2/R3.
 * Le système calcule un centre de gravité moyen pondéré et tend vers R1 en contraction,
 * mais peut toujours produire du R2 pour diversifier et éviter les boucles.
 */
export function determineSemanticRing(
  ringCounts: { ring1: number; ring2: number; ring3: number },
  ring1Threshold: number = 8,
  ring2Threshold: number = 15,
  spiralPhase?: 'contraction' | 'expansion' | 'neutral',
): { ring: SemanticRing; reason: string } {
  const total = ringCounts.ring1 + ringCounts.ring2 + ringCounts.ring3;
  
  // Compute center of gravity (weighted average ring): 1.0 = pure R1, 3.0 = pure R3
  const gravityCenter = total > 0
    ? (ringCounts.ring1 * 1 + ringCounts.ring2 * 2 + ringCounts.ring3 * 3) / total
    : 1.0;

  if (spiralPhase === 'contraction') {
    // Contraction = recentrage vers R1. On ne bloque jamais R2/R3, on ramène le centre de gravité.
    // Si le centre de gravité est déjà bas (< 1.5), on peut se permettre du R2
    if (ringCounts.ring1 < ring1Threshold) {
      return { ring: 1, reason: `Contraction: cœur de cible incomplet (${ringCounts.ring1}/${ring1Threshold}). Centre de gravité: ${gravityCenter.toFixed(2)}. Priorité R1.` };
    }
    // Centre de gravité trop éloigné du cœur → ramener vers R1
    if (gravityCenter > 1.8) {
      return { ring: 1, reason: `Contraction: centre de gravité élevé (${gravityCenter.toFixed(2)}). Recentrage vers R1 pour consolider.` };
    }
    // Centre de gravité acceptable → autoriser R2 pour diversification
    if (ringCounts.ring2 < ring2Threshold) {
      return { ring: 2, reason: `Contraction avec centre de gravité stable (${gravityCenter.toFixed(2)}). R1 solide (${ringCounts.ring1}), diversification R2.` };
    }
    // R1 et R2 bien remplis en contraction → consolider R1
    return { ring: 1, reason: `Contraction: R1 (${ringCounts.ring1}) et R2 (${ringCounts.ring2}) matures. Recentrage R1.` };
  }

  if (spiralPhase === 'expansion') {
    // Expansion: on pousse vers les rings supérieurs
    if (ringCounts.ring1 < ring1Threshold) {
      return { ring: 1, reason: `Expansion mais cœur incomplet (${ringCounts.ring1}/${ring1Threshold}). Fondation R1 d'abord.` };
    }
    if (ringCounts.ring2 < ring2Threshold) {
      return { ring: 2, reason: `Expansion: second cercle en construction (${ringCounts.ring2}/${ring2Threshold}). Enrichir R2.` };
    }
    return { ring: 3, reason: `Expansion sémantique large (R1: ${ringCounts.ring1}, R2: ${ringCounts.ring2}). Centre: ${gravityCenter.toFixed(2)}. Cap R3.` };
  }

  // Neutral phase: standard progression
  if (ringCounts.ring1 < ring1Threshold) {
    return { ring: 1, reason: `Cœur de cible incomplet (${ringCounts.ring1}/${ring1Threshold}). Priorité R1.` };
  }
  if (ringCounts.ring2 < ring2Threshold) {
    return { ring: 2, reason: `Second cercle en construction (${ringCounts.ring2}/${ring2Threshold}). Enrichir R2.` };
  }
  return { ring: 3, reason: `Expansion sémantique large (R1: ${ringCounts.ring1}, R2: ${ringCounts.ring2}). Élargir l'autorité topicale.` };
}

/** Build a prompt block describing article type + ring constraints */
export function buildDiversityPromptBlock(
  distribution: ArticleDistribution,
  ringInfo: { ring: SemanticRing; reason: string },
  parentPages: string[],
): string {
  const ringConfig = SEMANTIC_RINGS[ringInfo.ring];
  const lines: string[] = [];
  
  lines.push(`═══ DIVERSITÉ ÉDITORIALE & EXPANSION SÉMANTIQUE ═══`);
  lines.push('');

  // ── EXCLUSION LISTS (compact, token-efficient) ──
  if (distribution.overRepresented.length > 0 || distribution.saturatedTopics.length > 0) {
    lines.push(`── ⛔ EXCLUSIONS TEMPORAIRES ──`);
    if (distribution.overRepresented.length > 0) {
      lines.push(`TYPES EXCLUS (quota dépassé): ${distribution.overRepresented.join(', ')}`);
    }
    if (distribution.saturatedTopics.length > 0) {
      lines.push(`SUJETS SATURÉS (≥3 articles existants): ${distribution.saturatedTopics.join(', ')}`);
    }
    lines.push(`→ NE PAS créer d'article correspondant à ces types ou sujets.`);
    lines.push(`→ Si le workbench cible un sujet saturé, préfère "update-post" sur un brouillon existant.`);
    lines.push('');
  }

  // Article type distribution
  lines.push(`── TYPES D'ARTICLES (QUOTAS) ──`);
  lines.push(`Distribution actuelle (${distribution.total} articles, publiés + brouillons):`);
  for (const [type, quota] of Object.entries(ARTICLE_TYPE_QUOTAS)) {
    const pct = distribution.percentages[type as ArticleType] || 0;
    const status = pct > quota.maxPct ? '⛔' : pct === 0 ? '🟢' : '✅';
    lines.push(`  ${status} ${type}: ${pct}% (max ${quota.maxPct}%)`);
  }
  lines.push(`✅ TYPE RECOMMANDÉ: ${distribution.recommended}`);
  lines.push('');
  
  // Semantic ring
  lines.push(`── RING ${ringInfo.ring} — ${ringConfig.label.toUpperCase()} ──`);
  lines.push(`${ringInfo.reason}`);
  lines.push(`Maillage: ${ringConfig.parentLinkingRule}`);
  if (parentPages.length > 0) {
    for (const p of parentPages.slice(0, 5)) {
      lines.push(`  → ${p}`);
    }
  }
  lines.push('');

  // Angle diversity
  lines.push(`── ANGLES (alterner obligatoirement) ──`);
  lines.push(`🎯 PERSONA | 📰 ACTUALITÉ | 🔍 NICHE | ⚖️ COMPARATIF | 🛠️ TUTORIEL`);
  lines.push('');
  
  lines.push(`OBLIGATIONS: type="${distribution.recommended}", Ring ${ringInfo.ring}, maillage mère-fille, angle varié, sujet non-saturé.`);
  lines.push(`═══ FIN DIVERSITÉ ═══`);
  
  return lines.join('\n');
}

export type ToneProfile = 
  | 'expert-technique'      // jargon_distance 1-3
  | 'expert-accessible'     // jargon_distance 4-5
  | 'pedagogique'           // jargon_distance 6-7
  | 'grand-public'          // jargon_distance 8-10
  | 'commercial';           // landing/product focus

export type CTAType = 
  | 'demo-request' | 'free-trial' | 'contact-form' | 'newsletter' 
  | 'download' | 'buy-now' | 'quote-request' | 'phone-call'
  | 'read-more' | 'none';

export type SchemaType = 
  | 'Article' | 'Product' | 'FAQPage' | 'HowTo' | 'WebPage' 
  | 'LocalBusiness' | 'Service' | 'BreadcrumbList' | 'SpeakableSpecification';

export interface InternalLink {
  url: string;
  anchor_text?: string;
  reason?: string;
  placement?: string; // section where to insert
}

export interface ContentBrief {
  // ── Structure ──
  page_type: PageType;
  target_length: { min: number; max: number; ideal: number };
  h2_count: { min: number; max: number };
  h3_per_h2: { min: number; max: number };
  include_faq: boolean;
  faq_count: number;
  include_table: boolean;
  include_tldr: boolean;
  include_key_takeaways: boolean;

  // ── Ton & Style ──
  tone: ToneProfile;
  angle: string; // e.g. "guide-pratique", "comparatif", "étude-de-cas"
  perspective: 'first_person' | 'third_person' | 'impersonal';

  // ── CTA ──
  cta_type: CTAType;
  cta_count: number;
  cta_positions: ('intro' | 'mid' | 'conclusion')[];

  // ── Liens internes ──
  internal_links: InternalLink[];
  min_internal_links: number;
  max_internal_links: number;
  external_links_allowed: boolean;
  max_external_links: number;

  // ── SEO ──
  primary_keyword: string;
  secondary_keywords: string[];
  keywords_density_target: number; // percentage, e.g. 1.5
  schema_types: SchemaType[];

  // ── GEO (AI citability) ──
  citable_passages_count: number;
  direct_answer_first_words: number; // e.g. 150 = first 150 words answer the query
  eeat_signals: string[]; // e.g. ["author_bio", "sources", "data_points"]
  authority_outbound_links: number; // recommended count of high-authority external links
  speakable_enabled: boolean; // whether to include SpeakableSpecification schema
  freshness_markers: boolean; // mention year/date

  // ── Metadata ──
  meta_title_max_chars: number;
  meta_description_max_chars: number;

  // ── Computed context ──
  sector: string;
  language: string;
  target_url: string;
  domain: string;

  // ── Voice DNA (editorial identity) ──
  voice_dna?: {
    dominant_register?: string;
    dominant_posture?: string;
    dominant_addressing?: string;
    sentence_style?: string;
    lexical_density?: string;
    emotional_tone?: string;
    sample_excerpts?: string[];
    tone_override?: Record<string, any>;
    forbidden_words?: string[];
    mandatory_words?: string[];
  };
}

// ═══ CONFIGURATION PAR TYPE DE PAGE ═══

interface PageTypeConfig {
  length: { min: number; max: number; ideal: number };
  h2: { min: number; max: number };
  h3_per_h2: { min: number; max: number };
  faq: boolean;
  faq_count: number;
  table: boolean;
  tldr: boolean;
  key_takeaways: boolean;
  citable_passages: number;
  direct_answer_words: number;
  default_angle: string;
  default_cta: CTAType;
  cta_count: number;
  cta_positions: ('intro' | 'mid' | 'conclusion')[];
  schemas: SchemaType[];
  min_internal_links: number;
  max_internal_links: number;
  external_links: boolean;
  max_external_links: number;
  kw_density: number;
}

const PAGE_TYPE_CONFIGS: Record<PageType, PageTypeConfig> = {
  article: {
    length: { min: 1800, max: 3000, ideal: 2200 },
    h2: { min: 4, max: 8 },
    h3_per_h2: { min: 1, max: 3 },
    faq: true, faq_count: 4,
    table: true, tldr: true, key_takeaways: true,
    citable_passages: 6,
    direct_answer_words: 150,
    default_angle: 'guide-pratique',
    default_cta: 'read-more', cta_count: 2, cta_positions: ['mid', 'conclusion'],
    schemas: ['Article', 'FAQPage', 'BreadcrumbList', 'SpeakableSpecification'],
    min_internal_links: 5, max_internal_links: 12,
    external_links: true, max_external_links: 3,
    kw_density: 1.2,
  },
  landing: {
    length: { min: 1200, max: 2000, ideal: 1500 },
    h2: { min: 3, max: 6 },
    h3_per_h2: { min: 1, max: 2 },
    faq: true, faq_count: 5,
    table: false, tldr: false, key_takeaways: false,
    citable_passages: 4,
    direct_answer_words: 100,
    default_angle: 'proposition-de-valeur',
    default_cta: 'demo-request', cta_count: 3, cta_positions: ['intro', 'mid', 'conclusion'],
    schemas: ['WebPage', 'Service', 'FAQPage', 'BreadcrumbList', 'SpeakableSpecification'],
    min_internal_links: 3, max_internal_links: 8,
    external_links: false, max_external_links: 1,
    kw_density: 1.5,
  },
  product: {
    length: { min: 800, max: 1500, ideal: 1100 },
    h2: { min: 3, max: 5 },
    h3_per_h2: { min: 1, max: 2 },
    faq: true, faq_count: 3,
    table: true, tldr: false, key_takeaways: true,
    citable_passages: 3,
    direct_answer_words: 80,
    default_angle: 'fiche-technique',
    default_cta: 'buy-now', cta_count: 2, cta_positions: ['intro', 'conclusion'],
    schemas: ['Product', 'FAQPage', 'BreadcrumbList'],
    min_internal_links: 3, max_internal_links: 6,
    external_links: false, max_external_links: 1,
    kw_density: 1.8,
  },
  homepage: {
    length: { min: 600, max: 1200, ideal: 800 },
    h2: { min: 3, max: 5 },
    h3_per_h2: { min: 0, max: 2 },
    faq: false, faq_count: 0,
    table: false, tldr: false, key_takeaways: false,
    citable_passages: 2,
    direct_answer_words: 60,
    default_angle: 'presentation-generale',
    default_cta: 'demo-request', cta_count: 2, cta_positions: ['intro', 'conclusion'],
    schemas: ['WebPage', 'BreadcrumbList'],
    min_internal_links: 5, max_internal_links: 15,
    external_links: false, max_external_links: 0,
    kw_density: 1.0,
  },
  faq: {
    length: { min: 1500, max: 2500, ideal: 1800 },
    h2: { min: 5, max: 15 },
    h3_per_h2: { min: 0, max: 1 },
    faq: true, faq_count: 10,
    table: false, tldr: true, key_takeaways: false,
    citable_passages: 10,
    direct_answer_words: 50,
    default_angle: 'reponses-experts',
    default_cta: 'contact-form', cta_count: 1, cta_positions: ['conclusion'],
    schemas: ['FAQPage', 'BreadcrumbList'],
    min_internal_links: 5, max_internal_links: 10,
    external_links: true, max_external_links: 2,
    kw_density: 1.0,
  },
  category: {
    length: { min: 400, max: 800, ideal: 600 },
    h2: { min: 2, max: 4 },
    h3_per_h2: { min: 0, max: 1 },
    faq: false, faq_count: 0,
    table: false, tldr: false, key_takeaways: false,
    citable_passages: 1,
    direct_answer_words: 50,
    default_angle: 'navigation',
    default_cta: 'none', cta_count: 0, cta_positions: [],
    schemas: ['WebPage', 'BreadcrumbList'],
    min_internal_links: 5, max_internal_links: 20,
    external_links: false, max_external_links: 0,
    kw_density: 1.0,
  },
};

// ═══ TONE FROM JARGON DISTANCE ═══

function resolveTone(jargonDistance: number | null, pageType: PageType): ToneProfile {
  if (pageType === 'landing' || pageType === 'product') return 'commercial';
  if (!jargonDistance) return 'expert-accessible';
  if (jargonDistance <= 3) return 'expert-technique';
  if (jargonDistance <= 5) return 'expert-accessible';
  if (jargonDistance <= 7) return 'pedagogique';
  return 'grand-public';
}

// ═══ ANGLE DETECTION ═══

function detectAngle(
  pageType: PageType,
  keyword: string,
  title: string,
  category: string,
): string {
  const combined = `${keyword} ${title} ${category}`.toLowerCase();
  
  if (pageType === 'article') {
    if (combined.match(/comment|how to|tutoriel|tutorial|étape/)) return 'guide-pratique';
    if (combined.match(/comparatif|vs|versus|meilleur|top/)) return 'comparatif';
    if (combined.match(/erreur|piège|éviter|mistake/)) return 'erreurs-a-eviter';
    if (combined.match(/cas|exemple|témoignage|success/)) return 'etude-de-cas';
    if (combined.match(/definition|qu.?est.?ce|c.?est quoi/)) return 'definition-experte';
    if (combined.match(/tendance|futur|prévision|2026|2027/)) return 'prospective';
  }
  if (pageType === 'product') {
    if (combined.match(/avis|review|test/)) return 'test-produit';
    if (combined.match(/prix|tarif|cout/)) return 'grille-tarifaire';
  }
  if (pageType === 'landing') {
    if (combined.match(/devis|estimation|simulat/)) return 'outil-interactif';
    if (combined.match(/agence|cabinet|expert/)) return 'expertise-sectorielle';
  }

  return PAGE_TYPE_CONFIGS[pageType]?.default_angle || 'general';
}

// ═══ CTA DETECTION ═══

export type SiteBusinessModelLite =
  | 'saas_b2b' | 'saas_b2c'
  | 'marketplace_b2b' | 'marketplace_b2c' | 'marketplace_b2b2c'
  | 'ecommerce_b2c' | 'ecommerce_b2b'
  | 'media_publisher' | 'service_local' | 'service_agency'
  | 'leadgen' | 'nonprofit';

function detectCTA(
  pageType: PageType,
  sector: string,
  keyword: string,
  businessModel?: SiteBusinessModelLite | null,
): CTAType {
  const combined = `${sector} ${keyword}`.toLowerCase();

  // ── Business model takes priority over heuristics ──
  if (businessModel) {
    if (pageType === 'product' || pageType === 'landing') {
      switch (businessModel) {
        case 'saas_b2b':         return 'demo-request';
        case 'saas_b2c':         return 'free-trial';
        case 'marketplace_b2b':
        case 'marketplace_b2c':
        case 'marketplace_b2b2c': return 'browse-catalog' as CTAType;
        case 'ecommerce_b2c':    return 'buy-now';
        case 'ecommerce_b2b':    return 'quote-request';
        case 'service_local':    return 'book-appointment' as CTAType;
        case 'service_agency':   return 'contact-form';
        case 'leadgen':          return 'download';
        case 'media_publisher':  return 'newsletter';
        case 'nonprofit':        return 'donate' as CTAType;
      }
    }
    if (pageType === 'article') {
      switch (businessModel) {
        case 'saas_b2b':         return 'demo-request';
        case 'saas_b2c':         return 'free-trial';
        case 'leadgen':          return 'download';
        case 'media_publisher':  return 'newsletter';
        case 'nonprofit':        return 'donate' as CTAType;
        case 'ecommerce_b2c':
        case 'ecommerce_b2b':    return 'browse-catalog' as CTAType;
        default:                 return 'newsletter';
      }
    }
  }

  // ── Legacy fallback ──
  if (pageType === 'product') {
    if (combined.match(/saas|logiciel|outil|plateforme/)) return 'free-trial';
    return 'buy-now';
  }
  if (pageType === 'landing') {
    if (combined.match(/b2b|entreprise|service|agence/)) return 'demo-request';
    if (combined.match(/devis|estimation/)) return 'quote-request';
    return 'contact-form';
  }
  if (pageType === 'article') {
    if (combined.match(/guide|ebook|livre blanc|checklist/)) return 'download';
    return 'newsletter';
  }

  return PAGE_TYPE_CONFIGS[pageType]?.default_cta || 'contact-form';
}

// ═══ E-E-A-T SIGNALS ═══

function resolveEEATSignals(pageType: PageType, sector: string): string[] {
  const signals: string[] = ['freshness_date'];
  
  // Every content page should cite sources
  if (pageType === 'article' || pageType === 'faq') {
    signals.push('author_bio', 'sources_cited', 'data_points', 'expert_quotes');
  }
  if (pageType === 'product') {
    signals.push('specifications', 'user_reviews_summary', 'comparison_data');
  }
  if (pageType === 'landing') {
    signals.push('client_logos', 'testimonials', 'certifications', 'case_study_reference');
  }

  // YMYL sectors need stronger signals
  const ymyl = /santé|health|finance|juridique|legal|assurance|médical|pharmacie/i;
  if (ymyl.test(sector)) {
    signals.push('professional_credentials', 'regulatory_references', 'disclaimer');
  }

  return signals;
}

// ═══ INTERNAL LINKS FROM COCOON ═══

interface CocoonLink {
  url: string;
  anchor_text?: string;
  reason?: string;
}

async function resolveInternalLinks(
  supabase: any,
  domain: string,
  trackedSiteId: string,
  pageType: PageType,
  keyword: string,
): Promise<InternalLink[]> {
  const links: InternalLink[] = [];

  try {
    // 1. Cocoon auto-links (pre-computed by the linking engine)
    const { data: autoLinks } = await supabase
      .from('cocoon_auto_links')
      .select('target_url, anchor_text, context_sentence')
      .eq('tracked_site_id', trackedSiteId)
      .eq('is_active', true)
      .limit(15);

    if (autoLinks?.length) {
      for (const link of autoLinks) {
        links.push({
          url: link.target_url,
          anchor_text: link.anchor_text,
          reason: 'cocoon_auto_link',
        });
      }
    }

    // 2. Recent cocoon session nodes (cluster pages for silo reinforcement)
    const { data: sessions } = await supabase
      .from('cocoon_sessions')
      .select('nodes_snapshot, cluster_summary')
      .eq('tracked_site_id', trackedSiteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessions?.nodes_snapshot && Array.isArray(sessions.nodes_snapshot)) {
      const clusterPages = sessions.nodes_snapshot
        .filter((n: any) => n.url && n.pagerank_score > 0)
        .sort((a: any, b: any) => (b.pagerank_score || 0) - (a.pagerank_score || 0))
        .slice(0, 5);

      for (const node of clusterPages) {
        if (!links.some(l => l.url === node.url)) {
          links.push({
            url: node.url,
            anchor_text: node.suggested_anchor || node.title,
            reason: 'silo_reinforcement',
          });
        }
      }
    }
  } catch (e) {
    console.warn('[contentBrief] Internal links resolution failed:', e);
  }

  const config = PAGE_TYPE_CONFIGS[pageType];
  return links.slice(0, config.max_internal_links);
}

// ═══ MAIN BUILDER ═══

export interface BuildContentBriefInput {
  page_type: PageType;
  keyword: string;
  target_url: string;
  domain: string;
  tracked_site_id: string;
  // Optional context
  title?: string;
  finding_category?: string;
  sector?: string;
  jargon_distance?: number | null;
  language?: string;
  secondary_keywords?: string[];
  // Voice DNA from tracked_sites
  voice_dna?: any;
  // Supabase client for internal links resolution
  supabase?: any;
}

export async function buildContentBrief(input: BuildContentBriefInput): Promise<ContentBrief> {
  const {
    page_type, keyword, target_url, domain, tracked_site_id,
    title = '', finding_category = '', sector = '',
    jargon_distance = null, language = 'fr',
    secondary_keywords = [],
  } = input;

  const config = PAGE_TYPE_CONFIGS[page_type] || PAGE_TYPE_CONFIGS.article;

  // Resolve tone from jargon distance
  const tone = resolveTone(jargon_distance, page_type);

  // Detect angle from keyword + context
  const angle = detectAngle(page_type, keyword, title, finding_category);

  // Detect CTA
  const ctaType = detectCTA(page_type, sector, keyword);

  // E-E-A-T signals
  const eeatSignals = resolveEEATSignals(page_type, sector);

  // Internal links (async, requires supabase)
  let internalLinks: InternalLink[] = [];
  if (input.supabase && tracked_site_id) {
    internalLinks = await resolveInternalLinks(input.supabase, domain, tracked_site_id, page_type, keyword);
  }

  return {
    page_type,
    target_length: config.length,
    h2_count: config.h2,
    h3_per_h2: config.h3_per_h2,
    include_faq: config.faq,
    faq_count: config.faq_count,
    include_table: config.table,
    include_tldr: config.tldr,
    include_key_takeaways: config.key_takeaways,

    tone,
    angle,
    perspective: page_type === 'article' ? 'impersonal' : 'first_person',

    cta_type: ctaType,
    cta_count: config.cta_count,
    cta_positions: config.cta_positions,

    internal_links: internalLinks,
    min_internal_links: config.min_internal_links,
    max_internal_links: config.max_internal_links,
    external_links_allowed: config.external_links,
    max_external_links: config.max_external_links,

    primary_keyword: keyword,
    secondary_keywords,
    keywords_density_target: config.kw_density,
    schema_types: config.schemas,

    citable_passages_count: config.citable_passages,
    direct_answer_first_words: config.direct_answer_words,
    eeat_signals: eeatSignals,
    authority_outbound_links: config.external_links ? Math.min(config.max_external_links, 3) : 0,
    speakable_enabled: config.schemas.includes('SpeakableSpecification' as any),
    freshness_markers: true,

    meta_title_max_chars: 60,
    meta_description_max_chars: 155,

    sector,
    language,
    target_url,
    domain,

    // Voice DNA injection
    voice_dna: input.voice_dna ? {
      dominant_register: input.voice_dna.dominant_register,
      dominant_posture: input.voice_dna.dominant_posture,
      dominant_addressing: input.voice_dna.dominant_addressing,
      sentence_style: input.voice_dna.sentence_style,
      lexical_density: input.voice_dna.lexical_density,
      emotional_tone: input.voice_dna.emotional_tone,
      sample_excerpts: (input.voice_dna.sample_excerpts || []).slice(0, 2),
      tone_override: input.voice_dna.tone_overrides?.[page_type] || undefined,
      forbidden_words: input.voice_dna.forbidden_words,
      mandatory_words: input.voice_dna.mandatory_words,
    } : undefined,
  };
}

// ═══ BRIEF → PROMPT BLOCK ═══

export function briefToPromptBlock(brief: ContentBrief): string {
  const lines: string[] = [];

  lines.push(`═══ CONTENT BRIEF (CONTRAINTES OBLIGATOIRES) ═══`);
  lines.push('');
  lines.push(`TYPE: ${brief.page_type.toUpperCase()} | ANGLE: ${brief.angle} | TON: ${brief.tone}`);
  lines.push(`LANGUE: ${brief.language} | SECTEUR: ${brief.sector || 'non spécifié'}`);
  lines.push('');

  // Structure
  lines.push(`── STRUCTURE ──`);
  lines.push(`Longueur: ${brief.target_length.min}-${brief.target_length.max} mots (idéal: ${brief.target_length.ideal})`);
  lines.push(`H2: ${brief.h2_count.min}-${brief.h2_count.max} sections | H3 par H2: ${brief.h3_per_h2.min}-${brief.h3_per_h2.max}`);
  if (brief.include_faq) lines.push(`FAQ: OUI, ${brief.faq_count} questions (formulées comme un utilisateur poserait à un LLM)`);
  if (brief.include_table) lines.push(`Tableau comparatif: OUI (au moins 1)`);
  if (brief.include_tldr) lines.push(`TL;DR: OUI (résumé en 2-3 phrases en début ou fin)`);
  if (brief.include_key_takeaways) lines.push(`Points clés: OUI (encadré récapitulatif)`);
  lines.push(`Perspective: ${brief.perspective === 'first_person' ? '1ère personne (nous)' : brief.perspective === 'impersonal' ? 'Impersonnel' : '3ème personne'}`);
  lines.push('');

  // CTA
  if (brief.cta_type !== 'none') {
    lines.push(`── CTA ──`);
    lines.push(`Type: ${brief.cta_type} | Nombre: ${brief.cta_count} | Positions: ${brief.cta_positions.join(', ')}`);
    lines.push('');
  }

  // Links
  lines.push(`── LIENS INTERNES ──`);
  lines.push(`Min: ${brief.min_internal_links} | Max: ${brief.max_internal_links}`);
  if (brief.internal_links.length > 0) {
    lines.push(`Liens pré-calculés à intégrer:`);
    for (const link of brief.internal_links.slice(0, 10)) {
      lines.push(`  → ${link.url}${link.anchor_text ? ` (ancre: "${link.anchor_text}")` : ''}${link.reason ? ` [${link.reason}]` : ''}`);
    }
  }
  if (brief.external_links_allowed) {
    lines.push(`Liens externes: autorisés (max ${brief.max_external_links})`);
  } else {
    lines.push(`Liens externes: NON autorisés`);
  }
  lines.push('');

  // SEO
  lines.push(`── SEO ──`);
  lines.push(`Mot-clé principal: "${brief.primary_keyword}"`);
  if (brief.secondary_keywords.length > 0) {
    lines.push(`Mots-clés secondaires: ${brief.secondary_keywords.join(', ')}`);
  }
  lines.push(`Densité cible: ~${brief.keywords_density_target}%`);
  lines.push(`Schemas JSON-LD: ${brief.schema_types.join(', ')}`);
  lines.push(`Meta title: max ${brief.meta_title_max_chars} caractères | Meta description: max ${brief.meta_description_max_chars} caractères`);
  lines.push('');

  // GEO
  lines.push(`── GEO (CITABILITÉ IA) ──`);
  lines.push(`Passages citables: ${brief.citable_passages_count} (1 par H2, 40-80 mots, autonome, encadrés dans <blockquote class="citable-passage">)`);
  lines.push(`Réponse directe: les ${brief.direct_answer_first_words} premiers mots RÉPONDENT à l'intention`);
  lines.push(`Signaux E-E-A-T obligatoires: ${brief.eeat_signals.join(', ')}`);
  if (brief.speakable_enabled) {
    lines.push(`SpeakableSpecification: OUI — Ajouter le schema JSON-LD SpeakableSpecification ciblant h1, .citable-passage et le 1er paragraphe`);
  }
  if (brief.authority_outbound_links > 0) {
    lines.push(`Liens d'autorité externes: ${brief.authority_outbound_links} liens vers des sources autoritaires (Google, Schema.org, études officielles, documentation W3C)`);
    lines.push(`  → Chaque lien externe doit pointer vers une page spécifique (pas un domaine racine) et être contextuellement pertinent`);
  }
  if (brief.freshness_markers) lines.push(`Fraîcheur: mentionner l'année en cours, dater les informations`);
  lines.push('');

  // Voice DNA
  if (brief.voice_dna) {
    const v = brief.voice_dna;
    lines.push(`── VOICE DNA (IDENTITÉ ÉDITORIALE — OBLIGATOIRE) ──`);
    if (v.dominant_register) lines.push(`Registre: ${v.dominant_register}`);
    if (v.dominant_posture) lines.push(`Posture: ${v.dominant_posture}`);
    if (v.dominant_addressing) lines.push(`Adresse: ${v.dominant_addressing}`);
    if (v.sentence_style) lines.push(`Style de phrases: ${v.sentence_style}`);
    if (v.lexical_density) lines.push(`Densité lexicale: ${v.lexical_density}`);
    if (v.emotional_tone) lines.push(`Tonalité émotionnelle: ${v.emotional_tone}`);
    if (v.tone_override) {
      lines.push(`⚠️ OVERRIDE pour ce type de page: ${JSON.stringify(v.tone_override)}`);
    }
    if (v.forbidden_words?.length) {
      lines.push(`MOTS INTERDITS (ne jamais utiliser): ${v.forbidden_words.join(', ')}`);
    }
    if (v.mandatory_words?.length) {
      lines.push(`MOTS OBLIGATOIRES (à placer naturellement): ${v.mandatory_words.join(', ')}`);
    }
    if (v.sample_excerpts?.length) {
      lines.push(`Exemples de référence du ton attendu:`);
      for (const ex of v.sample_excerpts) {
        lines.push(`  « ${ex.slice(0, 200)}… »`);
      }
    }
    lines.push(`Tu DOIS respecter cette identité éditoriale. Le contenu doit sonner comme s'il venait du même auteur.`);
    lines.push('');
  }

  lines.push(`═══ FIN CONTENT BRIEF ═══`);

  return lines.join('\n');
}

// ═══ PAGE TYPE DETECTION (shared) ═══

export function detectPageType(item: {
  target_url?: string;
  finding_category?: string;
  title?: string;
  description?: string;
  target_operation?: string;
}): PageType {
  const url = (item.target_url || '').toLowerCase();
  const cat = (item.finding_category || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const op = (item.target_operation || '').toLowerCase();
  const combined = `${url} ${cat} ${title} ${desc}`;

  // 1. Workbench category signals (priority)
  if (['content_gap', 'content_freshness', 'missing_terms'].includes(cat) && op === 'create') return 'article';
  if (cat === 'missing_page' && (combined.includes('guide') || combined.includes('article') || combined.includes('blog'))) return 'article';
  if (cat === 'missing_page' && (combined.includes('landing') || combined.includes('service') || combined.includes('offre'))) return 'landing';
  if (cat === 'content_upgrade' && (combined.includes('produit') || combined.includes('product') || combined.includes('fiche'))) return 'product';

  // 2. URL pattern detection
  if (/\/(blog|article|actualite|guide|conseil|tutoriel)/.test(url)) return 'article';
  if (/\/(produit|product|shop|boutique|fiche|item)/.test(url)) return 'product';
  if (/\/(landing|lp-|offre|solution|service|decouvrir|essai)/.test(url)) return 'landing';
  if (/\/(faq|questions|aide|help)/.test(url)) return 'faq';
  if (/\/(categorie|category|collection|rayon)/.test(url)) return 'category';

  // 3. Intent signals
  if (combined.match(/comment|pourquoi|guide|tutoriel|conseils|erreurs/)) return 'article';
  if (combined.match(/acheter|prix|avis|livraison|stock|fiche produit/)) return 'product';
  if (combined.match(/conversion|signup|demo|essai|devis|offre/)) return 'landing';
  if (combined.match(/faq|question|aide/)) return 'faq';

  // 4. Default based on operation
  if (op === 'create') return 'article';
  return 'article';
}
