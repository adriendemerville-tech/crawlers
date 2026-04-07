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
  | 'LocalBusiness' | 'Service' | 'BreadcrumbList';

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
    schemas: ['Article', 'FAQPage', 'BreadcrumbList'],
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
    schemas: ['WebPage', 'Service', 'FAQPage', 'BreadcrumbList'],
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

function detectCTA(pageType: PageType, sector: string, keyword: string): CTAType {
  const combined = `${sector} ${keyword}`.toLowerCase();
  
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
  lines.push(`Passages citables: ${brief.citable_passages_count} (1 par H2, 40-80 mots, autonome)`);
  lines.push(`Réponse directe: les ${brief.direct_answer_first_words} premiers mots RÉPONDENT à l'intention`);
  lines.push(`Signaux E-E-A-T obligatoires: ${brief.eeat_signals.join(', ')}`);
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
