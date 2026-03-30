/**
 * gmbPowerScore.ts
 *
 * Calcule un score de puissance GMB dynamique sur 100 à partir de 7 dimensions.
 * Chaque dimension est scorée 0-100 puis pondérée.
 *
 * Dimensions & poids :
 *   1. Complétude      (20%) — champs remplis
 *   2. Réputation       (25%) — note × volume avis
 *   3. Activité         (15%) — posts récents, réponses avis
 *   4. Visibilité SERP  (15%) — présence local pack
 *   5. Cohérence NAP    (10%) — nom/adresse/tel vs site
 *   6. Médias           (10%) — photos, vidéos
 *   7. Confiance        (5%)  — ancienneté, vérifié
 */

export interface GmbPowerDimensions {
  completeness_score: number;
  reputation_score: number;
  activity_score: number;
  local_serp_score: number;
  nap_consistency_score: number;
  media_score: number;
  trust_score: number;
}

export interface GmbPowerResult {
  total_score: number;
  grade: string;
  dimensions: GmbPowerDimensions;
  raw_data: Record<string, any>;
}

const WEIGHTS = {
  completeness: 0.20,
  reputation: 0.25,
  activity: 0.15,
  local_serp: 0.15,
  nap_consistency: 0.10,
  media: 0.10,
  trust: 0.05,
} as const;

// ── 1. Complétude (20%) ─────────────────────────────────────────

interface CompletenessInput {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  category?: string;
  hours?: Record<string, any>;
  description?: string;
  attributes_count?: number;
  services_count?: number;
}

function scoreCompleteness(d: CompletenessInput): number {
  const fields = [
    { present: !!d.name, weight: 15 },
    { present: !!d.address, weight: 15 },
    { present: !!d.phone, weight: 10 },
    { present: !!d.website, weight: 10 },
    { present: !!d.category, weight: 15 },
    { present: !!(d.hours && Object.values(d.hours).some(h => h !== null)), weight: 10 },
    { present: !!d.description, weight: 10 },
    { present: (d.attributes_count ?? 0) > 0, weight: 8 },
    { present: (d.services_count ?? 0) > 0, weight: 7 },
  ];
  const max = fields.reduce((s, f) => s + f.weight, 0);
  const got = fields.filter(f => f.present).reduce((s, f) => s + f.weight, 0);
  return Math.round((got / max) * 100);
}

// ── 2. Réputation (25%) ─────────────────────────────────────────

interface ReputationInput {
  rating?: number;
  total_reviews?: number;
  review_reply_rate?: number;
}

function scoreReputation(d: ReputationInput): number {
  const rating = d.rating ?? 0;
  const reviews = d.total_reviews ?? 0;
  const replyRate = d.review_reply_rate ?? 0;

  if (reviews === 0) return 5;

  let score = 0;

  // Note (0-5 → 0-40 pts) — exponentiel au-dessus de 4.0
  if (rating >= 4.5) score += 40;
  else if (rating >= 4.0) score += 30;
  else if (rating >= 3.5) score += 20;
  else if (rating >= 3.0) score += 12;
  else score += 5;

  // Volume avis (log scale, cap à 35 pts)
  score += Math.min(35, Math.round(Math.log10(Math.max(1, reviews)) * 15));

  // Taux de réponse aux avis (0-25 pts)
  score += Math.round(replyRate * 25);

  return Math.min(100, score);
}

// ── 3. Activité (15%) ───────────────────────────────────────────

interface ActivityInput {
  has_recent_posts?: boolean;
  posts_last_30_days?: number;
  last_post_days_ago?: number;
  last_review_reply_days_ago?: number;
}

function scoreActivity(d: ActivityInput): number {
  let score = 0;

  // Posts récents
  const posts = d.posts_last_30_days ?? (d.has_recent_posts ? 2 : 0);
  if (posts >= 4) score += 50;
  else if (posts >= 2) score += 35;
  else if (posts >= 1) score += 20;
  else score += 0;

  // Fraîcheur du dernier post
  const lastPostAge = d.last_post_days_ago ?? (d.has_recent_posts ? 7 : 90);
  if (lastPostAge <= 7) score += 30;
  else if (lastPostAge <= 14) score += 20;
  else if (lastPostAge <= 30) score += 10;

  // Réactivité aux avis
  const replyAge = d.last_review_reply_days_ago;
  if (replyAge != null) {
    if (replyAge <= 2) score += 20;
    else if (replyAge <= 7) score += 12;
    else if (replyAge <= 14) score += 5;
  }

  return Math.min(100, score);
}

// ── 4. Visibilité SERP locale (15%) ─────────────────────────────

interface LocalSerpInput {
  local_pack_appearances?: number;
  local_pack_avg_position?: number;
  total_local_keywords?: number;
}

function scoreLocalSerp(d: LocalSerpInput): number {
  if (!d.local_pack_appearances && !d.total_local_keywords) return 0; // pas de données

  let score = 0;
  const appearances = d.local_pack_appearances ?? 0;
  const avgPos = d.local_pack_avg_position ?? 10;
  const totalKw = d.total_local_keywords ?? 0;

  // Apparitions local pack (0-50 pts)
  score += Math.min(50, appearances * 10);

  // Position moyenne (1=meilleur, 0-30 pts)
  if (avgPos <= 1) score += 30;
  else if (avgPos <= 2) score += 22;
  else if (avgPos <= 3) score += 15;
  else if (avgPos <= 5) score += 8;

  // Couverture mots-clés locaux (0-20 pts)
  score += Math.min(20, Math.round(Math.sqrt(totalKw) * 5));

  return Math.min(100, score);
}

// ── 5. Cohérence NAP (10%) ──────────────────────────────────────

interface NapInput {
  name_matches_site?: boolean;
  address_matches_site?: boolean;
  phone_matches_site?: boolean;
  nap_score?: number; // pré-calculé par le crawl
}

function scoreNapConsistency(d: NapInput): number {
  // Si score pré-calculé disponible
  if (d.nap_score != null) return Math.min(100, Math.round(d.nap_score));

  let score = 0;
  if (d.name_matches_site) score += 35;
  if (d.address_matches_site) score += 35;
  if (d.phone_matches_site) score += 30;

  return score;
}

// ── 6. Médias (10%) ─────────────────────────────────────────────

interface MediaInput {
  photo_count?: number;
  has_logo?: boolean;
  has_cover?: boolean;
  has_video?: boolean;
  owner_photos?: number;
}

function scoreMedia(d: MediaInput): number {
  let score = 0;

  const photos = d.photo_count ?? 0;
  if (photos >= 20) score += 40;
  else if (photos >= 10) score += 30;
  else if (photos >= 5) score += 20;
  else if (photos > 0) score += 10;

  if (d.has_logo) score += 15;
  if (d.has_cover) score += 15;
  if (d.has_video) score += 15;

  // Photos du propriétaire (pas juste des clients)
  const ownerPhotos = d.owner_photos ?? 0;
  if (ownerPhotos >= 10) score += 15;
  else if (ownerPhotos >= 5) score += 10;
  else if (ownerPhotos > 0) score += 5;

  return Math.min(100, score);
}

// ── 7. Confiance (5%) ───────────────────────────────────────────

interface TrustInput {
  is_verified?: boolean;
  is_claimed?: boolean;
  years_active?: number;
  has_website_link?: boolean;
}

function scoreTrust(d: TrustInput): number {
  let score = 0;

  if (d.is_verified) score += 35;
  if (d.is_claimed) score += 25;

  const years = d.years_active ?? 0;
  if (years >= 5) score += 25;
  else if (years >= 3) score += 18;
  else if (years >= 1) score += 10;
  else score += 3;

  if (d.has_website_link) score += 15;

  return Math.min(100, score);
}

// ── Grade ───────────────────────────────────────────────────────

function toGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

// ── Main entry ──────────────────────────────────────────────────

export interface GmbPowerInput {
  completeness?: CompletenessInput;
  reputation?: ReputationInput;
  activity?: ActivityInput;
  local_serp?: LocalSerpInput;
  nap?: NapInput;
  media?: MediaInput;
  trust?: TrustInput;
}

export function computeGmbPowerScore(input: GmbPowerInput): GmbPowerResult {
  const dims: GmbPowerDimensions = {
    completeness_score: scoreCompleteness(input.completeness ?? {}),
    reputation_score: scoreReputation(input.reputation ?? {}),
    activity_score: scoreActivity(input.activity ?? {}),
    local_serp_score: scoreLocalSerp(input.local_serp ?? {}),
    nap_consistency_score: scoreNapConsistency(input.nap ?? {}),
    media_score: scoreMedia(input.media ?? {}),
    trust_score: scoreTrust(input.trust ?? {}),
  };

  const total = Math.round(
    dims.completeness_score * WEIGHTS.completeness +
    dims.reputation_score * WEIGHTS.reputation +
    dims.activity_score * WEIGHTS.activity +
    dims.local_serp_score * WEIGHTS.local_serp +
    dims.nap_consistency_score * WEIGHTS.nap_consistency +
    dims.media_score * WEIGHTS.media +
    dims.trust_score * WEIGHTS.trust
  );

  return {
    total_score: Math.min(100, total),
    grade: toGrade(total),
    dimensions: dims,
    raw_data: input as Record<string, any>,
  };
}

/**
 * Returns the ISO week start date for a given Date (Monday).
 */
export function getWeekStart(d: Date = new Date()): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}
