// _shared/linkedinCompliance.ts
//
// Couche de conformité LinkedIn 100 % déterministe (zéro token LLM) + scoring pondéré.
// Utilisée AVANT publication par linkedin-post-generator, et après publication par
// linkedin-post-auditor, pour que les deux boucles partagent exactement les mêmes règles.
//
// Principe : ce qui peut être garanti par du code ne doit jamais dépendre du prompt.
//  - caractères interdits (emoji, tirets cadratins, réservés Little Text Format)
//  - mention obligatoire @crawlers.fr
//  - bornage 1000-1500 signes hors hashtags, coupé sur frontière de phrase
//  - bloc hashtags normalisé en fin de post

export const MENTION = '@crawlers.fr';
export const MIN_BODY_CHARS = 1000;
export const MAX_BODY_CHARS = 1500;

export const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

// Tics LLM interdits (détectés pour le scoring "style", pas supprimés automatiquement
// car leur retrait mécanique casserait la phrase).
export const LLM_CLICHES = [
  'révolutionner', 'game-changer', 'game changer', 'unlock', 'dans un monde où',
  "à l'ère de", 'il est important de noter', 'en résumé', 'en conclusion',
  'pour conclure', 'in fine', 'plongeons', 'décryptons', 'sans plus attendre',
  'incontournable', 'véritable levier', 'au cœur de la transformation',
];

const MENTION_PLACEHOLDER = '\u0000CRAWLERS_MENTION\u0000';

/** Sépare corps et hashtags d'un texte complet. */
export function splitHashtags(fullText: string): { body: string; hashtags: string[] } {
  const text = (fullText ?? '').trim();
  const m = text.match(/\n*((?:#[\p{L}\p{N}_]+[ \t]*)+)$/u);
  if (!m) return { body: text, hashtags: [] };
  const hashtags = (m[1].match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.trim());
  return { body: text.slice(0, m.index).trim(), hashtags };
}

/** Normalise une liste de hashtags : # forcé, dédoublonnage, max 6. */
export function normalizeHashtags(tags: unknown): string[] {
  const arr = Array.isArray(tags) ? tags : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const t = String(raw ?? '').trim().replace(/^#*/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${t}`);
    if (out.length >= 6) break;
  }
  return out;
}

/** Retire emoji, tirets de ponctuation et caractères réservés, en préservant la mention. */
function stripForbiddenChars(input: string): string {
  let t = input.replace(EMOJI_RE, '');
  // Tirets cadratins / demi-cadratins utilisés comme ponctuation
  t = t.replace(/\s*[—–]\s*/g, '. ');
  // Tiret simple en incise ( - )
  t = t.replace(/\s+-\s+/g, '. ');
  // Caractères réservés Little Text Format, hors mention @crawlers.fr
  t = t.replace(/@crawlers\.fr/gi, MENTION_PLACEHOLDER);
  t = t.replace(/[()[\]{}<>\\*_~|@]/g, '');
  t = t.split(MENTION_PLACEHOLDER).join(MENTION);
  // Espaces / lignes
  t = t.replace(/\.\s*\./g, '.').replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** Découpe en phrases (frontières fiables : ponctuation forte ou saut de ligne). */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tronque à maxChars sur une frontière de phrase, sans jamais couper un mot. */
function truncateOnSentence(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body;
  const paras = body.split(/\n\s*\n/);
  let out = '';
  for (const para of paras) {
    let kept = '';
    for (const s of sentences(para)) {
      const next = kept ? `${kept} ${s}` : s;
      const total = out ? `${out}\n\n${next}` : next;
      if (total.length > maxChars) break;
      kept = next;
    }
    if (!kept) break;
    out = out ? `${out}\n\n${kept}` : kept;
    if (out.length >= maxChars) break;
  }
  return (out || body.slice(0, maxChars)).trim();
}

export interface ComplianceResult {
  body: string;
  hashtags: string[];
  fullText: string;
  changes: string[];
  /** true si le corps est encore sous MIN_BODY_CHARS (le code ne peut pas inventer du texte). */
  tooShort: boolean;
}

/**
 * Applique toutes les règles déterministes. Ne fait AUCUN appel LLM.
 * `hashtags` fournis en paramètre priment sur ceux détectés en fin de texte.
 */
export function enforceCaptionCompliance(
  rawText: string,
  options: { hashtags?: unknown } = {},
): ComplianceResult {
  const changes: string[] = [];
  const source = String(rawText ?? '');

  const split = splitHashtags(source);
  let body = split.body;

  const provided = normalizeHashtags(options.hashtags);
  const hashtags = provided.length ? provided : normalizeHashtags(split.hashtags);

  const beforeChars = body;
  body = stripForbiddenChars(body);
  if (body !== beforeChars) changes.push('forbidden_chars_stripped');

  if (!new RegExp(MENTION.replace('.', '\\.'), 'i').test(body)) {
    if (/\bCrawlers\b/.test(body)) {
      body = body.replace(/\bCrawlers\b/, MENTION);
    } else {
      body = `${body}\n\nOn en parle sur ${MENTION}.`;
    }
    changes.push('mention_injected');
  }

  if (body.length > MAX_BODY_CHARS) {
    body = truncateOnSentence(body, MAX_BODY_CHARS);
    changes.push('truncated_to_max');
    // La troncature peut avoir supprimé la mention : on la réinjecte.
    if (!new RegExp(MENTION.replace('.', '\\.'), 'i').test(body)) {
      body = truncateOnSentence(body, MAX_BODY_CHARS - MENTION.length - 24);
      body = `${body}\n\nOn en parle sur ${MENTION}.`;
      changes.push('mention_reinjected_after_truncate');
    }
  }

  const tooShort = body.length < MIN_BODY_CHARS;
  const fullText = hashtags.length ? `${body}\n\n${hashtags.join(' ')}` : body;

  return { body, hashtags, fullText, changes, tooShort };
}

// ─────────────────────────────────────────────────────────────
// Scoring pondéré : hook 0.35, produit 0.30, précision 0.20, style 0.15
// ─────────────────────────────────────────────────────────────

export interface Check { id: string; ok: boolean; weight: number; detail: string }

export interface CaptionScore {
  score: number;
  dimensions: { hook: number; product: number; precision: number; style: number; objectives: number };
  checks: Check[];
  failed: Check[];
  hook: string;
  length: number;
  hookStrong: boolean;
}

const GENERIC_HOOK_RE =
  /^(dans cet article|aujourd'?hui,? je|je suis (ravi|heureux)|petit (post|retour)|bonjour à tous|nouvelle semaine|nous sommes fiers)/i;
const TENSION_RE =
  /\d|%|jamais|personne|arrêt|stop|erreur|mythe|pourquoi|combien|invisible|ignor|aucun|zéro|faux/i;
const CTA_RE = /\?\s*$|dis-moi|réponds|commente|teste|essaie|essayer|échange|rdv|retrouve|découvre/i;
const HUMBLE_RE = /limite|biais|attention|ne garantit pas|pas magique|ne règle pas|encore perfectible|parfois|souvent/i;
const PEDAGOGUE_RE = /en fait|pourquoi|comment|mécanisme|étape|d'abord|ensuite|enfin|ça signifie/i;
const DATA_RE = /\d{2,}|\d+%|\d+\s*(€|euros?|jours?|mois|visites?|clics?|pages?|mots?)/i;

function dim(checks: Check[]): number {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  if (!total) return 100;
  const got = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  return Math.round((got / total) * 100);
}

/** Audit déterministe pondéré d'un post complet (corps + hashtags). Score 0-100. */
export function scoreCaption(fullText: string): CaptionScore {
  const text = String(fullText ?? '').trim();
  const { body } = splitHashtags(text);
  const len = body.length;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hook = lines[0] ?? '';
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim());
  const longParagraphs = paragraphs.filter((p) => p.replace(/\s+/g, ' ').length > 400).length;
  const lower = text.toLowerCase();
  const cliches = LLM_CLICHES.filter((c) => lower.includes(c));
  const genericHook = GENERIC_HOOK_RE.test(hook);
  const hookStrong =
    hook.length >= 40 && hook.length <= 140 && !genericHook && TENSION_RE.test(hook);

  const hookChecks: Check[] = [
    { id: 'hook_length', ok: hook.length >= 40 && hook.length <= 140, weight: 40, detail: `Hook de ${hook.length} signes (40-140 avant le "voir plus")` },
    { id: 'hook_not_generic', ok: !genericHook, weight: 35, detail: 'Hook non générique' },
    { id: 'hook_signal', ok: TENSION_RE.test(hook), weight: 25, detail: 'Hook porteur de tension ou de chiffre' },
  ];
  const productChecks: Check[] = [
    { id: 'mention_crawlers', ok: new RegExp(MENTION.replace('.', '\\.'), 'i').test(text), weight: 45, detail: `Mention ${MENTION}` },
    { id: 'product_named', ok: /crawlers/i.test(body), weight: 25, detail: 'Produit nommé dans le corps' },
    { id: 'cta', ok: /\?\s*$|commentaire|dis-moi|réponds|teste|essaie|essayer|échange/i.test(body.slice(-350)), weight: 30, detail: 'CTA en fin de post' },
  ];
  const precisionChecks: Check[] = [
    { id: 'length_min', ok: len >= MIN_BODY_CHARS, weight: 45, detail: `Longueur hors hashtags : ${len} (min ${MIN_BODY_CHARS})` },
    { id: 'length_max', ok: len <= MAX_BODY_CHARS, weight: 30, detail: `Longueur hors hashtags : ${len} (max ${MAX_BODY_CHARS})` },
    { id: 'hashtags', ok: splitHashtags(text).hashtags.length >= 3, weight: 25, detail: 'Au moins 3 hashtags' },
  ];
  const styleChecks: Check[] = [
    { id: 'no_emoji', ok: !EMOJI_RE.test(text), weight: 25, detail: 'Aucun emoji' },
    { id: 'no_emdash', ok: !/[—–]/.test(text), weight: 20, detail: 'Aucun tiret cadratin' },
    { id: 'no_reserved', ok: !/[()[\]{}<>\\*_~|]/.test(body), weight: 15, detail: 'Aucun caractère réservé LinkedIn' },
    { id: 'no_cliche', ok: cliches.length === 0, weight: 20, detail: cliches.length ? `Tics LLM : ${cliches.join(', ')}` : 'Aucun tic LLM' },
    { id: 'readability', ok: longParagraphs === 0 && paragraphs.length >= 4, weight: 20, detail: `${paragraphs.length} paragraphes, ${longParagraphs} trop longs` },
  ];

  const dimensions = {
    hook: dim(hookChecks),
    product: dim(productChecks),
    precision: dim(precisionChecks),
    style: dim(styleChecks),
  };
  const score = Math.round(
    0.35 * dimensions.hook + 0.3 * dimensions.product + 0.2 * dimensions.precision + 0.15 * dimensions.style,
  );

  const checks = [...hookChecks, ...productChecks, ...precisionChecks, ...styleChecks];
  return {
    score,
    dimensions,
    checks,
    failed: checks.filter((c) => !c.ok),
    hook,
    length: len,
    hookStrong,
  };
}
