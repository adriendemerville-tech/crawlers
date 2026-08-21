// ============================================================================
// dictadeviEditorialBrief.ts — Brief éditorial DictaDevi (repères, pas cahier
// des charges figé).
//
// Source de vérité distante :
//   GET {DICTADEVI_API_URL}/api/v1/editorial-brief?format=markdown
//   Headers: Authorization: Bearer ${DICTADEVI_API_KEY}
//
// Le brief distant est mis en cache mémoire (6 h) pour éviter un appel réseau
// par cycle Parménion. En cas d'indisponibilité, on retombe sur le brief de
// repli figé ci-dessous (version validée le 2026-08-21) : mieux vaut une ligne
// éditoriale un peu datée qu'aucune ligne éditoriale.
// ============================================================================

const DEFAULT_BASE_URL = 'https://dictadevi.io';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface EditorialBrief {
  markdown: string;
  source: 'remote' | 'fallback';
  fetched_at: string;
}

let cache: { brief: EditorialBrief; expires_at: number } | null = null;

/** Brief de repli — repères, non impératifs (cf. §"Ce qu'on évite" pour les gardes dures). */
export const DICTADEVI_FALLBACK_BRIEF = `# Brief éditorial DictaDevi (repères)

## Positionnement
DictaDevi est un logiciel de devis vocal pour artisans de la rénovation.
Deux audiences : (1) artisans (électricien, plombier, peintre, plaquiste, carreleur, maçon, menuisier, couvreur…) ; (2) particuliers en projet de travaux.
Un article doit être utile à au moins une de ces audiences, idéalement aux deux.

## Axes privilégiés (zones de valeur, pas cases à cocher)
1. Prix et chiffrage travaux — fourchettes, coûts au m², ratios de métré.
2. Métrés et quantitatifs — surfaces, linéaires, rendements, pertes matière.
3. Cadre légal du devis et de la facture bâtiment — TVA, acompte, retenue de garantie, mentions obligatoires.
4. Normes et règles de l'art — DTU, RE2020, RGE, pare-vapeur, ventilation.
5. Organisation et gestion de chantier artisan — planning, relances, sous-traitance, commandes fournisseurs.
6. Dictée vocale et IA appliquées au chiffrage — gain de temps, saisie manuelle vs vocale, mobilité chantier (max 1 article/mois).

## Ce qu'on évite
- SEO local générique, balise title, netlinking, marketing digital générique.
- Comparatifs nommés de logiciels concurrents.
- Crypto, IA généraliste, no-code.
- Tout contenu sans lien direct avec un devis, un prix de travaux ou un chantier bâtiment français.
Un sujet tangent réellement lié au chiffrage ou à la gestion de chantier se discute avant publication.

## Repères de forme
- Longueur : 1 500–2 500 mots.
- Structure : 1 H1, 5–8 H2, H3 si besoin.
- Au moins un tableau chiffré Markdown par article.
- FAQ : 4 à 6 questions/réponses courtes en H3.
- Maillage interne : 3 à 6 liens vers des pages existantes (/prix-travaux/…, /devis-travaux/…, /logiciel-devis/…, /encyclopedie/…).
- Liens externes : sources officielles (service-public.fr, impots.gouv.fr, legifrance, ADEME, AFNOR).
- Images : hébergées sur DictaDevi (site-assets), jamais d'URL externe, alt descriptif.
- Chiffres sourcés ou cohérents avec les pages /prix-travaux. Aucun témoignage, statistique ou garantie inventé.

## Workflow
Articles livrés en draft, validation DictaDevi avant publication. Rythme : 4 à 6 articles/mois.
Cible éditoriale : /encyclopedie/{slug}.`;

async function fetchRemoteBrief(): Promise<string | null> {
  const apiKey = Deno.env.get('DICTADEVI_API_KEY');
  if (!apiKey) return null;
  const baseUrl = (Deno.env.get('DICTADEVI_API_URL') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = `${baseUrl}/api/v1/editorial-brief?format=markdown`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'text/markdown, text/plain, application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn(`[dictadevi-brief] HTTP ${resp.status} — fallback brief figé`);
      return null;
    }
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await resp.json() as Record<string, unknown>;
      const md = (json.markdown ?? json.brief ?? json.content ?? json.data) as unknown;
      return typeof md === 'string' && md.trim().length > 200 ? md : null;
    }
    const text = await resp.text();
    return text.trim().length > 200 ? text : null;
  } catch (e) {
    console.warn('[dictadevi-brief] indisponible — fallback brief figé', e);
    return null;
  }
}

/** Récupère le brief (cache mémoire 6 h, fallback figé). Ne lève jamais. */
export async function getDictadeviEditorialBrief(): Promise<EditorialBrief> {
  const now = Date.now();
  if (cache && cache.expires_at > now) return cache.brief;

  const remote = await fetchRemoteBrief();
  const brief: EditorialBrief = {
    markdown: remote ?? DICTADEVI_FALLBACK_BRIEF,
    source: remote ? 'remote' : 'fallback',
    fetched_at: new Date().toISOString(),
  };
  // On ne met en cache le repli que 15 min pour retenter l'endpoint plus vite.
  cache = { brief, expires_at: now + (remote ? CACHE_TTL_MS : 15 * 60 * 1000) };
  return brief;
}

/** Bloc injectable dans un system prompt LLM. */
export function renderDictadeviBriefBlock(brief: EditorialBrief): string {
  return [
    '<dictadevi_editorial_brief>',
    `_Source : ${brief.source === 'remote' ? 'endpoint /api/v1/editorial-brief' : 'brief de repli figé'} — ${brief.fetched_at}_`,
    brief.markdown.trim(),
    '',
    "Ce brief est un repère, pas un cahier des charges : tu peux proposer un angle hors des 6 axes s'il sert un artisan ou un particulier en travaux. En revanche la section « Ce qu'on évite » est une interdiction dure.",
    '</dictadevi_editorial_brief>',
  ].join('\n');
}

// ── Garde dure : sujets hors brief ────────────────────────────────────────────

const OFF_BRIEF_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bseo\s*local\b|\bnetlinking\b|\bbacklink/i, label: 'SEO local / netlinking' },
  { re: /\bbalise\s+title\b|\bmeta\s*(title|description)\b|\bmaillage\s+interne\b|\bdonn[ée]es\s+structur[ée]es\b/i, label: 'tactique SEO technique' },
  { re: /\bmarketing\s+(digital|de\s+contenu)\b|\btunnel\s+de\s+conversion\b|\bgoogle\s+ads\b|\bsea\b/i, label: 'marketing digital générique' },
  { re: /\bcrypto|\bblockchain|\bnft\b|\bno[-\s]?code\b|\bchatgpt\b(?!.*devis)/i, label: 'crypto / no-code / IA généraliste' },
  { re: /\b(meilleurs?|top\s*\d+|comparatif)\b.*\blogiciels?\b/i, label: 'comparatif nommé de logiciels concurrents' },
];

const ON_BRIEF_PATTERNS = /devis|facture|chantier|travaux|artisan|m[ée]tr[ée]|tva|dtu|re2020|rge|plomberie|[ée]lectricit[ée]|peinture|carrelage|ma[çc]onnerie|menuiserie|couverture|isolation|prix\s+au\s+m2|dict[ée]e|vocal/i;

export interface OffBriefVerdict {
  off_brief: boolean;
  reason?: string;
}

/**
 * Vérifie qu'un sujet (titre + mot-clé) reste dans la ligne éditoriale DictaDevi.
 * Un motif interdit ne bloque que s'il n'est pas rattrapé par un ancrage métier
 * explicite (ex. « mentions obligatoires du devis » reste valide).
 */
export function checkDictadeviTopicAgainstBrief(text: string): OffBriefVerdict {
  const t = (text || '').trim();
  if (!t) return { off_brief: false };
  for (const { re, label } of OFF_BRIEF_PATTERNS) {
    if (re.test(t) && !ON_BRIEF_PATTERNS.test(t)) {
      return { off_brief: true, reason: `Hors brief DictaDevi (${label}) : "${t.slice(0, 120)}"` };
    }
  }
  if (!ON_BRIEF_PATTERNS.test(t)) {
    return { off_brief: true, reason: `Aucun ancrage devis / prix travaux / chantier détecté : "${t.slice(0, 120)}"` };
  }
  return { off_brief: false };
}
