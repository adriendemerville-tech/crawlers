/**
 * _shared/llmBenchmarks.ts
 *
 * Construit TROIS benchmarks LLM distincts de 3 questions chacun.
 *
 * Le DÉCOUPAGE se fait par zone de marché réelle (voir _shared/questionTopics.ts) :
 *   1. `covered` — l'intention la plus couverte par le site dans la SERP
 *   2. `ranked`  — la requête où le site est le mieux classé (corrélation SEO → GEO)
 *   3. `demand`  — la requête la plus demandée que le site n'adresse pas
 * Avant, les trois benchmarks variaient par forme d'intention mais puisaient dans
 * la même liste de besoins : ils mesuraient trois fois la même zone de marché.
 *
 * À L'INTÉRIEUR de chaque benchmark, les trois questions varient par forme :
 * découverte, comparaison, contexte. Le contexte est OBLIGATOIREMENT géolocalisé
 * quand le site est une entreprise physique avec zone de chalandise
 * (« Je cherche une entreprise pour rénover ma salle de bain à Salon-de-Provence,
 * que me recommandes-tu ? »).
 *
 * Les questions ne mentionnent JAMAIS la marque ni le domaine (scrub en sortie).
 *
 * Consommateurs : calculate-llm-visibility, marina.
 */

import {
  resolveLexicon,
  isLocalQuestionRelevant,
  buildBrandScrubTerms,
  scrubBrandFromText,
  type SiteContext,
  type PromptLang,
} from './naturalPrompts.ts';
import { isActorTopic, isToolLikeSite, type TopicSelection } from './questionTopics.ts';
import { resolveGeoScope, geoPhrase, describeGeoScope, type GeoScope } from './geoScope.ts';

export interface BenchmarkPrompt {
  intent: string;
  text: string;
}

export interface LlmBenchmark {
  id: string;
  label: string;
  description: string;
  prompts: BenchmarkPrompt[];
}

type AxisKey = 'page_focus' | 'value_prop' | 'covered' | 'ranked' | 'demand' | 'identity';

const PAGE_FOCUS_LABELS: Record<PromptLang, { label: string; description: string }> = {
  fr: {
    label: 'Intention de la page auditée',
    description: "Besoin réellement porté par l'URL auditée (prestation et, le cas échéant, localité déduites du slug, du title et du H1) : mesure si les IA citent le site sur l'intention propre à cette page, et non sur celle du domaine.",
  },
  en: {
    label: 'Audited page intent',
    description: 'The need actually carried by the audited URL (service and, where relevant, locality derived from the slug, title and H1): measures whether AI models cite the site on this page-level intent rather than the domain-level one.',
  },
  es: {
    label: 'Intención de la página auditada',
    description: 'La necesidad que realmente cubre la URL auditada (servicio y, si aplica, localidad deducidos del slug, title y H1): mide si las IA citan el sitio sobre la intención propia de esta página.',
  },
};

const VALUE_PROP_LABELS: Record<PromptLang, { label: string; description: string }> = {
  fr: {
    label: 'Proposition de valeur centrale',
    description: "Offre n°1 déclarée dans la carte d'identité : mesure si les IA citent le site sur son cœur de proposition, indépendamment de son positionnement Google.",
  },
  en: {
    label: 'Core value proposition',
    description: 'The primary offer declared in the identity card: measures whether AI models cite the site on its core promise, independently of its Google ranking.',
  },
  es: {
    label: 'Propuesta de valor central',
    description: 'La oferta principal declarada en la ficha de identidad: mide si las IA citan el sitio en su promesa central, al margen de su posición en Google.',
  },
};

const AXIS_LABELS: Record<PromptLang, Record<AxisKey, { label: string; description: string }>> = {
  fr: {
    page_focus: PAGE_FOCUS_LABELS.fr,
    value_prop: VALUE_PROP_LABELS.fr,
    covered: {
      label: 'Cœur de marché couvert',
      description: "Besoin sur lequel le site est déjà présent dans les résultats Google : mesure si cette couverture SEO se traduit en citation par les IA.",
    },
    ranked: {
      label: 'Meilleure position SERP',
      description: "Besoin sur lequel le site est le mieux classé sur Google : test direct de corrélation entre position SEO et citation par les IA.",
    },
    demand: {
      label: 'Potentiel non capté',
      description: "Besoin fortement recherché que le site n'adresse pas (ou mal) : mesure le marché laissé aux concurrents. Un score nul est ici un potentiel à ouvrir, pas un échec.",
    },
    identity: {
      label: 'Besoin déclaré',
      description: "Besoin issu de la carte d'identité, faute de données de positionnement suffisantes : mesure l'émergence spontanée sur l'activité annoncée.",
    },
  },
  en: {
    page_focus: PAGE_FOCUS_LABELS.en,
    value_prop: VALUE_PROP_LABELS.en,
    covered: {
      label: 'Covered core market',
      description: 'A need the site already ranks for on Google: measures whether that SEO coverage turns into AI citations.',
    },
    ranked: {
      label: 'Best SERP position',
      description: 'The need the site ranks highest for: a direct test of the SEO-position to AI-citation correlation.',
    },
    demand: {
      label: 'Untapped potential',
      description: "A high-demand need the site does not address: measures the market left to competitors. A zero score here is potential, not failure.",
    },
    identity: {
      label: 'Declared need',
      description: 'A need taken from the identity card, for lack of ranking data: measures spontaneous emergence on the stated activity.',
    },
  },
  es: {
    page_focus: PAGE_FOCUS_LABELS.es,
    value_prop: VALUE_PROP_LABELS.es,
    covered: {
      label: 'Núcleo de mercado cubierto',
      description: 'Necesidad para la que el sitio ya aparece en Google: mide si esa cobertura SEO se traduce en citas por las IA.',
    },
    ranked: {
      label: 'Mejor posición SERP',
      description: 'Necesidad donde el sitio está mejor posicionado: prueba directa de la correlación entre posición SEO y cita por las IA.',
    },
    demand: {
      label: 'Potencial no captado',
      description: 'Necesidad muy buscada que el sitio no cubre: mide el mercado dejado a la competencia. Un cero aquí es potencial, no fracaso.',
    },
    identity: {
      label: 'Necesidad declarada',
      description: 'Necesidad tomada de la ficha de identidad, a falta de datos de posicionamiento: mide la aparición espontánea.',
    },
  },
};

function mainNeedOf(ctx: SiteContext, lang: PromptLang): string {
  const products = (ctx.products_services || '').trim();
  const sector = (ctx.market_sector || '').trim();
  const fallback = lang === 'fr' ? 'un service professionnel' : lang === 'es' ? 'un servicio profesional' : 'a professional service';
  return (products.split(',')[0] || '').trim() || sector || fallback;
}

/**
 * Métier réel du produit, extrait de la carte d'identité (0 token LLM).
 * « SaaS d'audit et d'optimisation SEO, GEO et AEO : … » → « audit et
 * optimisation SEO, GEO et AEO ». Sert de besoin quand la requête retenue
 * décrit une audience (« agence de référencement naturel ») et non une tâche.
 */
function coreJobOf(ctx: SiteContext): string {
  const raw = (ctx.products_services || '').trim();
  if (!raw) return '';
  let job = raw.split(':')[0].trim();
  job = job.replace(/^(saas|logiciels?|plateformes?|outils?|applications?|app|solutions?|services?)\s+(de\s+la\s+|du\s+|des\s+|de\s+|d'|pour\s+)/i, '');
  job = job.replace(/\bet\s+d'/gi, 'et ').replace(/\s{2,}/g, ' ').trim();
  if (job.length < 5) return '';
  if (job.length > 90) {
    const cut = job.slice(0, 90);
    const stop = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(' '));
    job = (stop > 20 ? cut.slice(0, stop) : cut).trim();
  }
  return job.replace(/[.,;]+$/, '').trim();
}

/** Preuve chiffrée ajoutée à la description du benchmark (jamais inventée). */
function evidenceOf(sel: TopicSelection | undefined, lang: PromptLang): string {
  if (!sel) return '';
  const bits: string[] = [];
  if (sel.position) {
    bits.push(lang === 'fr' ? `position Google ${sel.position}` : lang === 'es' ? `posición Google ${sel.position}` : `Google position ${sel.position}`);
  } else if (sel.axis === 'demand') {
    bits.push(lang === 'fr' ? 'aucune position mesurée' : lang === 'es' ? 'sin posición medida' : 'no measured position');
  }
  if (sel.volume) {
    bits.push(lang === 'fr' ? `${sel.volume} recherches/mois` : lang === 'es' ? `${sel.volume} búsquedas/mes` : `${sel.volume} searches/month`);
  }
  return bits.length ? ` (${bits.join(', ')})` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Ancrage des questions sur les mots-clés de la carte d'identité
// Règle : au moins 75 % des questions posées doivent contenir un mot-clé issu
// de « ce qui est vendu », du modèle d'affaires, de la cible principale ou de
// la cible secondaire. Sans cela, un audit d'un outil SEO/GEO pouvait poser
// neuf questions dont une seule contenait « SEO » et aucune « GEO ».
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORD_STOPWORDS = new Set([
  'avec', 'pour', 'dans', 'sans', 'chez', 'plus', 'tout', 'tous', 'toute', 'toutes',
  'leur', 'leurs', 'notre', 'nos', 'votre', 'vos', 'des', 'les', 'une', 'aux', 'par',
  'sur', 'que', 'qui', 'ses', 'son', 'sa', 'est', 'and', 'the', 'for', 'with', 'from',
  'your', 'our', 'their', 'los', 'las', 'para', 'con', 'como', 'entreprise', 'entreprises',
  'client', 'clients', 'service', 'services', 'solution', 'solutions', 'professionnel',
  'professionnels', 'site', 'sites', 'web', 'ligne', 'france', 'pme', 'tpe',
]);

/** Sigles et termes courts métier à conserver même sous 4 lettres. */
const KEYWORD_SHORT_ALLOW = /^(seo|geo|aeo|sea|smo|crm|erp|b2b|b2c|ia|ai|llm|gmb|ux|api|sav|rgpd|saas)$/i;

function tokenizeKeywords(raw?: string | null): string[] {
  const text = String(raw || '').replace(/[_/]+/g, ' ');
  if (!text.trim()) return [];
  const out: string[] = [];
  for (const token of text.split(/[^\p{L}\p{N}+&-]+/u)) {
    const t = token.trim().replace(/^[-+&]+|[-+&]+$/g, '');
    if (!t) continue;
    const low = t.toLowerCase();
    if (KEYWORD_STOPWORDS.has(low)) continue;
    if (t.length < 4 && !KEYWORD_SHORT_ALLOW.test(t)) continue;
    if (/^\d+$/.test(t)) continue;
    out.push(t);
  }
  return out;
}

/**
 * Mots-clés d'ancrage, dans l'ordre de priorité :
 * ce qui est vendu → modèle d'affaires → cible principale → cible secondaire.
 * Le premier segment de `target_audience` est la cible principale, le second
 * (après « ; » ou « , ») la cible secondaire.
 */
export function identityKeywords(ctx: SiteContext & Record<string, any>): string[] {
  const targets = String(ctx.target_audience || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const ordered = [
    ctx.products_services,
    ctx.value_proposition,
    String(ctx.business_model || '').replace(/_/g, ' '),
    targets[0],
    targets[1],
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of ordered) {
    for (const kw of tokenizeKeywords(field)) {
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(kw);
    }
  }
  return out.slice(0, 24);
}

/** La question contient-elle au moins un mot-clé d'ancrage ? */
export function questionHasKeyword(text: string, keywords: string[]): boolean {
  const low = ` ${String(text || '').toLowerCase()} `;
  return keywords.some((kw) => {
    const k = kw.toLowerCase();
    return k.length <= 4
      ? new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u').test(low)
      : low.includes(k);
  });
}

/** Taux de couverture des mots-clés d'identité sur l'ensemble des questions. */
export function keywordCoverage(benchmarks: LlmBenchmark[], keywords: string[]): { covered: number; total: number; ratio: number } {
  const prompts = benchmarks.flatMap((b) => b.prompts);
  const covered = prompts.filter((p) => questionHasKeyword(p.text, keywords)).length;
  const total = prompts.length;
  return { covered, total, ratio: total ? covered / total : 0 };
}

/** Modèles d'affaires pour lesquels une question « alternative à un concurrent » est pertinente. */
export function isCompetitorQuestionRelevant(ctx: SiteContext & Record<string, any>): boolean {
  const model = String(ctx.business_model || '').toLowerCase();
  const entity = String(ctx.entity_type || '').toLowerCase();
  if (model) {
    return /^(saas|ecommerce|marketplace)/.test(model) || model === 'service_agency' || model === 'media_publisher';
  }
  return ['saas', 'ecommerce', 'marketplace', 'media'].includes(entity);
}

/**
 * Génère 3 benchmarks × 3 questions (découverte / comparaison / contexte).
 * 100 % déterministe (0 token LLM).
 *
 * `topics` : les besoins retenus (un par benchmark).
 * `selections` : mêmes besoins enrichis de l'axe de marché et des preuves.
 */
export function buildLlmBenchmarks(
  site: SiteContext & {
    domain?: string;
    competitors?: (string | null)[];
    /**
     * Mots-clés propres à la PAGE auditée (slug, title, H1). Ils passent AVANT
     * ceux de la carte d'identité du domaine dans la règle des 75 % d'ancrage :
     * une page « salle de bain marseille » doit être testée sur ses termes, pas
     * sur ceux de la home.
     */
    page_keywords?: string[];
    /**
     * Angle secondaire porté par la page auditée. `reputation` (pages avis /
     * témoignages) remplace UNE question sur neuf par une question de preuve
     * sociale : le but d'une page avis reste de vendre la prestation, la
     * réputation n'en est que le levier.
     */
    page_secondary_angle?: 'reputation' | null;

    /**
     * Localité PROUVÉE par l'URL auditée (slug, title, H1). Elle l'emporte sur
     * la zone déclarée du domaine : dans un audit multipages, c'est ce qui rend
     * la question locale propre à chaque page.
     */
    page_locality?: string | null;
    /** Ville de la fiche Google Business, quand elle est connectée. */
    gmb_city?: string | null;
    /** Adresse structurée (le code postal sert de repli au niveau département). */
    address?: string | null;

  },
  lang: PromptLang = 'fr',
  extraBrandNames: (string | null | undefined)[] = [],
  topics: string[] = [],
  selections: TopicSelection[] = [],
): LlmBenchmark[] {
  const scrubTerms = buildBrandScrubTerms(site.domain, [site.brand_name, site.site_name, ...extraBrandNames]);
  const clean = (t?: string | null) => {
    const v = (t || '').trim();
    return v && scrubTerms.length ? scrubBrandFromText(v, scrubTerms) : v;
  };

  const ctx: SiteContext = {
    ...site,
    market_sector: clean(site.market_sector),
    products_services: clean(site.products_services),
    target_audience: clean(site.target_audience),
  };

  const lex = resolveLexicon(ctx, lang);
  const cleanTopics = (topics || []).map((t) => (t || '').trim()).filter(Boolean)
    .map((t) => (scrubTerms.length ? scrubBrandFromText(t, scrubTerms) : t).trim())
    .filter((t) => t.length >= 5);

  const needs = cleanTopics.length ? cleanTopics.slice(0, 3) : [mainNeedOf(ctx, lang)];
  const target = (ctx.target_audience || '').trim();
  /**
   * Périmètre géographique RÉELLEMENT testable (Lot 4).
   * Aucune mention de lieu n'est fabriquée : sans localité prouvée (page, fiche
   * Google Business, code postal) ou avec une zone déclarée large (« France
   * entière », « Europe »), `geoScope` vaut null et la question localisée est
   * purement et simplement remplacée par une question d'achat.
   */
  const geoScope = isLocalQuestionRelevant(ctx)
    ? resolveGeoScope({
        pageLocality: site.page_locality,
        gmbCity: site.gmb_city,
        address: site.address,
        commercialArea: ctx.commercial_area,
        activityBlob: [ctx.products_services, ctx.market_sector, (ctx as any).business_model, (ctx as any).entity_type]
          .filter(Boolean).join(' '),
      })
    : null;
  const localOk = geoScope !== null;
  if (localOk) {
    console.log(`[llmBenchmarks] périmètre local retenu : ${describeGeoScope(geoScope!)}`);
  } else {
    console.log("[llmBenchmarks] aucune localité prouvée → aucune question localisée (zone jamais inventée)");
  }
  const feminine = lex.seek.startsWith('une');
  const L = AXIS_LABELS[lang];
  const pageKeywords = (site.page_keywords || [])
    .map((k) => String(k || '').trim())
    .filter((k) => k.length >= 3);
  const anchorKeywords = [
    ...pageKeywords,
    ...identityKeywords(ctx as SiteContext & Record<string, any>).filter(
      (k) => !pageKeywords.some((p) => p.toLowerCase() === k.toLowerCase()),
    ),
  ];
  /**
   * Mots-clés d'ancrage prioritaires réellement absents du besoin testé.
   * Les jargons de modèle d'affaires (saas, b2b, marketplace…) comptent pour la
   * couverture mais ne sont jamais collés dans une question : un vrai prospect
   * ne dit pas « outil de suivi de position et SaaS ».
   */
  const MODEL_JARGON = /^(saas|b2b|b2c|ecommerce|e-commerce|marketplace|leadgen|nonprofit|publisher|media|agency)$/i;
  const missingAnchors = (need: string): string[] =>
    anchorKeywords.filter((kw) => !MODEL_JARGON.test(kw) && !questionHasKeyword(need, [kw]));
  /**
   * Ancre le besoin sur la carte d'identité quand la requête retenue n'en
   * contient aucun mot-clé (« agence de référencement naturel » sans « GEO »).
   */
  const anchorNeed = (need: string): string => {
    if (!anchorKeywords.length || questionHasKeyword(need, anchorKeywords)) return need;
    const kw = missingAnchors(need)[0];
    if (!kw) return need;
    const and = lang === 'en' ? 'and' : lang === 'es' ? 'y' : 'et';
    return `${need} ${and} ${kw}`;
  };
  const competitors = (site.competitors || [])
    .map((c) => String(c || '').trim())
    .filter((c) => c.length >= 3 && !scrubBrandFromText(c, scrubTerms).match(/^\s*$/));
  const competitorOk = isCompetitorQuestionRelevant(ctx as SiteContext & Record<string, any>) && competitors.length > 0;

  /**
   * Reformule un besoin issu de l'univers de mots-clés.
   * Quand la requête désigne un TYPE DE PRESTATAIRE (« agence de référencement
   * naturel ») et que le site vend un produit, ce n'est pas un besoin mais une
   * audience : le besoin devient le métier réel du produit (carte d'identité)
   * et le prestataire passe en contexte d'audience.
   */
  const framedNeed = (need: string): { need: string; audience: string } => {
    if (isActorTopic(need) && isToolLikeSite(ctx)) {
      const job = coreJobOf(ctx);
      if (job) return { need: anchorNeed(job), audience: need };
    }
    return { need: anchorNeed(need), audience: target };
  };

  /** Élision française : « besoin de audit » → « besoin d'audit ». */
  const deOf = (need: string): string =>
    /^[aeiouyàâéèêëîïôöûüh]/i.test(need) ? `d'${need}` : `de ${need}`;

  /**
   * Les trois formes de question, sur un besoin donné.
   * `variant` (0-2) fait varier la formulation d'un benchmark à l'autre : sans
   * cela les trois blocs du rapport affichaient trois fois la même phrase.
   */
  const promptsFor = (rawNeed: string, variant = 0): BenchmarkPrompt[] => {
    const { need: framed, audience } = framedNeed(rawNeed);
    const v = ((variant % 3) + 3) % 3;
    // Commerce / service de proximité : la ville entre dès la question de
    // découverte (« je cherche un fleuriste à Salon-de-Provence »), sinon la
    // mesure ne reflète pas la vraie requête d'un prospect local.
    // La mention géographique est rendue par `geoPhrase` : préposition et
    // article viennent d'une table (« à Chantilly », « dans l'Oise »,
    // « en Île-de-France »), et la tournure tourne avec l'index du benchmark
    // pour ne pas répéter neuf fois la même phrase. Déterministe : deux audits
    // identiques produisent les mêmes questions.
    // Le besoin peut déjà porter la ville (mots-clés de la page auditée) :
    // dans ce cas on ne l'ajoute pas une seconde fois.
    const alreadyLocated = localOk
      && framed.toLowerCase().includes((geoScope as GeoScope).label.toLowerCase());
    const geo = localOk && !alreadyLocated ? ` ${geoPhrase(geoScope as GeoScope, lang, v)}` : '';
    const need = `${framed}${geo}`;
    if (lang === 'en') {
      const discovery = [
        `I'm looking for ${lex.seek} for ${need} — what do you recommend?`,
        `What is the best ${lex.noun} to handle ${need} today?`,
        `Which ${lex.noun} would you actually trust for ${need}, and why?`,
      ];
      const comparison = [
        `Compare ${lex.comparePlural} for ${need}: which one stands out and why?`,
        `Shortlist three serious options for ${need} and explain what sets them apart.`,
        `Between the well-known players and the specialists for ${need}, what do you recommend?`,
      ];
      return [
        { intent: 'discovery', text: discovery[v] },
        { intent: 'comparison', text: comparison[v] },
        localOk
          ? { intent: 'local', text: `I'm looking for ${lex.seek} for ${framed} ${geoPhrase(geoScope as GeoScope, lang, v + 1)} — who should I trust locally?` }
          : audience
            ? { intent: 'audience', text: `I'm a ${audience} and I need ${framed}: which option would you recommend and why?` }
            : { intent: 'usecase', text: `In which situations is ${lex.seek} for ${need} genuinely worth it, and who should I trust?` },
      ];
    }
    if (lang === 'es') {
      const discovery = [
        `Busco ${lex.seek} para ${need}, ¿qué me recomiendas?`,
        `¿Cuál es hoy ${lex.seek} de referencia para ${need}?`,
        `¿En qué ${lex.noun} confiarías realmente para ${need} y por qué?`,
      ];
      const comparison = [
        `Compara ${lex.comparePlural} para ${need}: ¿cuál destaca y por qué?`,
        `Dame tres opciones serias para ${need} y explica qué las diferencia.`,
        `Entre los grandes actores y los especialistas para ${need}, ¿qué recomiendas?`,
      ];
      return [
        { intent: 'discovery', text: discovery[v] },
        { intent: 'comparison', text: comparison[v] },
        localOk
          ? { intent: 'local', text: `Busco ${lex.seek} para ${framed} ${geoPhrase(geoScope as GeoScope, lang, v + 1)}, ¿en quién puedo confiar?` }
          : audience
            ? { intent: 'audience', text: `Soy ${audience} y necesito ${framed}: ¿qué opción recomiendas y por qué?` }
            : { intent: 'usecase', text: `¿En qué casos merece la pena ${lex.seek} para ${need} y en quién confiar?` },
      ];
    }
    const discovery = [
      `Je cherche ${lex.seek} pour ${need}, que me recommandes-tu ?`,
      `Quel${feminine ? 'le' : ''} est aujourd'hui ${lex.seek} de référence pour ${need} ?`,
      `À quel${feminine ? 'le' : ''} ${lex.noun} ferais-tu vraiment confiance pour ${need}, et pourquoi ?`,
    ];
    const comparison = [
      `Compare-moi ${lex.comparePlural} pour ${need} : ${feminine ? 'laquelle' : 'lequel'} sort du lot et pourquoi ?`,
      `Donne-moi trois options sérieuses pour ${need} et ce qui les différencie concrètement.`,
      `Entre les gros acteurs connus et les spécialistes pour ${need}, tu recommandes quoi ?`,
    ];
    return [
      { intent: 'discovery', text: discovery[v] },
      { intent: 'comparison', text: comparison[v] },
      localOk
        ? { intent: 'local', text: `Je cherche ${lex.seek} pour ${framed} ${geoPhrase(geoScope as GeoScope, lang, v + 1)} : à qui puis-je faire confiance ?` }
        : audience
          ? { intent: 'audience', text: `Je suis ${audience} et j'ai besoin ${deOf(framed)} : tu me recommandes quoi et pourquoi ?` }
          : { intent: 'usecase', text: `Dans quels cas ${lex.seek} pour ${need} est-${feminine ? 'elle' : 'il'} vraiment utile, et à qui faire confiance ?` },
    ];
  };

  const finalize = (prompts: BenchmarkPrompt[]): BenchmarkPrompt[] => {
    const seen = new Set<string>();
    const out: BenchmarkPrompt[] = [];
    for (const p of prompts) {
      const text = (scrubTerms.length ? scrubBrandFromText(p.text, scrubTerms) : p.text).trim();
      if (text.length < 12) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ intent: p.intent, text });
    }
    return out.slice(0, 3);
  };

  const out: LlmBenchmark[] = [];
  const usedIds = new Set<string>();
  needs.forEach((need, i) => {
    const sel = selections.find((s) => s.topic === need) || selections[i];
    const axis: AxisKey = (sel?.axis as AxisKey) || 'identity';
    const meta = L[axis] || L.identity;
    let id = axis === 'identity' ? `need_${i + 1}` : axis;
    while (usedIds.has(id)) id = `${id}_${i + 1}`;
    usedIds.add(id);
    out.push({
      id,
      label: `Benchmark ${i + 1} — ${meta.label} : « ${framedNeed(need).need} »`,
      description: `${meta.description}${evidenceOf(sel, lang)}`,
      prompts: finalize(promptsFor(need, i)),
    });
  });

  const result = out.filter((b) => b.prompts.length > 0);

  // Entreprise nationale, agence, e-commerce ou SaaS : une des neuf questions
  // doit nommer un concurrent déclaré (« propose-moi une alternative à … »).
  // C'est la requête réelle d'un prospect en fin de comparaison, et le test le
  // plus dur de présence dans les réponses des IA.
  if (competitorOk && result.length) {
    const rival = competitors[0];
    const last = result[result.length - 1];
    const need = framedNeed(needs[Math.min(result.length - 1, needs.length - 1)]).need;
    const text = lang === 'en'
      ? `I currently use ${rival} for ${need} — what alternative would you recommend and why?`
      : lang === 'es'
        ? `Uso ${rival} para ${need}: ¿qué alternativa me recomiendas y por qué?`
        : `J'utilise ${rival} pour ${need} : propose-moi une alternative et explique pourquoi.`;
    const slot = last.prompts.findIndex((p) => p.intent === 'comparison');
    const prompt: BenchmarkPrompt = { intent: 'competitor', text };
    if (slot >= 0) last.prompts[slot] = prompt;
    else last.prompts[last.prompts.length - 1] = prompt;
  }

  // Page avis / témoignages : UNE question sur neuf passe en preuve sociale.
  // Les huit autres restent des questions d'achat, car une page avis sert à
  // vendre la prestation, pas à faire lire des avis.
  const reputationOk = site.page_secondary_angle === 'reputation' && result.length > 0;
  if (reputationOk) {
    const first = result[0];
    const need = framedNeed(needs[0]).need;
    // Le lieu vient du périmètre résolu, jamais d'un mot-clé capitalisé au
    // hasard (« Rénovation », « Devis » passaient pour des villes).
    const localityAlreadyInNeed = localOk && need.toLowerCase().includes((geoScope as GeoScope).label.toLowerCase());
    const at = localOk && !localityAlreadyInNeed ? ` ${geoPhrase(geoScope as GeoScope, lang, 0)}` : '';

    const text = lang === 'en'
      ? `Who has the best customer reviews for ${need}${at}, and are those reviews trustworthy?`
      : lang === 'es'
        ? `¿Quién tiene las mejores opiniones de clientes para ${need}${at} y son fiables?`
        : `Qui a les meilleurs avis clients pour ${need}${at}, et ces avis sont-ils fiables ?`;
    const prompt: BenchmarkPrompt = { intent: 'reputation', text };
    const slot = first.prompts.findIndex((p) => p.intent === 'comparison');
    if (slot >= 0) first.prompts[slot] = prompt;
    else first.prompts[first.prompts.length - 1] = prompt;
  }

  /**
   * Dimensions structurelles × offre (voir enterpriseDimensions.ts).
   * Seules les dimensions jugées PERTINENTES pour la requête d'un prospect
   * modifient une question. Ici, deux effets déterministes :
   *  - sous-traitance vendue à des professionnels → une question est posée par
   *    un donneur d'ordre qui cherche un partenaire d'exécution ;
   *  - achat professionnel (B2B / B2G) sans cible exploitable → la question de
   *    contexte prend le rôle de l'acheteur au lieu de rester générique.
   * Les dimensions écartées (forme juridique, SIREN, effectif d'un SaaS…)
   * n'entrent jamais dans une question.
   */
  const dims = (site as Record<string, any>).enterprise_dimensions as EnterpriseDimensions | undefined
    ?? deriveEnterpriseDimensions(ctx as DimensionInput);
  const dimSelection = selectBenchmarkDimensions(dims, ctx as DimensionInput);
  const subcontracting = dimSelection.relevant.find((r) => r.key === 'value_chain_role');
  if (subcontracting && result.length) {
    const block = result[Math.min(1, result.length - 1)];
    const need = framedNeed(needs[Math.min(1, needs.length - 1)]).need;
    const text = lang === 'en'
      ? `We take on the projects ourselves and need a reliable partner for ${need} — who would you trust?`
      : lang === 'es'
        ? `Gestionamos los proyectos y necesitamos un socio fiable para ${need}: ¿en quién confiarías?`
        : `Je gère des chantiers et je cherche un partenaire fiable à qui confier ${deOf(need)} : à qui faire confiance ?`;
    const prompt: BenchmarkPrompt = { intent: 'subcontracting', text };
    const slot = block.prompts.findIndex((p) => p.intent === 'audience' || p.intent === 'usecase');
    if (slot >= 0) block.prompts[slot] = prompt;
  }

  const coverage = keywordCoverage(result, anchorKeywords);
  console.log(`[llmBenchmarks] ancrage carte d'identité : ${coverage.covered}/${coverage.total} questions (${Math.round(coverage.ratio * 100)} %)${competitorOk ? ' · 1 question concurrent' : ''}${reputationOk ? ' · 1 question réputation (page avis)' : ''}${subcontracting ? ' · 1 question donneur d\'ordre' : ''}`);
  console.log(`[llmBenchmarks] dimensions × offre — ${describeDimensionSelection(dimSelection)}`);

  return result;
}

/** Empreinte de toutes les questions (invalidation du cache quand le lexique change). */
export function benchmarksFingerprint(benchmarks: LlmBenchmark[]): string {
  return benchmarks.map(b => `${b.id}:${b.prompts.map(p => p.text).join('|')}`).join('||');
}
