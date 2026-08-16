/**
 * Garde-fous LLM partagés (Lot 2 du plan de correctifs Marina).
 *
 * Trois protections, appliquées à TOUS les appelants de `lovableAI.ts` :
 *  1. Entrée : refus d'appel quand le contexte de page utile est vide
 *     (un LLM sans contenu invente — c'est l'origine du « 0 avis client »).
 *  2. Sortie : rejet / nettoyage des fuites de gabarit de prompt
 *     (« CONTENU PAGE: », « Utilise ces informations », balises internes).
 *  3. Année : interdiction des années codées en dur, injection de l'année courante.
 */

/** Erreur levée quand le contexte fourni au LLM est insuffisant. */
export class InsufficientContextError extends Error {
  constructor(public readonly label: string, public readonly chars: number, public readonly minChars: number) {
    super(`Contexte insuffisant pour ${label} : ${chars} caractères utiles (minimum ${minChars}). Module marqué non concluant.`);
    this.name = 'InsufficientContextError';
  }
}

/** Longueur de texte utile (hors balises, scripts et espaces). */
export function usefulTextLength(raw: string | null | undefined): number {
  if (!raw) return 0;
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** Le contexte est-il exploitable par un LLM ? */
export function isContextUsable(raw: string | null | undefined, minChars = 300): boolean {
  return usefulTextLength(raw) >= minChars;
}

/**
 * Marqueurs de gabarit de prompt : leur présence dans une sortie signifie que
 * le modèle a recopié l'énoncé au lieu d'analyser.
 */
export const PROMPT_LEAK_PATTERNS: RegExp[] = [
  /CONTENU\s+(?:DE\s+LA\s+)?PAGE\s*:/i,
  /CONTEXTE\s+(?:DE\s+LA\s+)?PAGE\s*:/i,
  /Utilise\s+ces\s+(?:informations|données)/i,
  /Voici\s+le\s+(?:contenu|contexte)\s+(?:de\s+la\s+page|fourni)/i,
  /GÉNÈRE\s+un\s+JSON/i,
  /RÈGLE\s+ABSOLUE/i,
  /DONNÉES\s+MARCHÉ\s*\(DataForSEO\)/i,
  /\bMODE\s+(?:CONTENU|ÉDITORIAL)\s*:/i,
  /<\/?(?:user_input|tool_result|page_context)>/i,
  /\bE-E-A-T\s*:\s*AuthorBio=/i,
];

/** Une sortie contient-elle une fuite de gabarit ? */
export function hasPromptLeak(text: string | null | undefined): boolean {
  if (!text) return false;
  return PROMPT_LEAK_PATTERNS.some((re) => re.test(text));
}

/**
 * Retire les fragments de gabarit d'une chaîne destinée à un rapport.
 * Supprime la ligne fautive entière plutôt que le seul marqueur, pour éviter
 * de laisser une phrase tronquée dans le PDF.
 */
export function stripPromptLeaks(text: string): string {
  if (!text || !hasPromptLeak(text)) return text;
  const cleaned = text
    .split(/\n/)
    .filter((line) => !PROMPT_LEAK_PATTERNS.some((re) => re.test(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Sortie mono-ligne entièrement polluée : on neutralise proprement.
  if (!cleaned) return '';
  return cleaned;
}

/** Nettoie récursivement toutes les chaînes d'un objet JSON de rapport. */
export function stripPromptLeaksDeep<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === 'string') return stripPromptLeaks(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => stripPromptLeaksDeep(v, depth + 1)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripPromptLeaksDeep(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

/** Année courante (UTC) — jamais codée en dur dans un prompt. */
export function currentYear(): number {
  return new Date().getUTCFullYear();
}

/**
 * Remplace toute année révolue codée en dur (2019 → année courante - 1) par
 * l'année courante, et ajoute un rappel de date. À appliquer aux prompts
 * système / d'instructions, jamais aux données factuelles datées.
 */
export function injectCurrentYear(prompt: string): string {
  const year = currentYear();
  const replaced = prompt.replace(/\b(20[1-4]\d)\b/g, (match) => {
    const n = Number(match);
    return n < year ? String(year) : match;
  });
  return `${replaced}\n\nDATE DE RÉFÉRENCE: nous sommes en ${year}. N'utilise JAMAIS une autre année comme année courante.`;
}
