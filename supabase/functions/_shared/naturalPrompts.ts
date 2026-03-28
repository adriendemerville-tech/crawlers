/**
 * _shared/naturalPrompts.ts
 * 
 * Centralized natural prompt generation for LLM visibility testing.
 * Prompts NEVER mention the brand or domain — citation is detected in post-processing.
 * 
 * Consumers: check-llm, llm-visibility-lite, calculate-llm-visibility
 */

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface SiteContext {
  market_sector?: string;
  products_services?: string;
  target_audience?: string;
  commercial_area?: string;
  entity_type?: string;         // 'business' | 'media' | 'blog' | 'ecommerce' | 'saas'
  media_specialties?: string[];
  founding_year?: number;
}

export type PromptLang = 'fr' | 'en' | 'es';

export interface NaturalPromptsOptions {
  /** Site context from tracked_sites / identity card */
  site?: SiteContext;
  /** Language for prompts */
  lang?: PromptLang;
  /** Max number of prompts to generate */
  maxPrompts?: number;
  /** Current month (1-12), auto-detected if not provided */
  currentMonth?: number;
  /** Domain name (used ONLY for sector inference when no site context) */
  domain?: string;
}

export interface GeneratedPrompts {
  /** Initial prompts (no brand mention) */
  prompts: string[];
  /** Follow-up prompts for multi-turn conversations */
  followUps: string[];
}

// ═══════════════════════════════════════════════
// Seasonality mapping
// ═══════════════════════════════════════════════

const SEASONAL_CONTEXT_FR: Record<number, string[]> = {
  1:  ['pour bien démarrer l\'année', 'en ce début d\'année'],
  2:  ['en ce moment', 'pour ce trimestre'],
  3:  ['pour le printemps', 'en ce moment'],
  4:  ['pour le printemps', 'en ce moment'],
  5:  ['avant l\'été', 'pour les prochains mois'],
  6:  ['pour cet été', 'avant les vacances'],
  7:  ['cet été', 'en ce moment'],
  8:  ['pour la rentrée', 'avant septembre'],
  9:  ['pour la rentrée', 'en cette rentrée'],
  10: ['pour cette fin d\'année', 'avant les fêtes'],
  11: ['avant les fêtes', 'pour le Black Friday'],
  12: ['pour les fêtes', 'avant la nouvelle année'],
};

const SEASONAL_CONTEXT_EN: Record<number, string[]> = {
  1:  ['to start the year right', 'this quarter'],
  2:  ['right now', 'this quarter'],
  3:  ['for spring', 'right now'],
  4:  ['for spring', 'right now'],
  5:  ['before summer', 'for the coming months'],
  6:  ['for this summer', 'before vacation'],
  7:  ['this summer', 'right now'],
  8:  ['for back-to-school', 'before September'],
  9:  ['for this fall', 'this season'],
  10: ['for the end of year', 'before the holidays'],
  11: ['for Black Friday', 'before the holidays'],
  12: ['for the holidays', 'before the new year'],
};

const SEASONAL_CONTEXT_ES: Record<number, string[]> = {
  1:  ['para empezar el año', 'en este trimestre'],
  2:  ['ahora mismo', 'en este trimestre'],
  3:  ['para la primavera', 'ahora mismo'],
  4:  ['para la primavera', 'ahora mismo'],
  5:  ['antes del verano', 'para los próximos meses'],
  6:  ['para este verano', 'antes de vacaciones'],
  7:  ['este verano', 'ahora mismo'],
  8:  ['para la vuelta al cole', 'antes de septiembre'],
  9:  ['para este otoño', 'esta temporada'],
  10: ['para fin de año', 'antes de las fiestas'],
  11: ['para Black Friday', 'antes de las fiestas'],
  12: ['para las fiestas', 'antes del año nuevo'],
};

function getSeasonalContext(lang: PromptLang, month: number): string {
  const maps = { fr: SEASONAL_CONTEXT_FR, en: SEASONAL_CONTEXT_EN, es: SEASONAL_CONTEXT_ES };
  const options = maps[lang][month] || maps[lang][1];
  return options[Math.floor(Math.random() * options.length)];
}

// ═══════════════════════════════════════════════
// Domain-based sector inference (fallback)
// ═══════════════════════════════════════════════

const DOMAIN_SECTOR_HINTS: Record<string, { fr: string; en: string; es: string }> = {
  consult:  { fr: 'conseil et consulting', en: 'consulting', es: 'consultoría' },
  avocat:   { fr: 'droit et services juridiques', en: 'legal services', es: 'servicios legales' },
  law:      { fr: 'droit et services juridiques', en: 'legal services', es: 'servicios legales' },
  immo:     { fr: 'immobilier', en: 'real estate', es: 'inmobiliaria' },
  realt:    { fr: 'immobilier', en: 'real estate', es: 'inmobiliaria' },
  auto:     { fr: 'automobile', en: 'automotive', es: 'automoción' },
  tech:     { fr: 'technologie', en: 'technology', es: 'tecnología' },
  design:   { fr: 'design et création', en: 'design', es: 'diseño' },
  market:   { fr: 'marketing digital', en: 'digital marketing', es: 'marketing digital' },
  compta:   { fr: 'comptabilité et finance', en: 'accounting', es: 'contabilidad' },
  account:  { fr: 'comptabilité et finance', en: 'accounting', es: 'contabilidad' },
  archi:    { fr: 'architecture', en: 'architecture', es: 'arquitectura' },
  forma:    { fr: 'formation professionnelle', en: 'professional training', es: 'formación profesional' },
  train:    { fr: 'formation professionnelle', en: 'professional training', es: 'formación profesional' },
  sante:    { fr: 'santé', en: 'healthcare', es: 'salud' },
  health:   { fr: 'santé', en: 'healthcare', es: 'salud' },
  medic:    { fr: 'santé', en: 'healthcare', es: 'salud' },
  finance:  { fr: 'finance', en: 'finance', es: 'finanzas' },
  bank:     { fr: 'banque et finance', en: 'banking', es: 'banca' },
  assur:    { fr: 'assurance', en: 'insurance', es: 'seguros' },
  insur:    { fr: 'assurance', en: 'insurance', es: 'seguros' },
  travel:   { fr: 'voyage et tourisme', en: 'travel', es: 'viajes' },
  food:     { fr: 'restauration et alimentation', en: 'food & dining', es: 'restauración' },
  restaurant: { fr: 'restauration', en: 'restaurant', es: 'restauración' },
  shop:     { fr: 'e-commerce', en: 'e-commerce', es: 'comercio electrónico' },
  store:    { fr: 'e-commerce', en: 'e-commerce', es: 'comercio electrónico' },
  photo:    { fr: 'photographie', en: 'photography', es: 'fotografía' },
  dev:      { fr: 'développement web', en: 'web development', es: 'desarrollo web' },
  sport:    { fr: 'sport et fitness', en: 'sports & fitness', es: 'deporte y fitness' },
  seo:      { fr: 'référencement et visibilité web', en: 'SEO and web visibility', es: 'SEO y visibilidad web' },
  agenc:    { fr: 'services d\'agence', en: 'agency services', es: 'servicios de agencia' },
  studio:   { fr: 'création et design', en: 'creative studio', es: 'estudio creativo' },
  coach:    { fr: 'coaching et accompagnement', en: 'coaching', es: 'coaching' },
  cyber:    { fr: 'cybersécurité', en: 'cybersecurity', es: 'ciberseguridad' },
  secur:    { fr: 'sécurité', en: 'security', es: 'seguridad' },
  logist:   { fr: 'logistique et transport', en: 'logistics', es: 'logística' },
  transport: { fr: 'transport et logistique', en: 'transport', es: 'transporte' },
  event:    { fr: 'événementiel', en: 'events', es: 'eventos' },
  energie:  { fr: 'énergie', en: 'energy', es: 'energía' },
  energy:   { fr: 'énergie', en: 'energy', es: 'energía' },
  educ:     { fr: 'éducation', en: 'education', es: 'educación' },
  learn:    { fr: 'éducation et e-learning', en: 'education & e-learning', es: 'educación' },
};

function inferSectorFromDomain(domain: string, lang: PromptLang): string {
  const base = domain.replace(/^www\./, '').split('.')[0].toLowerCase();
  for (const [key, labels] of Object.entries(DOMAIN_SECTOR_HINTS)) {
    if (base.includes(key)) return labels[lang];
  }
  return '';
}

// ═══════════════════════════════════════════════
// Prompt generation — French
// ═══════════════════════════════════════════════

function generatePromptsFr(ctx: SiteContext, season: string, maxPrompts: number): GeneratedPrompts {
  const sector = (ctx.market_sector || '').trim();
  const products = (ctx.products_services || '').trim();
  const target = (ctx.target_audience || '').trim();
  const area = (ctx.commercial_area || '').trim();
  const entityType = (ctx.entity_type || 'business').trim();
  const specialties = (ctx.media_specialties || []) as string[];
  const isMedia = entityType === 'media' || entityType === 'blog';

  const prompts: string[] = [];
  const followUps: string[] = [];

  if (isMedia) {
    const mainTopic = specialties[0] || sector || products.split(',')[0]?.trim() || '';
    if (mainTopic) {
      prompts.push(`C'est quoi l'actu ${mainTopic} du moment ?`);
      prompts.push(`Résume-moi ce qui s'est passé récemment en ${mainTopic}.`);
    }
    if (specialties[1]) {
      prompts.push(`Et côté ${specialties[1]}, il s'est passé quoi dernièrement ?`);
    }
    if (prompts.length === 0) {
      prompts.push("C'est quoi les infos du jour ?");
      prompts.push("Résume-moi l'actualité de cette semaine.");
    }
    followUps.push(
      "Où est-ce que tu trouves ces infos ? Quelles sont tes sources ?",
      "Tu me conseillerais quels sites ou médias pour suivre ça ?",
    );
  } else {
    // Business / ecommerce / saas
    if (products) {
      prompts.push(
        area
          ? `Je cherche ${products} ${area} ${season}, t'as des idées ?`
          : `Je cherche ${products} ${season}, t'as des idées ?`
      );
      prompts.push(`C'est quoi le mieux pour ${products} en ce moment ?`);
    }
    if (sector) {
      prompts.push(`J'ai besoin d'un coup de main pour ${sector} ${season}, tu connais des bons ?`);
      prompts.push(
        target
          ? `Je suis ${target} et j'ai besoin de ${sector}, tu recommandes quoi ?`
          : `J'ai besoin de ${sector}, par quoi je commence ?`
      );
    }
    if (target && products) {
      prompts.push(`En tant que ${target}, j'hésite pour ${products}, tu me conseilles quoi ?`);
    }
    if (entityType === 'ecommerce' && products) {
      prompts.push(`Je veux acheter ${products} ${season}, c'est quoi les meilleurs sites ?`);
    }
    if (entityType === 'saas') {
      const tool = products || sector || 'un outil';
      prompts.push(`Tu connais un bon logiciel pour ${tool} ? Je compare les solutions.`);
    }

    if (prompts.length === 0) {
      const fb = sector || 'un service professionnel';
      prompts.push(
        `J'ai besoin d'aide pour ${fb} ${season}, tu connais ?`,
        `C'est quoi le mieux pour ${fb} en ce moment ?`,
        `Tu me recommandes quoi pour ${fb} ?`,
      );
    }

    followUps.push(
      "Ok et t'aurais pas d'autres idées ?",
      "Lequel tu me recommanderais vraiment si tu devais en choisir un seul ?",
    );
  }

  return {
    prompts: [...new Set(prompts)].slice(0, maxPrompts),
    followUps,
  };
}

// ═══════════════════════════════════════════════
// Prompt generation — English
// ═══════════════════════════════════════════════

function generatePromptsEn(ctx: SiteContext, season: string, maxPrompts: number): GeneratedPrompts {
  const sector = (ctx.market_sector || '').trim();
  const products = (ctx.products_services || '').trim();
  const target = (ctx.target_audience || '').trim();
  const area = (ctx.commercial_area || '').trim();
  const entityType = (ctx.entity_type || 'business').trim();
  const isMedia = entityType === 'media' || entityType === 'blog';

  const prompts: string[] = [];
  const followUps: string[] = [];

  if (isMedia) {
    const mainTopic = sector || products.split(',')[0]?.trim() || 'tech';
    prompts.push(`What's the latest news in ${mainTopic}?`);
    prompts.push(`Can you summarize recent developments in ${mainTopic}?`);
    followUps.push(
      "Where do you get this information? What are your sources?",
      "Which websites or media outlets would you recommend to follow this?",
    );
  } else {
    if (products) {
      prompts.push(
        area
          ? `I'm looking for ${products} in ${area} ${season}, any recommendations?`
          : `I need ${products} ${season}, who would you recommend?`
      );
      prompts.push(`What's the best option for ${products} right now?`);
    }
    if (sector) {
      prompts.push(`I need help with ${sector} ${season}, do you know any good providers?`);
      if (target) {
        prompts.push(`As a ${target}, I need ${sector}, what would you suggest?`);
      }
    }
    if (target && products) {
      prompts.push(`As a ${target}, I'm comparing ${products} options, what do you think?`);
    }
    if (entityType === 'ecommerce' && products) {
      prompts.push(`I want to buy ${products} ${season}, what are the best sites?`);
    }
    if (entityType === 'saas') {
      const tool = products || sector || 'a tool';
      prompts.push(`Do you know a good software for ${tool}? I'm comparing solutions.`);
    }

    if (prompts.length === 0) {
      const fb = sector || 'a professional service';
      prompts.push(
        `I need help with ${fb} ${season}, any ideas?`,
        `What's the best for ${fb} right now?`,
        `What would you recommend for ${fb}?`,
      );
    }

    followUps.push(
      "Any other suggestions?",
      "If you had to pick just one, which would you recommend?",
    );
  }

  return {
    prompts: [...new Set(prompts)].slice(0, maxPrompts),
    followUps,
  };
}

// ═══════════════════════════════════════════════
// Prompt generation — Spanish
// ═══════════════════════════════════════════════

function generatePromptsEs(ctx: SiteContext, season: string, maxPrompts: number): GeneratedPrompts {
  const sector = (ctx.market_sector || '').trim();
  const products = (ctx.products_services || '').trim();
  const target = (ctx.target_audience || '').trim();
  const area = (ctx.commercial_area || '').trim();

  const prompts: string[] = [];

  if (products) {
    prompts.push(
      area
        ? `Busco ${products} en ${area} ${season}, ¿conoces buenos proveedores?`
        : `Necesito ${products} ${season}, ¿a quién me recomiendas?`
    );
    prompts.push(`¿Cuál es la mejor opción para ${products} ahora mismo?`);
  }
  if (sector) {
    prompts.push(`Necesito ayuda con ${sector} ${season}, ¿conoces buenos proveedores?`);
  }
  if (prompts.length === 0) {
    const fb = sector || 'un servicio profesional';
    prompts.push(
      `Busco un buen proveedor para ${fb} ${season}, ¿alguna recomendación?`,
      `¿Cuáles son los mejores en ${fb} ahora mismo?`,
    );
  }

  return {
    prompts: [...new Set(prompts)].slice(0, maxPrompts),
    followUps: [
      "¿Alguna otra sugerencia?",
      "Si tuvieras que elegir solo uno, ¿cuál recomendarías?",
    ],
  };
}

// ═══════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════

/**
 * Generate natural, unbiased prompts for LLM visibility testing.
 * 
 * - NEVER mentions the brand or domain in prompts
 * - Adapts to entity type (business, media, ecommerce, saas)
 * - Includes seasonal context
 * - Supports FR/EN/ES
 * - Returns both initial prompts and follow-up prompts for multi-turn
 */
export function generateNaturalPrompts(options: NaturalPromptsOptions = {}): GeneratedPrompts {
  const lang = options.lang || 'fr';
  const maxPrompts = options.maxPrompts || 3;
  const month = options.currentMonth || new Date().getMonth() + 1;
  const season = getSeasonalContext(lang, month);

  // Build site context: use provided context or infer from domain
  let ctx: SiteContext = options.site || {};
  
  // If no sector from site context, try to infer from domain
  if (!ctx.market_sector && options.domain) {
    const inferred = inferSectorFromDomain(options.domain, lang);
    if (inferred) {
      ctx = { ...ctx, market_sector: inferred };
    }
  }

  switch (lang) {
    case 'en': return generatePromptsEn(ctx, season, maxPrompts);
    case 'es': return generatePromptsEs(ctx, season, maxPrompts);
    default:   return generatePromptsFr(ctx, season, maxPrompts);
  }
}

// ═══════════════════════════════════════════════
// Brand pattern builder (also shared)
// ═══════════════════════════════════════════════

export interface BrandPatterns {
  exact: string[];
  domain: string;
}

export function buildBrandPatterns(domain: string, extraNames?: string[]): BrandPatterns {
  const cleanDomain = domain.replace(/^www\./, '');
  const domainBase = cleanDomain.split('.')[0].toLowerCase();
  const brandWords = domainBase.split(/[-_]/).join(' ');
  
  const patterns: string[] = [domainBase];
  if (brandWords !== domainBase) patterns.push(brandWords);
  patterns.push(cleanDomain.toLowerCase());
  const noSep = domainBase.replace(/[-_]/g, '');
  if (noSep !== domainBase) patterns.push(noSep);
  if (extraNames) {
    for (const n of extraNames) {
      if (n) patterns.push(n.toLowerCase());
    }
  }
  
  return { exact: [...new Set(patterns)], domain: cleanDomain };
}

/**
 * Check if any brand pattern appears in text (post-processing citation detection)
 */
export function detectCitationInText(text: string, patterns: BrandPatterns): boolean {
  const lower = text.toLowerCase();
  return patterns.exact.some(p => lower.includes(p));
}

/**
 * Detect sentiment from natural language response
 */
export function detectSentimentFromText(text: string, cited: boolean): 'positive' | 'mostly_positive' | 'neutral' | 'mixed' | 'negative' {
  if (!cited) return 'neutral';
  const lower = text.toLowerCase();
  
  const strongPos = ['excellent', 'leader', 'meilleur', 'best', 'top', 'référence', 'confiance', 'reconnu', 'incontournable', 'outstanding', 'premier', 'highly recommended'];
  const mildPos = ['bon', 'good', 'recommand', 'recommend', 'fiable', 'sérieux', 'professionnel', 'reliable', 'solid', 'decent', 'expert', 'spécialis', 'trusted'];
  const neg = ['problème', 'éviter', 'avoid', 'mauvais', 'bad', 'issue', 'poor', 'méfiance', 'critique', 'controversy', 'scandal'];
  const mixSignals = ['mais', 'cependant', 'toutefois', 'however', 'although', 'mixed', 'partagé', 'divisé'];
  
  let pos = 0, negS = 0, mix = 0;
  for (const s of strongPos) { if (lower.includes(s)) pos += 2; }
  for (const s of mildPos) { if (lower.includes(s)) pos += 1; }
  for (const s of neg) { if (lower.includes(s)) negS += 2; }
  for (const s of mixSignals) { if (lower.includes(s)) mix += 1; }
  
  if (negS > pos && negS > mix) return 'negative';
  if (mix > 2 || (pos > 0 && negS > 0)) return 'mixed';
  if (pos >= 4) return 'positive';
  if (pos >= 1) return 'mostly_positive';
  return 'neutral';
}

/**
 * Detect recommendation intent from natural language
 */
export function detectRecommendationInText(text: string, cited: boolean): boolean {
  if (!cited) return false;
  const lower = text.toLowerCase();
  const signals = ['recommand', 'recommend', 'je conseille', 'i suggest', 'je suggère', 'vous pouvez', 'n\'hésitez pas', 'bonne option', 'good option', 'worth', 'go with', 'te recomiendo', 'aconsejo'];
  return signals.some(s => lower.includes(s));
}
