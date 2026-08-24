/**
 * Construction des métadonnées légères du lexique. Ce module importe le gros
 * fichier expertTerms.ts et ne doit donc JAMAIS être importé par du code
 * applicatif : il sert au script de génération et à son test de synchronisation.
 */
import { expertTermsData } from "./expertTerms";
import type { ExpertTermMeta } from "./expertTermsMeta.generated";

export function buildExpertTermsMeta(): Record<string, Record<string, ExpertTermMeta>> {
  const out: Record<string, Record<string, ExpertTermMeta>> = {};
  for (const [language, terms] of Object.entries(expertTermsData)) {
    out[language] = {};
    for (const term of terms) {
      out[language][term.slug] = {
        term: term.term,
        // head() ne conserve que 155 caractères de description.
        description: term.fullDefinition.slice(0, 155),
      };
    }
  }
  return out;
}

export function serializeExpertTermsMeta(
  meta: Record<string, Record<string, ExpertTermMeta>>,
): string {
  return `// Fichier généré par scripts/genExpertTermsMeta.ts — ne pas éditer à la main.
// Source de vérité : src/data/expertTerms.ts

export interface ExpertTermMeta {
  term: string;
  description: string;
}

export const expertTermsMeta: Record<string, Record<string, ExpertTermMeta>> =
${JSON.stringify(meta, null, 2)};

export function getExpertTermMeta(
  slug: string,
  language = "fr",
): ExpertTermMeta | undefined {
  return (expertTermsMeta[language] ?? expertTermsMeta.fr)?.[slug];
}
`;
}
