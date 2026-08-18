/**
 * _shared/questionTopics.ts
 *
 * Détermine, AVANT toute interrogation des LLM, les besoins réellement
 * pertinents à tester pour un domaine — et sur quel AXE DE MARCHÉ chacun est
 * choisi. Sans cette étape, les trois benchmarks LLM testaient trois fois la
 * même zone de marché (première valeur brute de `products_services`).
 *
 * Trois axes, un par benchmark, 100 % déterministes (0 token LLM) :
 *   1. `covered` — l'intention la plus couverte par le site dans la SERP
 *      (groupe d'intention le plus représenté parmi les requêtes positionnées).
 *   2. `ranked`  — la requête où le site est le mieux classé (corrélation
 *      SEO → GEO : classé 3e sur Google, cité ou non par les IA ?).
 *   3. `demand`  — la requête la plus demandée que le site n'adresse pas
 *      (potentiel laissé aux concurrents ; un score nul est un potentiel).
 *
 * Repli, dans l'ordre : mots-clés restants par volume → carte d'identité.
 *
 * Consommateurs : calculate-llm-visibility (puis llmBenchmarks).
 */

export type TopicAxis = 'covered' | 'ranked' | 'demand' | 'identity';

export interface TopicSelection {
  topic: string;
  axis: TopicAxis;
  volume?: number | null;
  position?: number | null;
  intent?: string | null;
}

export interface QuestionTopicsResult {
  /** Jusqu'à 3 besoins concrets, dans l'ordre des axes. */
  topics: string[];
  /** Même liste, enrichie de l'axe et des preuves chiffrées. */
  selections: TopicSelection[];
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

/**
 * `threshold` : part de mots pleins communs au-delà de laquelle deux besoins sont
 * jugés redondants. La passe stricte (0.6) cherche trois zones réellement
 * distinctes ; la passe de repli (0.9) n'écarte plus que les quasi-doublons, ce
 * qui garantit trois benchmarks même sur un domaine mono-thématique (tous les
 * besoins d'un rénovateur contiennent « rénovation » : à 0.6, un seul survivait
 * et le rapport n'affichait qu'un benchmark au lieu de trois).
 */
function isRedundant(candidate: string, kept: string[], threshold = 0.6): boolean {
  const a = tokensOf(candidate);
  if (a.size === 0) return true;
  for (const k of kept) {
    if (candidate === k) return true;
    const b = tokensOf(k);
    let common = 0;
    for (const w of a) if (b.has(w)) common++;
    const ratio = common / Math.min(a.size, b.size);
    if (ratio >= threshold) return true;
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

interface KwRow {
  keyword: string;
  search_volume: number | null;
  intent: string | null;
  current_position: number | null;
  best_position: number | null;
}

interface Candidate {
  topic: string;
  volume: number;
  position: number | null;
  intent: string | null;
}

function toCandidates(rows: KwRow[], brandTerms: string[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of rows) {
    const topic = normalizeTopic(r.keyword);
    if (!isUsableTopic(topic, brandTerms)) continue;
    if (seen.has(topic)) continue;
    seen.add(topic);
    const pos = r.current_position ?? r.best_position ?? null;
    out.push({
      topic,
      volume: r.search_volume || 0,
      position: pos && pos > 0 && pos <= 100 ? pos : null,
      intent: r.intent,
    });
  }
  return out;
}

/** Axe 1 : intention la plus couverte dans la SERP (par les requêtes positionnées). */
function pickCovered(cands: Candidate[]): Candidate | null {
  const positioned = cands.filter((c) => c.position !== null);
  if (positioned.length === 0) return null;

  const groups = new Map<string, Candidate[]>();
  for (const c of positioned) {
    const key = (c.intent || 'inconnu').toLowerCase();
    const arr = groups.get(key) || [];
    arr.push(c);
    groups.set(key, arr);
  }
  // Groupe le plus représenté ; à égalité, l'intention commerciale gagne.
  const ranked = Array.from(groups.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    const ca = COMMERCIAL_INTENTS.test(a[0]) ? 1 : 0;
    const cb = COMMERCIAL_INTENTS.test(b[0]) ? 1 : 0;
    return cb - ca;
  });
  const group = ranked[0][1];
  return group.slice().sort((a, b) => b.volume - a.volume)[0] || null;
}

/** Axe 2 : requête où le site est le mieux classé (volume en départage). */
function pickRanked(cands: Candidate[], exclude: string[]): Candidate | null {
  const pool = cands
    .filter((c) => c.position !== null && !exclude.includes(c.topic) && !isRedundant(c.topic, exclude))
    .sort((a, b) => (a.position! - b.position!) || (b.volume - a.volume));
  return pool[0] || null;
}

/** Axe 3 : requête la plus demandée que le site n'adresse pas (ou mal). */
function pickDemand(cands: Candidate[], exclude: string[]): Candidate | null {
  const notAddressed = cands.filter((c) => c.position === null || c.position > 30);
  const pool = (notAddressed.length ? notAddressed : cands)
    .filter((c) => !exclude.includes(c.topic) && !isRedundant(c.topic, exclude))
    .sort((a, b) => b.volume - a.volume);
  return pool[0] || null;
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
  const selections: TopicSelection[] = [];
  const kept: string[] = [];

  const push = (c: Candidate | null, axis: TopicAxis) => {
    if (!c || kept.length >= max) return;
    if (kept.includes(c.topic) || isRedundant(c.topic, kept)) return;
    kept.push(c.topic);
    selections.push({
      topic: c.topic,
      axis,
      volume: c.volume || null,
      position: c.position,
      intent: c.intent,
    });
  };

  // ── 1. Univers de mots-clés : trois axes de marché distincts ──
  if (sb && domain) {
    try {
      const bare = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const { data } = await sb
        .from('keyword_universe')
        .select('keyword, search_volume, intent, current_position, best_position')
        .in('domain', [bare, `www.${bare}`])
        .order('search_volume', { ascending: false, nullsFirst: false })
        .limit(200);

      const cands = toCandidates((data || []) as KwRow[], brandTerms);
      if (cands.length > 0) {
        push(pickCovered(cands), 'covered');
        push(pickRanked(cands, kept), 'ranked');
        push(pickDemand(cands, kept), 'demand');

        // Repli interne : compléter avec les meilleurs volumes restants
        if (kept.length < max) {
          const rest = cands.slice().sort((a, b) => b.volume - a.volume);
          for (const c of rest) {
            if (kept.length >= max) break;
            push(c, 'demand');
          }
        }
        if (kept.length > 0) {
          return { topics: [...kept], selections, source: 'keyword_universe' };
        }
      }
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
    push({ topic: p, volume: 0, position: null, intent: null }, 'identity');
  }
  if (kept.length > 0) return { topics: [...kept], selections, source: 'identity' };

  const sector = normalizeTopic(String(identity.market_sector || ''));
  if (sector && isUsableTopic(sector, brandTerms)) {
    return {
      topics: [sector],
      selections: [{ topic: sector, axis: 'identity' }],
      source: 'identity',
    };
  }

  return { topics: [], selections: [], source: 'none' };
}
