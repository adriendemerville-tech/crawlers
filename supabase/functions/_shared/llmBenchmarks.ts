/**
 * _shared/llmBenchmarks.ts
 *
 * Construit TROIS benchmarks LLM distincts, de 3 questions chacun, sur des
 * intentions différentes (découverte / comparaison / usage & preuve).
 * Chaque benchmark est mesuré séparément et donne sa propre carte de résultats
 * dans les rapports : un score global unique masquait le fait qu'une marque
 * peut être citée en comparatif mais invisible en découverte.
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

export interface BenchmarkPrompt {
  intent: string;
  text: string;
}

export interface LlmBenchmark {
  id: 'discovery' | 'comparison' | 'usage';
  label: string;
  description: string;
  prompts: BenchmarkPrompt[];
}

const LABELS: Record<PromptLang, Record<LlmBenchmark['id'], { label: string; description: string }>> = {
  fr: {
    discovery: {
      label: 'Benchmark 1 — Découverte du besoin',
      description: "L'internaute exprime un besoin sans idée préconçue : mesure la capacité à émerger spontanément.",
    },
    comparison: {
      label: 'Benchmark 2 — Comparaison et arbitrage',
      description: "L'internaute compare des options et interroge les prix : mesure la présence dans les listes de recommandation.",
    },
    usage: {
      label: "Benchmark 3 — Contexte d'usage et preuve",
      description: "L'internaute qualifie son contexte et demande des preuves : mesure la solidité des signaux de confiance.",
    },
  },
  en: {
    discovery: {
      label: 'Benchmark 1 — Need discovery',
      description: 'The user states a need with no preconception: measures spontaneous emergence.',
    },
    comparison: {
      label: 'Benchmark 2 — Comparison and trade-offs',
      description: 'The user compares options and asks about pricing: measures presence in recommendation lists.',
    },
    usage: {
      label: 'Benchmark 3 — Usage context and proof',
      description: 'The user qualifies their context and asks for evidence: measures trust signals.',
    },
  },
  es: {
    discovery: {
      label: 'Benchmark 1 — Descubrimiento de la necesidad',
      description: 'El usuario expresa una necesidad sin idea previa: mide la aparición espontánea.',
    },
    comparison: {
      label: 'Benchmark 2 — Comparación y decisión',
      description: 'El usuario compara opciones y pregunta precios: mide la presencia en listas de recomendación.',
    },
    usage: {
      label: 'Benchmark 3 — Contexto de uso y pruebas',
      description: 'El usuario detalla su contexto y pide pruebas: mide las señales de confianza.',
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
 * Génère 3 benchmarks × 3 questions. Les questions sont déterministes
 * (0 token LLM) et dérivées de la carte d'identité.
 */
export function buildLlmBenchmarks(
  site: SiteContext & { domain?: string },
  lang: PromptLang = 'fr',
  extraBrandNames: (string | null | undefined)[] = [],
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
  const need = mainNeedOf(ctx, lang);
  const sector = (ctx.market_sector || '').trim();
  const target = (ctx.target_audience || '').trim();
  const area = (ctx.commercial_area || '').trim();
  const localOk = isLocalQuestionRelevant(ctx);
  const feminine = lex.seek.startsWith('une');

  const L = LABELS[lang];

  const discovery: BenchmarkPrompt[] = [];
  const comparison: BenchmarkPrompt[] = [];
  const usage: BenchmarkPrompt[] = [];

  if (lang === 'en') {
    discovery.push({ intent: 'discovery', text: `I'm looking for ${lex.seek} for ${need}, any ideas?` });
    discovery.push({ intent: 'sector', text: `I need help with ${sector || need} — who should I turn to and why?` });
    discovery.push({ intent: 'criteria', text: `What criteria matter when choosing ${lex.seek} for ${need}?` });

    comparison.push({ intent: 'comparison', text: `Compare ${lex.comparePlural} for ${need}: which one stands out?` });
    comparison.push({ intent: 'alternative', text: `What alternatives exist for ${need}, beyond the big well-known players?` });
    comparison.push({ intent: 'price', text: `How much does ${need} cost and how is pricing usually set?` });

    usage.push(localOk
      ? { intent: 'local', text: `Which ${lex.noun} handles ${need} in ${area}?` }
      : target
        ? { intent: 'audience', text: `I'm a ${target}: which ${lex.noun} for ${need} would you recommend?` }
        : { intent: 'usecase', text: `In which situations is ${lex.seek} for ${need} genuinely worth it?` });
    usage.push({ intent: 'proof', text: `What customer feedback or reviews do you rely on to recommend ${need}?` });
    usage.push({ intent: 'decision', text: `If you had to recommend only one option for ${need}, which one and why?` });
  } else if (lang === 'es') {
    discovery.push({ intent: 'discovery', text: `Busco ${lex.seek} para ${need}, ¿alguna idea?` });
    discovery.push({ intent: 'sector', text: `Necesito ayuda con ${sector || need}, ¿a quién puedo dirigirme y por qué?` });
    discovery.push({ intent: 'criteria', text: `¿Qué criterios hay que mirar para elegir ${lex.seek} para ${need}?` });

    comparison.push({ intent: 'comparison', text: `Compara ${lex.comparePlural} para ${need}: ¿cuál destaca?` });
    comparison.push({ intent: 'alternative', text: `¿Qué alternativas existen para ${need}, aparte de los grandes conocidos?` });
    comparison.push({ intent: 'price', text: `¿Cuánto cuesta ${need} y cómo se fijan los precios?` });

    usage.push(localOk
      ? { intent: 'local', text: `¿Qué ${lex.noun} se encarga de ${need} en ${area}?` }
      : target
        ? { intent: 'audience', text: `Soy ${target}: ¿qué ${lex.noun} para ${need} recomiendas?` }
        : { intent: 'usecase', text: `¿En qué casos merece la pena ${lex.seek} para ${need}?` });
    usage.push({ intent: 'proof', text: `¿En qué opiniones o experiencias de clientes te basas para recomendar ${need}?` });
    usage.push({ intent: 'decision', text: `Si solo pudieras recomendar uno para ${need}, ¿cuál y por qué?` });
  } else {
    discovery.push({ intent: 'discovery', text: `Je cherche ${lex.seek} pour ${need}, t'as des idées ?` });
    discovery.push({ intent: 'sector', text: `J'ai besoin d'aide en ${sector || need} : à qui s'adresser et pourquoi ?` });
    discovery.push({ intent: 'criteria', text: `Quels critères regarder pour bien choisir ${lex.seek} pour ${need} ?` });

    comparison.push({ intent: 'comparison', text: `Compare-moi ${lex.comparePlural} pour ${need} : ${feminine ? 'laquelle' : 'lequel'} sort du lot ?` });
    comparison.push({ intent: 'alternative', text: `Quelles alternatives existent pour ${need}, à part les gros acteurs connus ?` });
    comparison.push({ intent: 'price', text: `Combien coûte ${need} et comment sont fixés les prix ?` });

    usage.push(localOk
      ? { intent: 'local', text: `${feminine ? 'Quelle' : 'Quel'} ${lex.noun} pour ${need} à ${area} ?` }
      : target
        ? { intent: 'audience', text: `Je suis ${target} : ${lex.seek} pour ${need}, tu recommandes quoi ?` }
        : { intent: 'usecase', text: `Dans quels cas ${lex.seek} pour ${need} est-${feminine ? 'elle' : 'il'} vraiment utile ?` });
    usage.push({ intent: 'proof', text: `Sur quels retours d'expérience ou avis clients tu te bases pour recommander ${need} ?` });
    usage.push({ intent: 'decision', text: `Si tu devais n'en recommander qu'un seul pour ${need}, lequel et pourquoi ?` });
  }

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

  const all: LlmBenchmark[] = [
    { id: 'discovery', label: L.discovery.label, description: L.discovery.description, prompts: finalize(discovery) },
    { id: 'comparison', label: L.comparison.label, description: L.comparison.description, prompts: finalize(comparison) },
    { id: 'usage', label: L.usage.label, description: L.usage.description, prompts: finalize(usage) },
  ];
  return all.filter(b => b.prompts.length > 0);
}

/** Empreinte de toutes les questions (invalidation du cache quand le lexique change). */
export function benchmarksFingerprint(benchmarks: LlmBenchmark[]): string {
  return benchmarks.map(b => `${b.id}:${b.prompts.map(p => p.text).join('|')}`).join('||');
}
