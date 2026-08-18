/**
 * _shared/benchmarkQuestionWriter.ts
 *
 * Réécriture NATURELLE des questions de benchmark LLM.
 *
 * Le CHOIX de ce qui est testé reste 100 % déterministe (questionTopics.ts :
 * axes couvert / mieux classé / non capté ; llmBenchmarks.ts : formes découverte
 * / comparaison / contexte). Ce module ne change ni le nombre de questions, ni
 * leur intention, ni le besoin testé : il ne fait que reformuler la phrase comme
 * la poserait un vrai prospect, à partir de la carte d'identité.
 *
 * Coût : UN seul appel LLM par audit (les 9 questions dans le même appel),
 * modèle rapide, sortie JSON. Tout échec ou toute sortie non conforme retombe,
 * question par question, sur la formulation déterministe d'origine.
 *
 * Garde-fous de sortie : pas de mention de marque ni de domaine, une seule
 * question par entrée, longueur bornée, point d'interrogation final, langue
 * conservée, aucune ligne de prompt recopiée.
 */

import { callRoutedAI } from './aiRouter.ts';
import { buildBrandScrubTerms, scrubBrandFromText, type SiteContext, type PromptLang } from './naturalPrompts.ts';
import type { LlmBenchmark } from './llmBenchmarks.ts';

const INTENT_ROLE: Record<string, string> = {
  discovery: "découverte : le prospect ne connaît aucun acteur et demande une recommandation",
  comparison: "comparaison : le prospect veut confronter plusieurs options et comprendre ce qui les sépare",
  local: "contexte géographique : le prospect cherche un prestataire dans sa zone",
  audience: "contexte de profil : le prospect se présente puis expose son besoin",
  usecase: "contexte d'usage : le prospect demande dans quels cas c'est pertinent et à qui se fier",
};

const AXIS_ROLE: Record<string, string> = {
  value_prop: "proposition de valeur centrale de l'entreprise : la question doit porter DIRECTEMENT sur cette offre",
  covered: "besoin déjà couvert par le site dans Google",
  ranked: "besoin sur lequel le site est le mieux classé dans Google",
  demand: "besoin très recherché que le site n'adresse pas",
  identity: "besoin déclaré dans la carte d'identité",
};

type QuestionArchetype = 'local_commerce' | 'local_service' | 'software' | 'ecommerce' | 'agency' | 'generic';

/** Archétype de question, déduit du modèle d'affaires et de la zone de chalandise. */
function resolveArchetype(site: Record<string, any>): QuestionArchetype {
  const model = String(site.business_model || '').toLowerCase();
  const entity = String(site.entity_type || '').toLowerCase();
  const hasArea = !!String(site.commercial_area || '').trim();
  if (model.startsWith('saas') || entity === 'saas') return 'software';
  if (model.startsWith('ecommerce') || model.startsWith('marketplace') || entity === 'ecommerce') return 'ecommerce';
  if (model === 'service_agency') return 'agency';
  if (model === 'commerce_local' || model === 'retail' || model === 'restaurant') return hasArea ? 'local_commerce' : 'generic';
  if (model === 'service_local' || model === 'leadgen' || model === 'artisan') return hasArea ? 'local_service' : 'generic';
  return hasArea ? 'local_service' : 'generic';
}

const ARCHETYPE_DIRECTIVE: Record<QuestionArchetype, string> = {
  local_commerce:
    "Commerce de proximité : les questions doivent être TRÈS directes et géolocalisées, comme « je cherche un fleuriste à Aix-en-Provence » ou « quel fleuriste ouvert près d'Aix-en-Provence me conseilles-tu ? ». Pas de mise en contexte longue, pas de vocabulaire d'entreprise.",
  local_service:
    "Service ou artisan intervenant sur une zone : questions directes du type « je cherche une entreprise de rénovation de salle de bain à Marseille » ou « qui peut refaire ma toiture près de Marseille ? ». Le lieu doit apparaître dans la question.",
  software:
    "Logiciel / service en ligne : la question doit nommer la TÂCHE à accomplir, comme « quel outil pour piloter mon SEO et ma visibilité dans les IA ? ». Pas de lieu, pas de nom de produit.",
  ecommerce:
    "Vente en ligne : questions d'achat du type « où acheter <produit> en ligne, en qui avoir confiance ? ». Pas de lieu.",
  agency:
    "Agence / prestataire B2B : questions du type « quelle agence pour <mission> ? », en précisant le profil du demandeur quand c'est utile.",
  generic:
    "Prestataire généraliste : questions de recommandation simples, à la première personne, sans lieu si la zone n'est pas connue.",
};

/** Marqueurs d'une sortie polluée (fuite de prompt, champ brut, méta-discours). */
const LEAK_RE = /(CONTENU PAGE|carte d'identité|benchmark|snake_case|\{\{|\}\}|^\s*[-*]\s|json|"intent"|prospect\b.*:\s*$)/i;

function sanitize(raw: unknown): string {
  let t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^["'«“]+/, '').replace(/["'»”]+$/, '').trim();
  // Une seule question : on coupe après le premier point d'interrogation.
  const q = t.indexOf('?');
  if (q > 0) t = t.slice(0, q + 1);
  return t.trim();
}

function isAcceptable(text: string, scrubTerms: string[]): boolean {
  if (text.length < 20 || text.length > 220) return false;
  if (!text.endsWith('?')) return false;
  if (LEAK_RE.test(text)) return false;
  if (/https?:\/\/|www\.|\.[a-z]{2,4}\b\/?$/i.test(text)) return false;
  if (scrubTerms.length && scrubBrandFromText(text, scrubTerms).trim() !== text) return false;
  return true;
}

/**
 * Reformule les questions des benchmarks. Renvoie toujours une structure de
 * même forme que l'entrée ; chaque question non validée garde sa version
 * déterministe.
 */
export async function naturalizeBenchmarkQuestions(
  benchmarks: LlmBenchmark[],
  site: SiteContext & { domain?: string; business_model?: string | null },
  lang: PromptLang = 'fr',
): Promise<{ benchmarks: LlmBenchmark[]; rewritten: number; total: number }> {
  const total = benchmarks.reduce((n, b) => n + b.prompts.length, 0);
  if (!benchmarks.length || !total) return { benchmarks, rewritten: 0, total: 0 };

  const scrubTerms = buildBrandScrubTerms(site.domain, [site.brand_name, site.site_name]);

  const identity = [
    site.market_sector ? `Secteur : ${site.market_sector}` : '',
    site.products_services ? `Ce que l'entreprise vend : ${site.products_services}` : '',
    site.target_audience ? `Clients visés : ${site.target_audience}` : '',
    site.commercial_area ? `Zone de chalandise : ${site.commercial_area}` : '',
    site.entity_type ? `Type d'entité : ${site.entity_type}` : '',
    (site as any).business_model ? `Modèle d'affaires : ${(site as any).business_model}` : '',
  ].filter(Boolean).join('\n');

  const blocks = benchmarks.map((b, i) => ({
    index: i,
    axe: AXIS_ROLE[b.id.replace(/_\d+$/, '')] || AXIS_ROLE.identity,
    besoin: (b.label.split('«')[1] || '').replace(/»/g, '').trim() || b.label,
    questions: b.prompts.map((p) => ({
      intent: p.intent,
      role: INTENT_ROLE[p.intent] || 'question de recommandation',
      deterministe: p.text,
    })),
  }));

  const system = [
    "Tu écris des questions que de vrais clients potentiels posent à ChatGPT, Gemini ou Perplexity quand ils cherchent un prestataire ou un outil.",
    "Ces questions servent à mesurer si une entreprise est citée spontanément par les IA : elles ne doivent donc JAMAIS nommer l'entreprise auditée, sa marque, ni son site.",
    "Contraintes absolues : tu conserves exactement le même nombre de blocs et de questions, le même besoin testé et la même intention pour chaque question. Tu ne fais que reformuler dans une langue naturelle, parlée, à la première personne.",
    "Une seule phrase interrogative par question, entre 20 et 200 caractères, sans liste, sans guillemets, sans jargon SEO, sans terme technique interne.",
    lang === 'fr' ? "Rédige en français." : lang === 'es' ? "Escribe en español." : "Write in English.",
    "Réponds uniquement en JSON : {\"blocks\":[{\"index\":0,\"questions\":[\"…\",\"…\",\"…\"]}]}",
  ].join('\n');

  const user = [
    "Carte d'identité de l'entreprise auditée (contexte uniquement, à ne jamais citer) :",
    identity || '(non renseignée)',
    '',
    "Blocs à reformuler (le besoin et l'intention sont imposés) :",
    JSON.stringify(blocks, null, 1),
  ].join('\n');

  let parsed: any = null;
  try {
    const { content } = await callRoutedAI('benchmark_questions', {
      system,
      user,
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 900,
      fallbackModel: 'google/gemini-3-flash-preview',
      timeoutMs: 45_000,
    });
    parsed = JSON.parse(content.replace(/^```(?:json)?|```$/g, '').trim());
  } catch (e) {
    console.warn('[benchmarkQuestions] réécriture LLM indisponible, formulation déterministe conservée:', (e as Error).message);
    return { benchmarks, rewritten: 0, total };
  }

  const byIndex = new Map<number, string[]>();
  for (const blk of Array.isArray(parsed?.blocks) ? parsed.blocks : []) {
    const idx = Number(blk?.index);
    if (!Number.isInteger(idx)) continue;
    const qs = Array.isArray(blk?.questions) ? blk.questions.map(sanitize) : [];
    byIndex.set(idx, qs);
  }

  const seen = new Set<string>();
  let rewritten = 0;
  const out = benchmarks.map((b, i) => {
    const qs = byIndex.get(i) || [];
    const prompts = b.prompts.map((p, j) => {
      const candidate = qs[j] || '';
      if (!isAcceptable(candidate, scrubTerms)) return p;
      const key = candidate.toLowerCase();
      if (seen.has(key)) return p;
      seen.add(key);
      rewritten++;
      return { intent: p.intent, text: candidate };
    });
    // Une question déterministe conservée peut désormais doublonner : on garde
    // l'unicité globale des textes posés.
    for (const p of prompts) seen.add(p.text.toLowerCase());
    return { ...b, prompts };
  });

  console.log(`[benchmarkQuestions] ${rewritten}/${total} questions reformulées par LLM (1 appel)`);
  return { benchmarks: out, rewritten, total };
}
