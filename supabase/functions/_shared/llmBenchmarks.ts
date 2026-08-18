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

type AxisKey = 'value_prop' | 'covered' | 'ranked' | 'demand' | 'identity';

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

/**
 * Génère 3 benchmarks × 3 questions (découverte / comparaison / contexte).
 * 100 % déterministe (0 token LLM).
 *
 * `topics` : les besoins retenus (un par benchmark).
 * `selections` : mêmes besoins enrichis de l'axe de marché et des preuves.
 */
export function buildLlmBenchmarks(
  site: SiteContext & { domain?: string },
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
  const area = (ctx.commercial_area || '').trim();
  const localOk = isLocalQuestionRelevant(ctx) && !!area;
  const feminine = lex.seek.startsWith('une');
  const L = AXIS_LABELS[lang];

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
      if (job) return { need: job, audience: need };
    }
    return { need, audience: target };
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
    const geo = localOk ? (lang === 'en' ? ` in ${area}` : lang === 'es' ? ` en ${area}` : ` à ${area}`) : '';
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
          ? { intent: 'local', text: `I'm looking for ${lex.seek} for ${framed} near ${area} — who should I trust locally?` }
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
          ? { intent: 'local', text: `Busco ${lex.seek} para ${framed} cerca de ${area}, ¿en quién puedo confiar?` }
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
        ? { intent: 'local', text: `Je cherche ${lex.seek} pour ${need} à ${area}, que me recommandes-tu ?` }
        : audience
          ? { intent: 'audience', text: `Je suis ${audience} et j'ai besoin ${deOf(need)} : tu me recommandes quoi et pourquoi ?` }
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

  return out.filter((b) => b.prompts.length > 0);
}

/** Empreinte de toutes les questions (invalidation du cache quand le lexique change). */
export function benchmarksFingerprint(benchmarks: LlmBenchmark[]): string {
  return benchmarks.map(b => `${b.id}:${b.prompts.map(p => p.text).join('|')}`).join('||');
}
