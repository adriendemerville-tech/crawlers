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
  /** Modèle d'affaires résolu (carte d'identité) — arbitre l'éligibilité aux questions locales */
  business_model?: string | null;
  /** Noms de marque à ne JAMAIS faire apparaître dans les questions */
  brand_name?: string | null;
  site_name?: string | null;
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
  /** Noms de marque additionnels à censurer dans les questions */
  brandNames?: string[];
}

export interface GeneratedPrompts {
  /** Initial prompts (no brand mention) */
  prompts: string[];
  /** Follow-up prompts for multi-turn conversations */
  followUps: string[];
}

// ═══════════════════════════════════════════════
// Brand scrubbing — la marque/le domaine ne doit JAMAIS apparaître
// ═══════════════════════════════════════════════

const GENERIC_BRAND_STOPWORDS = new Set([
  'web', 'site', 'shop', 'store', 'group', 'groupe', 'agence', 'agency', 'france',
  'pro', 'app', 'online', 'digital', 'the', 'les', 'des', 'and', 'plus',
]);

/** Construit la liste de termes de marque à retirer de toute question. */
export function buildBrandScrubTerms(domain?: string, extraNames?: (string | null | undefined)[]): string[] {
  const terms = new Set<string>();
  const push = (t?: string | null) => {
    const v = (t || '').trim().toLowerCase();
    if (v.length >= 3 && !GENERIC_BRAND_STOPWORDS.has(v)) terms.add(v);
  };

  if (domain) {
    const clean = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    push(clean);                                  // avenir-renovations.fr
    const base = clean.split('.')[0];
    push(base);                                   // avenir-renovations
    push(base.replace(/[-_]/g, ' '));             // avenir renovations
    push(base.replace(/[-_]/g, ''));              // avenirrenovations
    for (const word of base.split(/[-_]/)) {
      if (word.length >= 5) push(word);           // renovations (mots courts ignorés : trop génériques)
    }
  }
  for (const n of extraNames || []) {
    const v = (n || '').trim();
    if (!v) continue;
    push(v);
    push(v.replace(/[\s\-_]+/g, ''));
  }
  // Termes longs d'abord pour éviter les retraits partiels
  return [...terms].sort((a, b) => b.length - a.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Retire toute mention de marque/domaine d'un texte et nettoie la ponctuation orpheline. */
export function scrubBrandFromText(text: string, terms: string[]): string {
  let out = text;
  for (const t of terms) {
    const re = new RegExp(`(?:\\b|\\s)(?:chez\\s+|de\\s+|by\\s+)?${escapeRe(t)}\\b`, 'gi');
    out = out.replace(re, ' ');
  }
  return out
    // connecteurs orphelins laissés par le retrait de la marque
    .replace(/\s+(avec|chez|par|de|du|des|sur|pour|with|by|from|con|por)\s*(?=[,.;:!?]|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([«(])\s+/g, '$1')
    .replace(/\s+([»)])/g, '$1')
    .replace(/(^|\s)[,;:]\s*/g, '$1')
    .trim();
}


// ═══════════════════════════════════════════════
// Éligibilité des questions locales (selon la carte d'identité)
// ═══════════════════════════════════════════════

/**
 * Seuls les modèles d'affaires réellement ancrés dans un territoire justifient
 * une question locale (« quel prestataire à Lyon ? »).
 * Un SaaS, une marketplace, un e-commerce ou un média est servi partout :
 * une question locale y produit une mesure fausse.
 */
const LOCAL_ELIGIBLE_BUSINESS_MODELS = new Set([
  'service_local',   // artisan, commerce, cabinet, clinique, restaurant, garage…
  'leadgen',         // génération de leads sur une zone de chalandise
  'nonprofit',       // association / structure implantée localement
]);

const LOCAL_INELIGIBLE_BUSINESS_MODELS = new Set([
  'saas_b2b', 'saas_b2c',
  'marketplace_b2b', 'marketplace_b2c', 'marketplace_b2b2c',
  'ecommerce_b2c', 'ecommerce_b2b',
  'media_publisher',
  'service_agency',
]);

const LOCAL_INELIGIBLE_ENTITY_TYPES = new Set(['saas', 'ecommerce', 'marketplace', 'media', 'blog']);

// « France » n'exclut le local que s'il est employé seul : « Île-de-France »
// ou « Nouvelle-Aquitaine » restent des zones de chalandise valides.
const NON_LOCAL_AREA_RE = /(?<![\w-])(france|international|mondial|monde|europe|national|worldwide|global|en ligne|online|remote|à distance)(?![\w-])/i;

/** true si une question géolocalisée a un sens pour ce site. */
export function isLocalQuestionRelevant(ctx: SiteContext): boolean {
  const area = (ctx.commercial_area || '').trim();
  if (!area) return false;
  if (NON_LOCAL_AREA_RE.test(area)) return false;

  const model = (ctx.business_model || '').trim().toLowerCase();
  if (model) {
    if (LOCAL_INELIGIBLE_BUSINESS_MODELS.has(model)) return false;
    return LOCAL_ELIGIBLE_BUSINESS_MODELS.has(model);
  }

  // Sans modèle d'affaires résolu : on retombe sur le type d'entité
  const entity = (ctx.entity_type || 'business').trim().toLowerCase();
  if (LOCAL_INELIGIBLE_ENTITY_TYPES.has(entity)) return false;
  return true;
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
// Lexique dérivé de la carte d'identité
// Le mot employé dans la question doit correspondre à la nature de l'offre :
// « outil » n'a de sens que pour un logiciel. Une entreprise classique se
// cherche comme « entreprise / prestataire / artisan », sinon la mesure de
// citabilité est faussée dès la question.
// ═══════════════════════════════════════════════

export interface PromptLexicon {
  /** Groupe nominal indéfini : « un logiciel », « une entreprise »… */
  seek: string;
  /** Même notion au pluriel pour les comparatifs : « les meilleurs logiciels » */
  comparePlural: string;
  /** Nom nu employé après un déterminant interrogatif : « quel <noun> » */
  noun: string;
}

type LexKey = 'software' | 'shop' | 'local_service' | 'agency' | 'nonprofit' | 'service';

const LEXICONS: Record<PromptLang, Record<LexKey, PromptLexicon>> = {
  fr: {
    software:      { seek: 'un logiciel',    comparePlural: 'les meilleurs logiciels',    noun: 'logiciel' },
    shop:          { seek: 'un site',        comparePlural: 'les meilleurs sites',        noun: 'site' },
    local_service: { seek: 'une entreprise', comparePlural: 'les meilleures entreprises', noun: 'entreprise' },
    agency:        { seek: 'un prestataire', comparePlural: 'les meilleurs prestataires', noun: 'prestataire' },
    nonprofit:     { seek: 'une structure',  comparePlural: 'les meilleures structures',  noun: 'structure' },
    service:       { seek: 'un prestataire', comparePlural: 'les meilleurs prestataires', noun: 'prestataire' },
  },
  en: {
    software:      { seek: 'a software',       comparePlural: 'the best software',       noun: 'software' },
    shop:          { seek: 'a website',       comparePlural: 'the best websites',       noun: 'website' },
    local_service: { seek: 'a company',       comparePlural: 'the best companies',      noun: 'company' },
    agency:        { seek: 'a provider',      comparePlural: 'the best providers',      noun: 'provider' },
    nonprofit:     { seek: 'an organization', comparePlural: 'the best organizations',  noun: 'organization' },
    service:       { seek: 'a provider',      comparePlural: 'the best providers',      noun: 'provider' },
  },
  es: {
    software:      { seek: 'un software',     comparePlural: 'los mejores software',     noun: 'software' },
    shop:          { seek: 'una tienda',      comparePlural: 'las mejores tiendas',      noun: 'tienda' },
    local_service: { seek: 'una empresa',     comparePlural: 'las mejores empresas',     noun: 'empresa' },
    agency:        { seek: 'un proveedor',    comparePlural: 'los mejores proveedores',  noun: 'proveedor' },
    nonprofit:     { seek: 'una organización', comparePlural: 'las mejores organizaciones', noun: 'organización' },
    service:       { seek: 'un proveedor',    comparePlural: 'los mejores proveedores',  noun: 'proveedor' },
  },
};

function resolveLexKey(ctx: SiteContext): LexKey {
  const model = (ctx.business_model || '').trim().toLowerCase();
  const entity = (ctx.entity_type || '').trim().toLowerCase();

  if (model.startsWith('saas')) return 'software';
  if (model.startsWith('ecommerce') || model.startsWith('marketplace')) return 'shop';
  if (model === 'service_local' || model === 'leadgen') return 'local_service';
  if (model === 'service_agency') return 'agency';
  if (model === 'nonprofit') return 'nonprofit';

  if (entity === 'saas') return 'software';
  if (entity === 'ecommerce' || entity === 'marketplace') return 'shop';
  return 'service';
}

/** Lexique à employer dans les questions, dérivé de la carte d'identité. */
export function resolveLexicon(ctx: SiteContext, lang: PromptLang = 'fr'): PromptLexicon {
  return LEXICONS[lang][resolveLexKey(ctx)];
}


// ═══════════════════════════════════════════════
// Prompt generation — French
// ═══════════════════════════════════════════════

function generatePromptsFr(ctx: SiteContext, season: string, maxPrompts: number): GeneratedPrompts {
  const sector = (ctx.market_sector || '').trim();
  const products = (ctx.products_services || '').trim();
  const target = (ctx.target_audience || '').trim();
  const area = (ctx.commercial_area || '').trim();
  const localOk = isLocalQuestionRelevant(ctx);
  const entityType = (ctx.entity_type || 'business').trim();
  const specialties = (ctx.media_specialties || []) as string[];
  const isMedia = entityType === 'media' || entityType === 'blog';

  // ── Progressive prompts: simple first, details drip-fed in follow-ups ──
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
    // ── Core need: extract the simplest possible need ──
    const mainNeed = (products.split(',')[0] || '').trim()
      || sector
      || 'un service professionnel';

    // Lexique dérivé de la carte d'identité : « logiciel » pour un SaaS,
    // « entreprise » pour un service local, jamais « outil » pour une
    // entreprise classique (la question serait hors sujet).
    const lex = resolveLexicon(ctx, 'fr');
    const noun = lex.noun;
    const isShop = resolveLexKey(ctx) === 'shop';

    // ── Intentions contrastées : une seule question par intention, dans un
    // ordre qui garantit la diversité même quand maxPrompts vaut 3.
    // 1. Découverte  2. Comparatif  3. Local ou audience  4. Alternatives
    // 5. Prix        6. Preuve / avis
    const byIntent: Array<{ intent: string; text: string }> = [];

    byIntent.push({
      intent: 'discovery',
      text: isShop
        ? `Je cherche où acheter ${mainNeed}, t'as des idées ?`
        : `Je cherche ${lex.seek} pour ${mainNeed}, t'as des idées ?`,
    });

    byIntent.push({
      intent: 'comparison',
      text: isShop
        ? `Quels sites se valent pour acheter ${mainNeed} et lequel est le mieux ?`
        : `Compare-moi ${lex.comparePlural} pour ${mainNeed} : ${lex.comparePlural.startsWith('les meilleures') ? 'laquelle' : 'lequel'} sort du lot ?`,
    });

    if (localOk) {
      const which = lex.seek.startsWith('une') ? 'Quelle' : 'Quel';
      byIntent.push({ intent: 'local', text: `${which} ${noun} pour ${mainNeed} à ${area} ?` });
    } else if (target) {
      byIntent.push({ intent: 'audience', text: `Je suis ${target} : ${lex.seek} pour ${mainNeed}, tu recommandes quoi ?` });
    }

    byIntent.push({ intent: 'alternative', text: `Quelles alternatives existent pour ${mainNeed}, à part les gros acteurs connus ?` });

    byIntent.push({ intent: 'price', text: `Combien coûte ${mainNeed} et comment sont fixés les prix ?` });


    if (sector && sector !== mainNeed) {
      byIntent.push({ intent: 'sector', text: `J'ai besoin d'aide en ${sector}, tu recommandes quoi et pourquoi ?` });
    }

    byIntent.push({ intent: 'proof', text: `Sur quels retours d'expérience ou avis clients tu te bases pour ${mainNeed} ?` });

    for (const p of byIntent) prompts.push(p.text);


    // ── Follow-ups: drip-feed details one by one ──
    // Each follow-up adds ONE precision, like a real conversation
    if (localOk) {
      followUps.push(`Et ${area}, tu connais des bons ?`);
    }

    if (target) {
      followUps.push(`Je suis ${target}, ça change quelque chose ?`);
    }
    // Seasonal follow-up
    followUps.push(`T'as pas un truc gratuit ${season} ?`);
    
    // Product sub-features as individual follow-ups
    const productParts = products.split(',').map(p => p.trim()).filter(Boolean);
    if (productParts.length > 1) {
      for (const part of productParts.slice(1, 3)) {
        followUps.push(`Et pour ${part}, y'a quoi de bien ?`);
      }
    }

    followUps.push(
      "Lequel tu me recommanderais si tu devais en choisir un seul ?",
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
  const localOk = isLocalQuestionRelevant(ctx);
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
    const mainNeed = (products.split(',')[0] || '').trim()
      || sector
      || 'a professional service';

    // Lexicon derived from the identity card ("software" only for a SaaS)
    const lexEn = resolveLexicon(ctx, 'en');
    const isShopEn = resolveLexKey(ctx) === 'shop';

    // Q1: Simple need
    prompts.push(isShopEn
      ? `I'm looking for a place to buy ${mainNeed}, any ideas?`
      : `I'm looking for ${lexEn.seek} for ${mainNeed}, any ideas?`);

    // Q2: Comparison angle
    prompts.push(isShopEn
      ? `What's the best site to buy ${mainNeed}?`
      : `Which of ${lexEn.comparePlural} for ${mainNeed} stands out?`);

    if (sector && sector !== mainNeed) {
      prompts.push(`I need help with ${sector}, what would you recommend?`);
    }

    // Follow-ups: drip-feed one detail at a time
    if (localOk) {
      followUps.push(`What about in ${area}, any good ones?`);
    }
    if (target) {
      followUps.push(`I'm a ${target}, does that change anything?`);
    }
    followUps.push(`Is there a free option ${season}?`);

    const productParts = products.split(',').map(p => p.trim()).filter(Boolean);
    if (productParts.length > 1) {
      for (const part of productParts.slice(1, 3)) {
        followUps.push(`And for ${part}, what's good?`);
      }
    }

    followUps.push(
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
  const localOk = isLocalQuestionRelevant(ctx);

  const prompts: string[] = [];
  const followUps: string[] = [];

  const mainNeed = (products.split(',')[0] || '').trim()
    || sector
    || 'un servicio profesional';

  const lexEs = resolveLexicon(ctx, 'es');
  prompts.push(`Busco ${lexEs.seek} para ${mainNeed}, ¿alguna idea?`);
  prompts.push(`¿Cuál de ${lexEs.comparePlural} para ${mainNeed} destaca más?`);

  if (sector && sector !== mainNeed) {
    prompts.push(`Necesito ayuda con ${sector}, ¿qué recomiendas?`);
  }

  if (localOk) {
    followUps.push(`¿Y en ${area}, conoces buenos?`);
  }
  if (target) {
    followUps.push(`Soy ${target}, ¿cambia algo?`);
  }
  followUps.push(`¿Hay alguna opción gratis ${season}?`);

  const productParts = products.split(',').map(p => p.trim()).filter(Boolean);
  if (productParts.length > 1) {
    for (const part of productParts.slice(1, 3)) {
      followUps.push(`¿Y para ${part}, qué hay de bueno?`);
    }
  }

  followUps.push(
    "Si tuvieras que elegir solo uno, ¿cuál recomendarías?",
  );

  return {
    prompts: [...new Set(prompts)].slice(0, maxPrompts),
    followUps,
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

  // Censure marque/domaine EN AMONT : les champs de la carte d'identité
  // contiennent souvent le nom commercial (products_services, market_sector…).
  const scrubTerms = buildBrandScrubTerms(options.domain, [
    ctx.brand_name,
    ctx.site_name,
    ...(options.brandNames || []),
  ]);
  if (scrubTerms.length) {
    ctx = {
      ...ctx,
      market_sector: ctx.market_sector ? scrubBrandFromText(ctx.market_sector, scrubTerms) : ctx.market_sector,
      products_services: ctx.products_services ? scrubBrandFromText(ctx.products_services, scrubTerms) : ctx.products_services,
      target_audience: ctx.target_audience ? scrubBrandFromText(ctx.target_audience, scrubTerms) : ctx.target_audience,
      media_specialties: ctx.media_specialties?.map(s => scrubBrandFromText(s, scrubTerms)).filter(Boolean),
    };
  }

  let out: GeneratedPrompts;
  switch (lang) {
    case 'en': out = generatePromptsEn(ctx, season, maxPrompts); break;
    case 'es': out = generatePromptsEs(ctx, season, maxPrompts); break;
    default:   out = generatePromptsFr(ctx, season, maxPrompts);
  }

  // Filet de sécurité final : aucune question ne sort avec une mention de marque.
  if (scrubTerms.length) {
    out = {
      prompts: out.prompts.map(p => scrubBrandFromText(p, scrubTerms)).filter(p => p.length > 10),
      followUps: out.followUps.map(p => scrubBrandFromText(p, scrubTerms)).filter(p => p.length > 5),
    };
  }
  return out;
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
