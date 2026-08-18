/**
 * _shared/questionTopics.ts
 *
 * Détermine, AVANT toute interrogation des LLM, les besoins réellement
 * pertinents à tester pour un domaine. Sans cette étape, les questions étaient
 * construites sur la première valeur brute de `products_services` de la carte
 * d'identité — d'où des formulations hors sol du type « Je cherche un outil
 * pour Travaux de rénovation intérieure et extérieure ».
 *
 * Méthode 100 % déterministe (0 token LLM) :
 *   1. Univers de mots-clés du domaine (keyword_universe) : les requêtes que le
 *      marché tape réellement, priorisées par intention commerciale × volume.
 *   2. Repli sur la carte d'identité : chaque item de products_services est un
 *      besoin concret ; on les nettoie et on en garde jusqu'à 3.
 *
 * Consommateurs : calculate-llm-visibility (puis llmBenchmarks).
 */

export interface QuestionTopicsResult {
  /** Jusqu'à 3 besoins concrets, du plus prioritaire au moins prioritaire. */
  topics: string[];
  source: 'keyword_universe' | 'identity' | 'none';
}

/** Requêtes qui ne décrivent pas un besoin de prestataire (aides, docs, marques d'État…). */
const NON_NEED_PATTERNS = [
  /\bma\s?prime\b/i, /\bmaprimerenov\b/i, /\banah\b/i, /\bcee\b/i,
  /\bavis\b/i, /\bconnexion\b/i, /\bsimulateur\b/i, /\bcalcul\b/i,
  /\bdéfinition\b/i, /\bc'est quoi\b/i, /\bcode\s?promo\b/i, /\bemploi\b/i,
  /\brecrutement\b/i, /\bpdf\b/i, /\bexemple\s+de\s+devis\b/i,
];

/** Fragments purement transactionnels à retirer pour obtenir le besoin nu. */
const NOISE_PREFIX_RE = /^(travaux\s+de\s+|services?\s+de\s+|prestations?\s+de\s+|solutions?\s+de\s+|offre\s+de\s+)/i;
const NOISE_SUFFIX_RE = /\s+(prix|tarif|tarifs|coût|cout|devis|gratuit|pas\s+cher|en\s+ligne|aides?|subvention|2\d{3})$/i;
const PRICE_ONLY_RE = /^(prix|tarif|devis|coût|cout)\b/i;

const COMMERCIAL_INTENTS = /(transaction|commercial|décision|decision|buy|do)/i;

function normalizeTopic(raw: string): string {
  let t = (raw || '').trim().toLowerCase();
  if (!t) return '';
  t = t.replace(/["“”«»]/g, '').replace(/\s{2,}/g, ' ');
  t = t.replace(NOISE_PREFIX_RE, '');
  // On retire les qualificatifs de fin (« … prix », « … 2024 ») jusqu'à stabilité
  for (let i = 0; i < 3; i++) {
    const next = t.replace(NOISE_SUFFIX_RE, '').trim();
    if (next === t) break;
    t = next;
  }
  t = t.replace(/[.,;:]+$/, '').trim();
  return t;
}

/** Deux besoins sont redondants s'ils partagent l'essentiel de leurs mots pleins. */
function tokensOf(t: string): Set<string> {
  return new Set(
    t.split(/[^a-zà-ÿ0-9]+/i)
      .filter((w) => w.length > 3)
      .map((w) => w.replace(/s$/, '')),
  );
}

function isRedundant(candidate: string, kept: string[]): boolean {
  const a = tokensOf(candidate);
  if (a.size === 0) return true;
  for (const k of kept) {
    const b = tokensOf(k);
    let common = 0;
    for (const w of a) if (b.has(w)) common++;
    const ratio = common / Math.min(a.size, b.size);
    if (ratio >= 0.6) return true;
  }
  return false;
}

function isUsableTopic(t: string, brandTerms: string[]): boolean {
  if (t.length < 6 || t.length > 70) return false;
  if (PRICE_ONLY_RE.test(t)) return false;
  if (NON_NEED_PATTERNS.some((re) => re.test(t))) return false;
  const low = t.toLowerCase();
  if (brandTerms.some((b) => b.length >= 4 && low.includes(b))) return false;
  return true;
}

/**
 * Sélectionne jusqu'à `max` besoins concrets pour construire les questions.
 * `sb` peut être null : on retombe alors directement sur la carte d'identité.
 */
export async function selectQuestionTopics(
  sb: { from: (t: string) => any } | null,
  domain: string,
  identity: { products_services?: string | null; market_sector?: string | null },
  opts: { max?: number; brandTerms?: string[] } = {},
): Promise<QuestionTopicsResult> {
  const max = opts.max ?? 3;
  const brandTerms = (opts.brandTerms || []).map((b) => (b || '').toLowerCase()).filter(Boolean);
  const kept: string[] = [];

  // ── 1. Univers de mots-clés : ce que le marché tape vraiment ──
  if (sb && domain) {
    try {
      const bare = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const { data } = await sb
        .from('keyword_universe')
        .select('keyword, search_volume, intent')
        .in('domain', [bare, `www.${bare}`])
        .order('search_volume', { ascending: false, nullsFirst: false })
        .limit(120);

      const rows = (data || []) as Array<{ keyword: string; search_volume: number | null; intent: string | null }>;
      // Intentions commerciales d'abord : elles décrivent une recherche de
      // prestataire/produit, pas une recherche documentaire.
      const scored = rows
        .map((r) => ({
          topic: normalizeTopic(r.keyword),
          score: (r.search_volume || 0) * (COMMERCIAL_INTENTS.test(r.intent || '') ? 2 : 1),
        }))
        .filter((r) => isUsableTopic(r.topic, brandTerms))
        .sort((a, b) => b.score - a.score);

      for (const r of scored) {
        if (kept.length >= max) break;
        if (!isRedundant(r.topic, kept)) kept.push(r.topic);
      }
      if (kept.length > 0) return { topics: kept, source: 'keyword_universe' };
    } catch (_) {
      // non bloquant : on retombe sur la carte d'identité
    }
  }

  // ── 2. Repli : carte d'identité (chaque item est un besoin) ──
  const parts = String(identity.products_services || '')
    .split(/[,;]|\set\s/gi)
    .map(normalizeTopic)
    .filter((t) => isUsableTopic(t, brandTerms));
  for (const p of parts) {
    if (kept.length >= max) break;
    if (!isRedundant(p, kept)) kept.push(p);
  }
  if (kept.length > 0) return { topics: kept, source: 'identity' };

  const sector = normalizeTopic(String(identity.market_sector || ''));
  if (sector && isUsableTopic(sector, brandTerms)) return { topics: [sector], source: 'identity' };

  return { topics: [], source: 'none' };
}
