/**
 * contentIntegrity/normalize.ts
 *
 * Normalisation du texte de page + détection de boilerplate cross-pages.
 * 100 % déterministe, 0 token LLM, aucune dépendance externe.
 *
 * Principe : un segment de texte (phrase) présent sur plus de `BOILERPLATE_RATIO`
 * des pages est considéré comme du gabarit (nav, footer, CTA, mentions légales)
 * et retiré du corpus utile avant toute comparaison de similarité.
 */

export const BOILERPLATE_RATIO = 0.6;
const BOILERPLATE_MIN_PAGES = 5;
const MIN_SEGMENT_WORDS = 3;

export interface NormalizedPage {
  url: string;
  /** Tokens du texte utile (boilerplate retiré). */
  tokens: string[];
  /** Nombre de mots utiles. */
  usefulWords: number;
  /** Nombre de mots avant retrait du boilerplate. */
  rawWords: number;
  /** Part du texte de la page qui est du gabarit (0-1). */
  templateRatio: number;
  /** Segments retenus (phrases utiles), utile au prompt LLM d'appoint. */
  segments: string[];
}

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9àâäéèêëîïôöùûüç'\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(raw: string): string[] {
  const n = normalizeText(raw);
  return n ? n.split(' ').filter((t) => t.length > 1) : [];
}

/** Découpe en segments (phrases / lignes) exploitables pour le boilerplate. */
export function splitSegments(raw: string): string[] {
  return raw
    .split(/(?:[.!?\n\r•|]|\s{2,})+/)
    .map((s) => normalizeText(s))
    .filter((s) => s.split(' ').filter(Boolean).length >= MIN_SEGMENT_WORDS);
}

export interface RawPageText {
  url: string;
  text: string;
  /** Taille HTML brute, pour le ratio texte/HTML du thin content. */
  htmlSizeBytes?: number | null;
}

/**
 * Normalise un corpus complet et retire le boilerplate détecté.
 */
export function normalizeCorpus(pages: RawPageText[]): NormalizedPage[] {
  const total = pages.length;
  const perPageSegments = pages.map((p) => ({ url: p.url, segments: splitSegments(p.text || '') }));

  // Fréquence documentaire des segments
  const docFreq = new Map<string, number>();
  for (const { segments } of perPageSegments) {
    for (const seg of new Set(segments)) {
      docFreq.set(seg, (docFreq.get(seg) || 0) + 1);
    }
  }

  const boilerplate = new Set<string>();
  if (total >= BOILERPLATE_MIN_PAGES) {
    for (const [seg, freq] of docFreq) {
      if (freq / total > BOILERPLATE_RATIO) boilerplate.add(seg);
    }
  }

  return perPageSegments.map(({ url, segments }) => {
    const kept = segments.filter((s) => !boilerplate.has(s));
    const rawWords = segments.reduce((acc, s) => acc + s.split(' ').length, 0);
    const usefulWords = kept.reduce((acc, s) => acc + s.split(' ').length, 0);
    const tokens = kept.join(' ').split(' ').filter((t) => t.length > 1);
    return {
      url,
      tokens,
      usefulWords,
      rawWords,
      templateRatio: rawWords > 0 ? Math.round(((rawWords - usefulWords) / rawWords) * 100) / 100 : 0,
      segments: kept,
    };
  });
}
