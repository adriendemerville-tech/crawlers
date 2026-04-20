/**
 * behavioral-scoring.ts — Sprint B
 *
 * Couche d'analyse comportementale appliquée APRÈS la vérification rDNS+ASN.
 * Permet de :
 *   1. Promouvoir un `unverified` → `stealth` si pattern bot évident.
 *   2. Renforcer la confiance d'un `suspect` qui agit comme un humain.
 *   3. Déclasser un `verified` UA-only (confiance 30) si comportement humain.
 *
 * Signaux analysés (par IP, fenêtre glissante 1h) :
 *   - request_rate_per_min : > 10 req/min ⇒ bot probable
 *   - unique_paths_ratio   : > 0.8 (chaque hit = path différent) ⇒ crawl
 *   - referer_presence_pct : 0% sur > 5 hits ⇒ bot
 *   - js_cookie_presence   : non disponible serveur — laissé hook futur
 *   - status_4xx_ratio     : > 50% sur > 10 hits ⇒ scraper aveugle
 *
 * Note: les seuils sont configurables via env (BEHAVIORAL_*) pour
 * recalibrage post-7j sans redéploiement.
 */
import type { VerificationResult, VerificationStatus } from './bot-verification.ts';

export interface BehaviorContext {
  /** Hits récents (< 1h) de la même IP */
  recent_hits: number;
  /** Nombre de paths uniques visités par cette IP */
  unique_paths: number;
  /** % de hits avec un referer non-null */
  referer_presence_pct: number;
  /** % de hits 4xx/5xx */
  error_ratio_pct: number;
  /** A déclaré un User-Agent ? (false = pas d'UA → très suspect) */
  has_user_agent: boolean;
}

interface BehaviorThresholds {
  /** req/h au-dessus duquel on considère "bot probable" */
  high_rate_per_hour: number;
  /** Ratio paths_uniques / hits au-dessus duquel = crawl */
  high_path_diversity: number;
  /** Min hits pour que les % aient du sens */
  min_sample_size: number;
}

const DEFAULT_THRESHOLDS: BehaviorThresholds = {
  high_rate_per_hour: 60,    // 1 req/min sur 1h = activité programmatique
  high_path_diversity: 0.75, // 75% paths uniques = crawl, pas navigation humaine
  min_sample_size: 5,
};

function loadThresholds(): BehaviorThresholds {
  try {
    return {
      high_rate_per_hour:  Number(Deno.env.get('BEHAVIORAL_HIGH_RATE_PER_HOUR')) || DEFAULT_THRESHOLDS.high_rate_per_hour,
      high_path_diversity: Number(Deno.env.get('BEHAVIORAL_HIGH_PATH_DIVERSITY')) || DEFAULT_THRESHOLDS.high_path_diversity,
      min_sample_size:     Number(Deno.env.get('BEHAVIORAL_MIN_SAMPLE')) || DEFAULT_THRESHOLDS.min_sample_size,
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

/**
 * Applique le scoring comportemental sur un résultat de vérification existant.
 * Retourne un nouveau VerificationResult enrichi (jamais d'effet de bord).
 */
export function applyBehavioralScoring(
  base: VerificationResult,
  ctx: BehaviorContext,
): VerificationResult {
  // Si déjà fortement vérifié (rDNS), on ne touche pas
  if (base.method === 'rdns_match' && base.confidence >= 95) return base;

  const t = loadThresholds();
  const isLargeSample = ctx.recent_hits >= t.min_sample_size;
  if (!isLargeSample) return base;

  const pathDiversity = ctx.unique_paths / ctx.recent_hits;
  const isHighRate = ctx.recent_hits > t.high_rate_per_hour;
  const isHighDiversity = pathDiversity >= t.high_path_diversity;
  const isNoReferer = ctx.referer_presence_pct < 5;
  const isHighErrors = ctx.error_ratio_pct > 50;

  // Score comportemental brut (0-100)
  let behaviorScore = 0;
  if (isHighRate) behaviorScore += 35;
  if (isHighDiversity) behaviorScore += 25;
  if (isNoReferer) behaviorScore += 20;
  if (isHighErrors) behaviorScore += 15;
  if (!ctx.has_user_agent) behaviorScore += 25;

  // ── Cas 1 : unverified + signaux forts ⇒ stealth (bot non déclaré)
  if (base.status === 'unverified' && behaviorScore >= 60) {
    return {
      ...base,
      status: 'stealth' as VerificationStatus,
      method: 'behavioral',
      confidence: Math.min(85, 30 + behaviorScore / 2),
      is_bot: true,
    };
  }

  // ── Cas 2 : suspect (UA-only) renforcé par comportement bot
  if (base.status === 'suspect' && behaviorScore >= 50) {
    return {
      ...base,
      method: 'behavioral',
      confidence: Math.min(80, base.confidence + behaviorScore / 2),
    };
  }

  // ── Cas 3 : suspect + comportement humain (pas de signaux bot)
  // ⇒ on baisse la confiance pour signaler "probablement un humain qui spoofe l'UA"
  if (base.status === 'suspect' && behaviorScore < 20) {
    return {
      ...base,
      confidence: Math.max(10, base.confidence - 15),
    };
  }

  return base;
}

/**
 * Helper : agrège les hits récents d'une IP en BehaviorContext.
 * Appelable depuis backfill ou cron — le caller fait la requête SQL.
 */
export function buildBehaviorContext(
  hits: Array<{
    path: string | null;
    referer: string | null;
    status_code: number | null;
    user_agent: string | null;
  }>,
): BehaviorContext {
  const total = hits.length;
  if (total === 0) {
    return {
      recent_hits: 0,
      unique_paths: 0,
      referer_presence_pct: 0,
      error_ratio_pct: 0,
      has_user_agent: false,
    };
  }
  const uniquePaths = new Set(hits.map(h => h.path || '/')).size;
  const withReferer = hits.filter(h => h.referer && h.referer.length > 0).length;
  const withErrors = hits.filter(h => (h.status_code || 0) >= 400).length;
  const withUa = hits.filter(h => h.user_agent && h.user_agent.length > 0).length;

  return {
    recent_hits: total,
    unique_paths: uniquePaths,
    referer_presence_pct: (withReferer / total) * 100,
    error_ratio_pct: (withErrors / total) * 100,
    has_user_agent: withUa > 0,
  };
}
