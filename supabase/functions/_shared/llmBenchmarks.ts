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
import type { TopicSelection } from './questionTopics.ts';

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

type AxisKey = 'covered' | 'ranked' | 'demand' | 'identity';

const AXIS_LABELS: Record<PromptLang, Record<AxisKey, { label: string; description: string }>> = {
  fr: {
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

  /** Les trois formes de question, sur un besoin donné. */
  const promptsFor = (need: string): BenchmarkPrompt[] => {
    if (lang === 'en') {
      return [
        { intent: 'discovery', text: `I'm looking for ${lex.seek} for ${need} — what do you recommend?` },
        { intent: 'comparison', text: `Compare ${lex.comparePlural} for ${need}: which one stands out and why?` },
        localOk
          ? { intent: 'local', text: `I'm looking for ${lex.seek} for ${need} in ${area} — what would you recommend?` }
          : target
            ? { intent: 'audience', text: `I'm a ${target} and I need ${need}: which option would you recommend and why?` }
            : { intent: 'usecase', text: `In which situations is ${lex.seek} for ${need} genuinely worth it, and who should I trust?` },
      ];
    }
    if (lang === 'es') {
      return [
        { intent: 'discovery', text: `Busco ${lex.seek} para ${need}, ¿qué me recomiendas?` },
        { intent: 'comparison', text: `Compara ${lex.comparePlural} para ${need}: ¿cuál destaca y por qué?` },
        localOk
          ? { intent: 'local', text: `Busco ${lex.seek} para ${need} en ${area}, ¿qué me recomiendas?` }
          : target
            ? { intent: 'audience', text: `Soy ${target} y necesito ${need}: ¿qué opción recomiendas y por qué?` }
            : { intent: 'usecase', text: `¿En qué casos merece la pena ${lex.seek} para ${need} y en quién confiar?` },
      ];
    }
    return [
      { intent: 'discovery', text: `Je cherche ${lex.seek} pour ${need}, que me recommandes-tu ?` },
      { intent: 'comparison', text: `Compare-moi ${lex.comparePlural} pour ${need} : ${feminine ? 'laquelle' : 'lequel'} sort du lot et pourquoi ?` },
      localOk
        ? { intent: 'local', text: `Je cherche ${lex.seek} pour ${need} à ${area}, que me recommandes-tu ?` }
        : target
          ? { intent: 'audience', text: `Je suis ${target} et j'ai besoin de ${need} : tu me recommandes quoi et pourquoi ?` }
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
      label: `Benchmark ${i + 1} — ${meta.label} : « ${need} »`,
      description: `${meta.description}${evidenceOf(sel, lang)}`,
      prompts: finalize(promptsFor(need)),
    });
  });

  return out.filter((b) => b.prompts.length > 0);
}

/** Empreinte de toutes les questions (invalidation du cache quand le lexique change). */
export function benchmarksFingerprint(benchmarks: LlmBenchmark[]): string {
  return benchmarks.map(b => `${b.id}:${b.prompts.map(p => p.text).join('|')}`).join('||');
}
