/**
 * Preuve sociale déterministe (Lot 1 du plan de correctifs Marina).
 *
 * Trois couches, avec une règle dure : **une couche supérieure ne peut jamais
 * infirmer une couche inférieure**. Concrètement, si le HTML ou une API expose
 * des avis, aucun LLM ne peut écrire « aucune preuve sociale ».
 *
 *  Couche 1 (0 token)  : JSON-LD AggregateRating/Review/Organization, compteurs
 *                        d'avis dans le DOM, widgets d'avis identifiables.
 *  Couche 2 (cache 24h): Google Places (note + volume d'avis), plateformes
 *                        d'avis détectées via les liens sortants.
 *  Couche 3 (LLM)      : qualification seulement (ton, fraîcheur, cohérence).
 *                        Interdiction d'émettre has_reviews=false.
 *
 * Consommé par : audit-strategique-ia, audit-expert-seo, marina, check-eeat.
 */

import { getCached, setCache, cacheKey } from './auditCache.ts';

export type SocialProofStatus = 'confirmed' | 'inconclusive' | 'absent_probable';

export interface SocialProofSignal {
  layer: 1 | 2;
  source: string;
  kind: 'aggregate_rating' | 'review_count' | 'widget' | 'testimonial' | 'platform_link' | 'places';
  rating?: number;
  reviewCount?: number;
  detail?: string;
}

export interface SocialProofResult {
  status: SocialProofStatus;
  /** Volume d'avis le plus élevé constaté par une couche déterministe. */
  reviewCount: number | null;
  /** Note moyenne sur 5 si disponible. */
  rating: number | null;
  hasAggregateRating: boolean;
  hasTestimonials: boolean;
  /** Plateformes d'avis identifiées (google, trustpilot, eldo, pagesjaunes…). */
  platforms: string[];
  signals: SocialProofSignal[];
  /** Le contexte analysé était vide / non rendu : aucune conclusion possible. */
  contextInsufficient: boolean;
  /** Phrase factuelle réutilisable dans un rapport. */
  summary: string;
}

const REVIEW_PLATFORMS: Array<{ id: string; re: RegExp }> = [
  { id: 'google', re: /(?:google\.[a-z.]+\/maps|g\.page|goo\.gl\/maps|maps\.app\.goo\.gl|reviews?_widget|trustindex|elfsight[^"']*google)/i },
  { id: 'trustpilot', re: /trustpilot\.(?:com|fr)/i },
  { id: 'avis-verifies', re: /avis-verifies|netreviews|guaranteed-reviews/i },
  { id: 'eldo', re: /eldo\.(?:fr|pro)/i },
  { id: 'pagesjaunes', re: /pagesjaunes\.fr/i },
  { id: 'custplace', re: /custplace\.com/i },
  { id: 'opinion-system', re: /opinion-system\.fr/i },
  { id: 'tripadvisor', re: /tripadvisor\.[a-z.]+/i },
  { id: 'houzz', re: /houzz\.(?:fr|com)/i },
  { id: 'travaux', re: /travaux\.com|hellocasa|quotatis/i },
  { id: 'facebook-reviews', re: /facebook\.com\/[^"'\s]+\/reviews/i },
  { id: 'societe-des-avis', re: /societe-des-avis-garantis/i },
];

const TESTIMONIAL_RE = /(t[ée]moignage|testimonial|avis\s+(?:de\s+nos\s+)?clients?|ils\s+nous\s+font\s+confiance|nos\s+clients?\s+(?:parlent|t[ée]moignent)|customer\s+stor|verbatim)/i;

/** Compteurs textuels : « 1 979 avis », « 245 reviews », « 32 témoignages ». */
const COUNTER_RE = /(\d[\d\u00a0\u202f\s.,]{0,8}\d|\d)\s*(?:avis|reviews?|t[ée]moignages?|notes?\s+clients?)\b/gi;
const RATING_RE = /\b([1-5](?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|étoiles?|stars?)\b/i;

function parseCount(raw: string): number | null {
  const n = Number(raw.replace(/[\u00a0\u202f\s.,]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) return null;
  return n;
}

function walkJsonLd(node: unknown, out: SocialProofSignal[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 6) return;
  if (Array.isArray(node)) { node.forEach((n) => walkJsonLd(n, out, depth + 1)); return; }
  const obj = node as Record<string, any>;
  const type = String(obj['@type'] || '').toLowerCase();

  if (type.includes('aggregaterating') || obj.ratingValue !== undefined) {
    const rating = Number(String(obj.ratingValue ?? '').replace(',', '.'));
    const count = Number(obj.reviewCount ?? obj.ratingCount ?? NaN);
    if (Number.isFinite(rating) || Number.isFinite(count)) {
      out.push({
        layer: 1, source: 'json-ld AggregateRating', kind: 'aggregate_rating',
        ...(Number.isFinite(rating) ? { rating } : {}),
        ...(Number.isFinite(count) && count > 0 ? { reviewCount: count } : {}),
        detail: 'Balisage structuré présent sur la page',
      });
    }
  }
  if (obj.aggregateRating) walkJsonLd(obj.aggregateRating, out, depth + 1);
  if (type === 'review' || type.includes('review') && !type.includes('aggregate')) {
    out.push({ layer: 1, source: 'json-ld Review', kind: 'review_count', reviewCount: 1, detail: 'Avis balisé individuellement' });
  }
  for (const key of Object.keys(obj)) {
    if (obj[key] && typeof obj[key] === 'object') walkJsonLd(obj[key], out, depth + 1);
  }
}

/** Couche 1 — lecture déterministe du HTML (aucun token consommé). */
export function extractOnSiteSocialProof(html: string): SocialProofSignal[] {
  const signals: SocialProofSignal[] = [];
  if (!html) return signals;

  // 1a. JSON-LD
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    try {
      walkJsonLd(JSON.parse(block.replace(/<\/?script[^>]*>/gi, '')), signals);
    } catch { /* JSON-LD invalide : ignoré */ }
  }

  // 1b. Widgets et liens de plateformes d'avis
  for (const { id, re } of REVIEW_PLATFORMS) {
    if (re.test(html)) {
      signals.push({ layer: 1, source: id, kind: id === 'google' ? 'widget' : 'platform_link', detail: `Plateforme d'avis référencée dans le HTML (${id})` });
    }
  }

  // 1c. Compteurs d'avis visibles dans le texte
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  let m: RegExpExecArray | null;
  let bestCount: number | null = null;
  COUNTER_RE.lastIndex = 0;
  while ((m = COUNTER_RE.exec(text)) !== null) {
    const c = parseCount(m[1]);
    if (c && (bestCount === null || c > bestCount)) bestCount = c;
  }
  if (bestCount !== null) {
    signals.push({ layer: 1, source: 'compteur DOM', kind: 'review_count', reviewCount: bestCount, detail: `Compteur d'avis visible : ${bestCount}` });
  }
  const ratingMatch = text.match(RATING_RE);
  if (ratingMatch) {
    const r = Number(ratingMatch[1].replace(',', '.'));
    if (Number.isFinite(r)) signals.push({ layer: 1, source: 'note DOM', kind: 'aggregate_rating', rating: r, detail: `Note affichée : ${r}/5` });
  }

  // 1d. Témoignages
  if (TESTIMONIAL_RE.test(text)) {
    signals.push({ layer: 1, source: 'témoignages', kind: 'testimonial', detail: 'Section de témoignages / avis clients détectée' });
  }

  return signals;
}

/**
 * Couche 2 — Google Places (note + volume d'avis vérifiés), cache 24 h.
 * Silencieuse si la clé n'est pas configurée.
 */
export async function fetchPlacesSocialProof(brandName: string, domain: string): Promise<SocialProofSignal[]> {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!key || !brandName) return [];

  const ck = cacheKey('social_proof_places', { brandName, domain });
  const cached = await getCached(ck);
  if (cached) return cached as SocialProofSignal[];

  const signals: SocialProofSignal[] = [];
  try {
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(brandName)}&inputtype=textquery&fields=place_id,rating,user_ratings_total,name&key=${key}`;
    const resp = await fetch(findUrl, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const data = await resp.json();
      const cand = data?.candidates?.[0];
      if (cand && (cand.rating || cand.user_ratings_total)) {
        signals.push({
          layer: 2, source: 'Google Places', kind: 'places',
          ...(typeof cand.rating === 'number' ? { rating: cand.rating } : {}),
          ...(typeof cand.user_ratings_total === 'number' ? { reviewCount: cand.user_ratings_total } : {}),
          detail: `Fiche Google « ${cand.name || brandName} » : ${cand.rating ?? '?'} / 5 sur ${cand.user_ratings_total ?? '?'} avis`,
        });
      }
    } else {
      await resp.text().catch(() => '');
    }
  } catch (e) {
    console.warn('[socialProof] Places indisponible:', e instanceof Error ? e.message : e);
  }

  await setCache(ck, 'social_proof_places', signals, 24 * 60);
  return signals;
}

/** Couche 2 bis — réutilise une fiche GMB déjà résolue en amont (0 appel réseau). */
export function gmbToSocialProofSignals(gmb: { title?: string; rating?: number; reviews_count?: number } | null | undefined): SocialProofSignal[] {
  if (!gmb) return [];
  if (typeof gmb.rating !== 'number' && typeof gmb.reviews_count !== 'number') return [];
  return [{
    layer: 2, source: 'Google Business Profile', kind: 'places',
    ...(typeof gmb.rating === 'number' ? { rating: gmb.rating } : {}),
    ...(typeof gmb.reviews_count === 'number' ? { reviewCount: gmb.reviews_count } : {}),
    detail: `Fiche Google « ${gmb.title || 'établissement'} » : ${gmb.rating ?? '?'} / 5 sur ${gmb.reviews_count ?? '?'} avis`,
  }];
}

export interface ResolveSocialProofInput {
  html?: string;
  /** Texte utile déjà extrait (contexte de page) si le HTML n'est pas disponible. */
  pageContext?: string;
  extraSignals?: SocialProofSignal[];
}

/** Fusionne les couches et produit un verdict déterministe. */
export function resolveSocialProof(input: ResolveSocialProofInput): SocialProofResult {
  const html = input.html || '';
  const signals = [
    ...extractOnSiteSocialProof(html || input.pageContext || ''),
    ...(input.extraSignals || []),
  ];

  const usefulChars = (html || input.pageContext || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
  const contextInsufficient = usefulChars < 300 && !signals.some((s) => s.layer === 2);

  const counts = signals.map((s) => s.reviewCount).filter((n): n is number => typeof n === 'number');
  const ratings = signals.map((s) => s.rating).filter((n): n is number => typeof n === 'number');
  const reviewCount = counts.length ? Math.max(...counts) : null;
  const rating = ratings.length ? Math.max(...ratings) : null;
  const platforms = [...new Set(signals.filter((s) => s.kind === 'platform_link' || s.kind === 'widget' || s.kind === 'places').map((s) => s.source))];
  const hasAggregateRating = signals.some((s) => s.kind === 'aggregate_rating');
  const hasTestimonials = signals.some((s) => s.kind === 'testimonial');

  let status: SocialProofStatus;
  if ((reviewCount && reviewCount > 0) || rating !== null || platforms.length > 0) status = 'confirmed';
  else if (contextInsufficient) status = 'inconclusive';
  else if (hasTestimonials) status = 'confirmed';
  else status = 'absent_probable';

  let summary: string;
  if (status === 'confirmed') {
    const parts: string[] = [];
    if (reviewCount) parts.push(`${reviewCount} avis constatés`);
    if (rating !== null) parts.push(`note ${rating}/5`);
    if (platforms.length) parts.push(`plateformes : ${platforms.join(', ')}`);
    if (hasAggregateRating) parts.push('balisage AggregateRating présent');
    else if (reviewCount || rating !== null) parts.push('avis non balisés en AggregateRating');
    if (hasTestimonials && !reviewCount) parts.push('témoignages clients présents');
    summary = `Preuve sociale vérifiée (${parts.join(' ; ')}).`;
  } else if (status === 'inconclusive') {
    summary = 'Preuve sociale non concluante : le contenu analysé était vide ou non rendu, aucune conclusion ne peut être tirée.';
  } else {
    summary = "Aucun signal de preuve sociale détecté sur le contenu analysé (ni avis, ni note, ni témoignage, ni plateforme d'avis).";
  }

  return { status, reviewCount, rating, hasAggregateRating, hasTestimonials, platforms, signals, contextInsufficient, summary };
}

/** Bloc factuel injecté dans les prompts : le LLM qualifie, il ne décide plus. */
export function formatSocialProofForPrompt(r: SocialProofResult): string {
  const lines = [`⭐ PREUVE SOCIALE (mesure déterministe, source de vérité — NE PAS CONTREDIRE) : statut=${r.status}`];
  if (r.reviewCount !== null) lines.push(`Volume d'avis constaté : ${r.reviewCount}`);
  if (r.rating !== null) lines.push(`Note constatée : ${r.rating}/5`);
  lines.push(`Balisage AggregateRating : ${r.hasAggregateRating ? 'OUI' : 'NON'}`);
  lines.push(`Témoignages : ${r.hasTestimonials ? 'OUI' : 'NON'}`);
  if (r.platforms.length) lines.push(`Plateformes d'avis : ${r.platforms.join(', ')}`);
  if (r.signals.length) lines.push(`Détails : ${r.signals.map((s) => s.detail).filter(Boolean).slice(0, 6).join(' | ')}`);
  if (r.status === 'confirmed') {
    lines.push("INTERDIT : écrire qu'il n'y a aucun avis, aucune preuve sociale ou zéro témoignage. Si le balisage AggregateRating est absent alors que les avis existent, la recommandation correcte est de baliser les avis existants, pas d'en collecter.");
  } else if (r.status === 'inconclusive') {
    lines.push("Statut non concluant : n'affirme NI la présence NI l'absence de preuve sociale. Indique que la mesure n'a pas pu être établie.");
  }
  return lines.join('\n');
}

/**
 * Applique la règle dure sur une sortie LLM : la couche 3 ne peut pas infirmer
 * les couches 1 et 2. Mutation en place d'un objet `social_proof`.
 */
export function enforceSocialProofOnLlm(node: any, r: SocialProofResult): any {
  if (!node || typeof node !== 'object') return node;
  const sp = node.social_proof;
  if (!sp || typeof sp !== 'object') {
    if (r.status === 'confirmed') {
      node.social_proof = {
        has_reviews: true, has_testimonials: r.hasTestimonials, has_portfolio_links: false,
        details: r.summary, source: 'deterministic',
      };
    }
    return node;
  }

  if (r.status === 'confirmed') {
    if (r.reviewCount || r.rating !== null || r.platforms.length) sp.has_reviews = true;
    if (r.hasTestimonials) sp.has_testimonials = true;
    if (typeof r.reviewCount === 'number') sp.review_count = r.reviewCount;
    if (typeof r.rating === 'number') sp.rating = r.rating;
    const negation = /aucun|aucune|zéro|pas d[e']|absence|no\s+review/i;
    if (typeof sp.details === 'string' && negation.test(sp.details)) {
      sp.details = r.summary;
      sp.corrected_by = 'deterministic_social_proof';
    }
    sp.source = 'deterministic';
  } else if (r.status === 'inconclusive') {
    sp.has_reviews = null;
    sp.details = r.summary;
    sp.source = 'inconclusive';
  }
  return node;
}
