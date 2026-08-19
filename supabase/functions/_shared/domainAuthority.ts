/**
 * Bloc autorité / backlinks (DataForSEO) — partagé par l'audit stratégique,
 * Marina, Parménion et Stratège Cocoon.
 *
 * Deux appels DataForSEO maximum par domaine, mis en cache 24 h (les backlinks
 * bougent lentement) pour ne pas multiplier les appels payants.
 *
 * Recalibrage 2026-08-08 (confrontation Semrush) :
 * - l'échelle rank backlinks DataForSEO est 0–1000 et logarithmique : une
 *   division par 10 saturait à 100/100 des domaines réellement à ~38/100 ;
 * - un profil gonflé par des annuaires/MFA ne vaut pas une autorité forte :
 *   la toxicité du profil pénalise désormais le score ;
 * - tout score est accompagné d'un niveau de confiance explicite.
 */
import { trackPaidApiCall } from './tokenTracker.ts';
import { cacheKey, getCached, setCache } from './auditCache.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

/** Version de calibrage : invalide les entrées de cache produites avant le recalibrage. */
export const AUTHORITY_CALIBRATION_VERSION = 4;

/** Taille de l'échantillon de domaines référents analysé (affichage limité au top 10). */
export const REFERRING_DOMAINS_SAMPLE_LIMIT = 200;
/** Nombre d'ancres demandées à `backlinks/anchors/live`. */
export const ANCHORS_SAMPLE_LIMIT = 100;
/** Nombre de pages cibles demandées à `backlinks/domain_pages/live`. */
export const LINKED_PAGES_SAMPLE_LIMIT = 50;

export interface BacklinkToxicity {
  /** 0-100 : plus le score est haut, plus le profil est artificiel */
  toxicity_score: number;
  verdict: 'sain' | 'a_surveiller' | 'pollue';
  /** Part de l'ancre la plus répétée dans l'échantillon d'ancres */
  dominant_anchor_ratio: number;
  dominant_anchor: string | null;
  /** Part d'ancres non naturelles (URL nue, mot générique, emoji) */
  unnatural_anchor_ratio: number;
  /** Rank moyen (0-100) des principaux domaines référents */
  avg_referrer_rank: number;
  /** backlinks / domaines référents — un ratio élevé signe une empreinte d'annuaire */
  links_per_domain: number;
  broken_ratio: number;
  signals: string[];
  recommendation: string;
}

export interface OrganicVisibility {
  estimated_traffic: number | null;
  ranked_keywords: number | null;
  average_position: number | null;
  top3: number | null;
  top10: number | null;
  source: 'dataforseo_labs' | 'unavailable';
}

/** Une part de distribution mesurée (TLD, pays, type de plateforme). */
export interface DistributionBucket {
  key: string;
  count: number;
  /** Part 0-1 du total de l'échantillon */
  share: number;
}

/** Page du domaine audité recevant des liens externes. */
export interface LinkedPage {
  url: string;
  referring_domains: number;
  backlinks: number;
}

/** Lecture déterministe de la répartition du profil de liens (lot 2). */
export interface BacklinkDistribution {
  tld: DistributionBucket[];
  countries: DistributionBucket[];
  platform_types: DistributionBucket[];
  /** Part du TLD dominant (0-1) */
  dominant_tld_share: number;
  /** Part du pays dominant (0-1) */
  dominant_country_share: number;
  /** Part des domaines référents pointant la page la plus liée (0-1) */
  top_page_share: number;
  /** Nombre de pages du domaine recevant au moins un lien externe (échantillon) */
  linked_pages_sampled: number;
  signals: string[];
  recommendation: string;
  source: 'dataforseo' | 'partial' | 'unavailable';
}


export interface AuthorityData {
  domain: string;
  /** Authority Score maison sur 100 (rank normalisé + diversité, pénalisé par la toxicité) */
  authority_score: number;
  /** domain_rank normalisé sur 0-100 (échelle source DataForSEO : 0-1000) */
  domain_rank: number;
  /** rank brut renvoyé par DataForSEO, conservé pour audit du calcul */
  domain_rank_raw: number;
  referring_domains: number;
  referring_main_domains: number;
  backlinks_total: number;
  dofollow_ratio: number;
  broken_backlinks: number;
  first_seen: string | null;
  top_referring_domains: { domain: string; rank: number; backlinks: number }[];
  top_anchors: string[];
  top_anchors_detail: { anchor: string; count: number }[];
  toxicity: BacklinkToxicity | null;
  /** Répartition mesurée du profil de liens + pages cibles (lot 2) */
  distribution: BacklinkDistribution | null;
  /** Pages du domaine les plus liées (top 10 de l'échantillon) */
  top_linked_pages: LinkedPage[];
  organic_visibility?: OrganicVisibility | null;
  /** Nombre de domaines référents réellement analysés (échantillon, ≠ total) */
  referring_domains_sampled: number;
  /** Nombre d'ancres réellement analysées */
  anchors_sampled: number;
  /** Provenance de l'échantillon d'ancres */
  anchors_source: 'anchors_endpoint' | 'summary_sample' | 'unavailable';
  /** Fiabilité de la mesure selon la complétude de la réponse DataForSEO */
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  calibration_version: number;
  data_source: 'dataforseo' | 'unavailable';
  unavailable_reason?: string;
  fetched_at: string;
}

export function hasAuthorityCredentials(): boolean {
  return !!(DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD);
}

/**
 * Normalise le rank DataForSEO vers une échelle 0-100.
 *
 * L'échelle backlinks DataForSEO est 0–1000 et logarithmique : une division
 * linéaire par 10 attribuait 100/100 à tout domaine à rank 1000, y compris des
 * sites réellement à ~38/100 chez les autres fournisseurs. On applique donc une
 * courbe puissance calibrée (1000 → 95, 600 → 38, 300 → 11, 100 → 1,5).
 */
export function normalizeDomainRank(rawRank: number, scale: 1000 | 100 = 1000): number {
  const r = Math.max(0, rawRank || 0);
  if (scale === 100 || (r > 0 && r <= 100 && scale !== 1000)) return Math.round(Math.min(100, r));
  const ratio = Math.min(1, r / 1000);
  return Math.round(95 * Math.pow(ratio, 1.8) * 10) / 10;
}

/**
 * Score d'autorité déterministe et borné à 92 (aucune mesure propriétaire ne
 * justifie un 100/100) :
 *   60 % rank normalisé + 40 % diversité des domaines référents pondérée par la
 *   qualité moyenne des référents, puis pénalité de toxicité (max −45 %).
 */
export function computeAuthorityScore(
  domainRank: number,
  referringDomains: number,
  opts?: { toxicityScore?: number; avgReferrerRank?: number },
): number {
  const rankPart = Math.min(60, Math.max(0, Math.min(100, domainRank)) * 0.6);
  const rawDiversity = referringDomains > 0
    ? Math.min(40, Math.log10(referringDomains) * 11)
    : 0;
  // Un référent moyen à rank 5/100 ne vaut pas un référent moyen à rank 50/100.
  const quality = typeof opts?.avgReferrerRank === 'number'
    ? Math.max(0.4, Math.min(1, 0.4 + (opts.avgReferrerRank / 100) * 1.2))
    : 1;
  const diversityPart = rawDiversity * quality;
  const penalty = Math.min(0.45, Math.max(0, (opts?.toxicityScore ?? 0) / 100) * 0.5);
  const score = (rankPart + diversityPart) * (1 - penalty);
  return Math.max(0, Math.min(92, Math.round(score)));
}

const GENERIC_ANCHORS = [
  'site web', 'site internet', 'cliquez ici', 'ici', 'lien', 'voir', 'en savoir plus',
  'click here', 'read more', 'website', 'home', 'accueil', 'www', 'visiter', 'plus',
];
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

function isUnnaturalAnchor(anchor: string): boolean {
  const a = (anchor || '').trim().toLowerCase();
  if (!a) return true;
  if (EMOJI_RE.test(anchor)) return true;
  if (/^(https?:\/\/|www\.)/.test(a) || /\.(fr|com|net|org|io)(\/|$)/.test(a)) return true;
  return GENERIC_ANCHORS.includes(a);
}

/**
 * Domaines référents dont la thématique est manifestement incompatible avec un
 * lien éditorial légitime (paris, casino, adulte, fermes de fonds d'écran,
 * miroirs et sites de téléchargement). Un seul de ces domaines interdit le
 * verdict « profil sain » : c'est exactement ce qu'un consultant vérifie à la
 * main avant de conclure.
 */
const SPAM_DOMAIN_PATTERNS: RegExp[] = [
  /\b(bet|betting|bookmaker|casino|slot|poker|bahis|kumar)\w*/i,
  /\b(mirror|mirrors)\b|mirror\.(com|net|org|info)/i,
  /\b(porn|sex|escort|xxx|hentai)\w*/i,
  /\b(wallpapers?|screensavers?|ringtones?)\b/i,
  /\b(crack|keygen|torrent|warez|apk|hack)\w*/i,
  /\b(pharma|viagra|cialis|casinos)\b/i,
  /\b(loan|payday|crypto ?pump|forex ?signals)\b/i,
];

export function detectSuspiciousReferringDomains(
  domains: { domain: string }[],
): string[] {
  const flagged: string[] = [];
  for (const d of domains || []) {
    const host = String(d?.domain || '').toLowerCase();
    if (!host) continue;
    if (SPAM_DOMAIN_PATTERNS.some((re) => re.test(host))) flagged.push(host);
  }
  return Array.from(new Set(flagged));
}

/**
 * Toxicité du profil de liens — 100 % déterministe.
 *
 * `topReferringDomains` sert à l'affichage ; `sampleReferringDomains`, quand il
 * est fourni, porte l'échantillon complet (jusqu'à 200 domaines) sur lequel sont
 * calculés le rank moyen des référents et la détection de domaines hors-sujet.
 * Sans lui, on retombe sur le top 10 (comportement historique).
 */
export function computeBacklinkToxicity(input: {
  anchors: { anchor: string; count: number }[];
  topReferringDomains: { domain: string; rank: number; backlinks: number }[];
  sampleReferringDomains?: { domain: string; rank: number; backlinks: number }[];
  backlinksTotal: number;
  referringDomains: number;
  brokenBacklinks: number;
  dofollowRatio: number;
}): BacklinkToxicity {
  const totalAnchorCount = input.anchors.reduce((s, a) => s + (a.count || 0), 0);
  const sorted = [...input.anchors].sort((a, b) => (b.count || 0) - (a.count || 0));
  const dominant = sorted[0] || null;
  const dominantRatio = totalAnchorCount > 0 && dominant
    ? Math.round((dominant.count / totalAnchorCount) * 100) / 100
    : 0;
  const unnaturalCount = input.anchors
    .filter((a) => isUnnaturalAnchor(a.anchor))
    .reduce((s, a) => s + (a.count || 0), 0);
  const unnaturalRatio = totalAnchorCount > 0
    ? Math.round((unnaturalCount / totalAnchorCount) * 100) / 100
    : 0;
  const refSample = (input.sampleReferringDomains?.length ? input.sampleReferringDomains : input.topReferringDomains) || [];
  const ranks = refSample.map((d) => normalizeDomainRank(d.rank));
  const avgReferrerRank = ranks.length
    ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10
    : 0;
  const linksPerDomain = input.referringDomains > 0
    ? Math.round((input.backlinksTotal / input.referringDomains) * 10) / 10
    : 0;
  const brokenRatio = input.backlinksTotal > 0
    ? Math.round((input.brokenBacklinks / input.backlinksTotal) * 100) / 100
    : 0;

  const signals: string[] = [];
  let score = 0;

  if (dominantRatio >= 0.3) {
    score += Math.min(35, Math.round((dominantRatio - 0.3) * 100) + 15);
    signals.push(`ancre « ${dominant?.anchor} » répétée sur ${Math.round(dominantRatio * 100)} % de l'échantillon`);
  }
  if (unnaturalRatio >= 0.25) {
    score += Math.min(25, Math.round((unnaturalRatio - 0.25) * 60) + 10);
    signals.push(`${Math.round(unnaturalRatio * 100)} % d'ancres non naturelles (URL nue, mot générique, emoji)`);
  }
  if (ranks.length >= 3 && avgReferrerRank < 15) {
    score += 20;
    signals.push(`principaux référents à faible autorité (rank moyen ${avgReferrerRank}/100)`);
  }
  if (linksPerDomain >= 25) {
    score += Math.min(20, Math.round(linksPerDomain / 5));
    signals.push(`${linksPerDomain} liens par domaine référent en moyenne — empreinte de type annuaire`);
  }
  if (brokenRatio >= 0.1) {
    score += 10;
    signals.push(`${Math.round(brokenRatio * 100)} % de liens entrants cassés`);
  }
  if (input.dofollowRatio >= 98 && input.referringDomains > 50) {
    score += 5;
    signals.push('quasi 100 % de liens dofollow — profil peu naturel');
  }

  // Référents hors-sujet (paris, adulte, miroirs, fermes de contenu) : un seul
  // suffit à interdire le verdict « sain ».
  const suspicious = detectSuspiciousReferringDomains(refSample);
  if (suspicious.length > 0) {
    score += Math.min(30, 12 + suspicious.length * 6);
    signals.push(
      `${suspicious.length} domaine${suspicious.length > 1 ? 's' : ''} référent${suspicious.length > 1 ? 's' : ''} hors-sujet dans l'échantillon (${suspicious.slice(0, 4).join(', ')})`,
    );
  }

  const toxicity = Math.max(0, Math.min(100, score));
  let verdict: BacklinkToxicity['verdict'] = toxicity >= 60 ? 'pollue' : toxicity >= 35 ? 'a_surveiller' : 'sain';
  // Plancher : jamais « sain » quand des référents hors-sujet sont mesurés.
  if (suspicious.length > 0 && verdict === 'sain') verdict = 'a_surveiller';

  const suspiciousNote = suspicious.length > 0
    ? ` Domaines à examiner en priorité : ${suspicious.slice(0, 6).join(', ')}.`
    : '';
  const recommendation = verdict === 'pollue'
    ? `Priorité au nettoyage : constituez un fichier de désaveu sur les domaines d'annuaire et MFA, et diversifiez les ancres avant tout nouvel achat de liens.${suspiciousNote}`
    : verdict === 'a_surveiller'
      ? `Surveillez la répétition d'ancres et la qualité des nouveaux référents ; un désaveu ciblé peut être utile sur les domaines les plus faibles.${suspiciousNote}`
      : "Aucun signal de manipulation sur l'échantillon reçu : pas de désaveu justifié à ce stade, l'échantillon reste toutefois limité aux principaux référents.";

  return {
    toxicity_score: toxicity,
    verdict,
    dominant_anchor_ratio: dominantRatio,
    dominant_anchor: dominant?.anchor ?? null,
    unnatural_anchor_ratio: unnaturalRatio,
    avg_referrer_rank: avgReferrerRank,
    links_per_domain: linksPerDomain,
    broken_ratio: brokenRatio,
    signals,
    recommendation,
  };
}

function unavailable(domain: string, reason: string): AuthorityData {
  return {
    domain, authority_score: 0, domain_rank: 0, domain_rank_raw: 0, referring_domains: 0,
    referring_main_domains: 0, backlinks_total: 0, dofollow_ratio: 0, broken_backlinks: 0,
    first_seen: null, top_referring_domains: [], top_anchors: [], top_anchors_detail: [],
    toxicity: null, distribution: null, top_linked_pages: [], organic_visibility: null,
    referring_domains_sampled: 0, anchors_sampled: 0, anchors_source: 'unavailable',
    confidence: 'low', confidence_reason: reason,
    calibration_version: AUTHORITY_CALIBRATION_VERSION,
    data_source: 'unavailable', unavailable_reason: reason, fetched_at: new Date().toISOString(),
  };
}

async function dfsPost(path: string, payload: unknown, label: string, target: string) {
  const auth = 'Basic ' + btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
  const resp = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });
  if (!resp.ok) throw new Error(`DataForSEO ${path} → ${resp.status}`);
  await trackPaidApiCall('domain-authority', 'dataforseo', label, target).catch(() => {});
  return await resp.json();
}

/** Convertit `referring_links_anchors` (objet ancre→volume) en liste triée. */
function extractAnchors(raw: unknown): { anchor: string; count: number }[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([anchor, count]) => ({ anchor, count: Number(count) || 0 }))
    .filter((a) => a.anchor)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
}

/**
 * Ancres mesurées via `backlinks/anchors/live` : la répartition réelle des
 * ancres, et non l'échantillon tronqué exposé par `summary`.
 */
export function extractAnchorsFromEndpoint(payload: unknown): { anchor: string; count: number }[] {
  const items = (payload as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => ({
      anchor: String(i?.anchor ?? '').trim(),
      count: Number(i?.backlinks ?? i?.referring_domains ?? 0) || 0,
    }))
    .filter((a) => a.anchor)
    .sort((a, b) => b.count - a.count);
}

/**
 * Convertit une carte `clé → volume` du résumé DataForSEO (`referring_links_tld`,
 * `referring_links_countries`, `referring_links_platform_types`) en distribution
 * triée avec parts. Aucun appel supplémentaire : ces cartes sont déjà dans
 * `backlinks/summary/live` (0 crédit dépensé en plus).
 */
export function extractDistribution(raw: unknown, limit = 8): DistributionBucket[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Object.entries(raw as Record<string, unknown>)
    .map(([key, count]) => ({ key: String(key).trim(), count: Number(count) || 0 }))
    .filter((e) => e.key && e.count > 0);
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (!total) return [];
  return entries
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => ({ ...e, share: e.count / total }));
}

/** Pages cibles mesurées via `backlinks/domain_pages/live`. */
export function extractLinkedPages(payload: unknown): LinkedPage[] {
  const items = (payload as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any) => ({
      url: String(i?.meta?.canonical || i?.page_address || i?.url || '').trim(),
      referring_domains: Number(i?.referring_domains ?? 0) || 0,
      backlinks: Number(i?.backlinks ?? 0) || 0,
    }))
    .filter((p) => p.url)
    .sort((a, b) => b.referring_domains - a.referring_domains || b.backlinks - a.backlinks);
}

/**
 * Verdict déterministe sur la répartition du profil : concentration
 * géographique, monoculture de TLD, et dépendance à une seule page cible.
 * Aucun token LLM.
 */
export function computeBacklinkDistribution(input: {
  tld: DistributionBucket[];
  countries: DistributionBucket[];
  platformTypes: DistributionBucket[];
  linkedPages: LinkedPage[];
  referringDomains: number;
}): BacklinkDistribution {
  const { tld, countries, platformTypes, linkedPages, referringDomains } = input;
  const dominantTldShare = tld[0]?.share ?? 0;
  const dominantCountryShare = countries[0]?.share ?? 0;
  const topPageRefs = linkedPages[0]?.referring_domains ?? 0;
  const topPageShare = referringDomains > 0 ? Math.min(1, topPageRefs / referringDomains) : 0;

  const signals: string[] = [];
  if (tld.length && dominantTldShare >= 0.85) {
    signals.push(`profil mono-TLD : ${Math.round(dominantTldShare * 100)} % des liens en .${tld[0].key.replace(/^\./, '')}`);
  }
  if (countries.length && dominantCountryShare >= 0.9) {
    signals.push(`concentration géographique : ${Math.round(dominantCountryShare * 100)} % des liens depuis ${countries[0].key}`);
  }
  if (countries.length > 1 && dominantCountryShare < 0.4) {
    signals.push(`dispersion géographique (pays dominant à ${Math.round(dominantCountryShare * 100)} % seulement)`);
  }
  if (linkedPages.length === 1 && referringDomains > 5) {
    signals.push('une seule page du site reçoit des liens externes');
  } else if (topPageShare >= 0.8 && linkedPages.length > 1) {
    signals.push(`dépendance à une page unique : ${Math.round(topPageShare * 100)} % des référents pointent ${linkedPages[0].url}`);
  }
  const blogPlatform = platformTypes.find((p) => /blog|cms|forum/i.test(p.key));
  if (blogPlatform && blogPlatform.share >= 0.7) {
    signals.push(`${Math.round(blogPlatform.share * 100)} % des liens issus de plateformes « ${blogPlatform.key} »`);
  }

  let recommendation: string;
  if (!tld.length && !countries.length && !linkedPages.length) {
    recommendation = 'Répartition non mesurable : aucune distribution renvoyée par la source. Ne pas conclure sur la géographie des liens.';
  } else if (topPageShare >= 0.8 && linkedPages.length <= 3) {
    recommendation = `Diluer l'entonnoir de liens : ${Math.round(topPageShare * 100)} % de l'autorité arrive sur ${linkedPages[0]?.url || 'une seule page'}. Cibler en priorité 3 pages de conversion ou piliers secondaires dans les prochaines acquisitions de liens.`;
  } else if (dominantCountryShare >= 0.9 && countries.length) {
    recommendation = `Profil ancré sur ${countries[0].key} : cohérent pour une cible locale, limitant pour une ambition internationale. Aller chercher 5 à 10 domaines hors ${countries[0].key} si l'expansion est visée.`;
  } else if (dominantTldShare >= 0.85 && tld.length) {
    recommendation = `Élargir la nature des sources : ${Math.round(dominantTldShare * 100)} % des liens partagent le même TLD. Viser des .org / .edu / médias sectoriels pour crédibiliser le profil.`;
  } else {
    recommendation = 'Répartition équilibrée : conserver la même diversité de sources et de pages cibles lors des prochaines acquisitions.';
  }

  const measuredBlocks = [tld.length > 0, countries.length > 0, linkedPages.length > 0].filter(Boolean).length;
  const source: BacklinkDistribution['source'] =
    measuredBlocks === 0 ? 'unavailable' : measuredBlocks === 3 ? 'dataforseo' : 'partial';

  return {
    tld,
    countries,
    platform_types: platformTypes,
    dominant_tld_share: dominantTldShare,
    dominant_country_share: dominantCountryShare,
    top_page_share: topPageShare,
    linked_pages_sampled: linkedPages.length,
    signals,
    recommendation,
    source,
  };
}


/**
 * Récupère l'autorité de domaine + profil de backlinks.
 * Ne throw jamais : renvoie un objet `unavailable` explicite (pas de silence).
 */
export async function fetchDomainAuthority(
  rawDomain: string,
  opts?: { ttlMinutes?: number; skipCache?: boolean; organicVisibility?: OrganicVisibility | null },
): Promise<AuthorityData> {
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!domain) return unavailable(rawDomain, 'domaine invalide');
  if (!hasAuthorityCredentials()) return unavailable(domain, 'identifiants DataForSEO absents');

  const key = cacheKey('domain-authority', { domain, v: AUTHORITY_CALIBRATION_VERSION });
  if (!opts?.skipCache) {
    const cached = await getCached(key);
    if (cached?.data_source === 'dataforseo' && cached?.calibration_version === AUTHORITY_CALIBRATION_VERSION) {
      return { ...(cached as AuthorityData), organic_visibility: opts?.organicVisibility ?? (cached as AuthorityData).organic_visibility ?? null };
    }
  }

  try {
    const [summaryRes, refRes, anchorRes, pagesRes] = await Promise.allSettled([
      dfsPost('backlinks/summary/live', [{ target: domain, internal_list_limit: 10, include_subdomains: true }], 'backlinks/summary/live', domain),
      dfsPost(
        'backlinks/referring_domains/live',
        [{ target: domain, limit: REFERRING_DOMAINS_SAMPLE_LIMIT, order_by: ['rank,desc'], internal_list_limit: 1 }],
        'backlinks/referring_domains/live',
        domain,
      ),
      dfsPost(
        'backlinks/anchors/live',
        [{ target: domain, limit: ANCHORS_SAMPLE_LIMIT, order_by: ['backlinks,desc'], internal_list_limit: 1 }],
        'backlinks/anchors/live',
        domain,
      ),
      dfsPost(
        'backlinks/domain_pages/live',
        [{ target: domain, limit: LINKED_PAGES_SAMPLE_LIMIT, order_by: ['referring_domains,desc'], internal_list_limit: 1 }],
        'backlinks/domain_pages/live',
        domain,
      ),
    ]);

    if (summaryRes.status !== 'fulfilled') {
      return unavailable(domain, summaryRes.reason instanceof Error ? summaryRes.reason.message : 'appel backlinks/summary échoué');
    }

    const s = summaryRes.value?.tasks?.[0]?.result?.[0];
    if (!s) return unavailable(domain, 'réponse DataForSEO vide');

    const backlinksTotal = s.backlinks || 0;
    const dofollow = backlinksTotal > 0 ? Math.round(((backlinksTotal - (s.backlinks_nofollow || 0)) / backlinksTotal) * 100) : 0;
    const rawRank = s.rank || s.target_rank || 0;
    const domainRank = normalizeDomainRank(rawRank);
    const referringDomains = s.referring_domains || 0;

    // Échantillon complet (jusqu'à 200) pour les statistiques, top 10 pour l'affichage.
    let refSample: AuthorityData['top_referring_domains'] = [];
    if (refRes.status === 'fulfilled') {
      refSample = (refRes.value?.tasks?.[0]?.result?.[0]?.items || [])
        .map((r: any) => ({ domain: r.domain || '', rank: r.rank || 0, backlinks: r.backlinks || 0 }))
        .filter((r: any) => r.domain);
    }
    const topRef = refSample.slice(0, 10);

    // Ancres mesurées si l'endpoint dédié répond, sinon repli sur le summary.
    const endpointAnchors = anchorRes.status === 'fulfilled' ? extractAnchorsFromEndpoint(anchorRes.value) : [];
    const summaryAnchors = extractAnchors(s.referring_links_anchors);
    const anchors = endpointAnchors.length ? endpointAnchors : summaryAnchors;
    const anchorsSource: AuthorityData['anchors_source'] = endpointAnchors.length
      ? 'anchors_endpoint'
      : summaryAnchors.length ? 'summary_sample' : 'unavailable';

    const toxicity = computeBacklinkToxicity({
      anchors,
      topReferringDomains: topRef,
      sampleReferringDomains: refSample,
      backlinksTotal,
      referringDomains,
      brokenBacklinks: s.broken_backlinks || 0,
      dofollowRatio: dofollow,
    });

    // Lot 2 : répartitions TLD / pays / plateformes (déjà dans le résumé, 0 appel
    // supplémentaire) + pages cibles mesurées via `domain_pages`.
    const linkedPages = pagesRes.status === 'fulfilled' ? extractLinkedPages(pagesRes.value) : [];
    const distribution = computeBacklinkDistribution({
      tld: extractDistribution(s.referring_links_tld),
      countries: extractDistribution(s.referring_links_countries),
      platformTypes: extractDistribution(s.referring_links_platform_types),
      linkedPages,
      referringDomains,
    });

    // Confiance : la mesure vaut ce que vaut l'échantillon reçu.
    let confidence: AuthorityData['confidence'] = 'high';
    const missing: string[] = [];
    if (refSample.length === 0) missing.push('domaines référents non détaillés');
    else if (referringDomains > 50 && refSample.length < 50) missing.push(`échantillon de référents réduit (${refSample.length}/${referringDomains})`);
    if (anchorsSource === 'unavailable') missing.push("échantillon d'ancres absent");
    else if (anchorsSource === 'summary_sample') missing.push('ancres issues du résumé, endpoint dédié indisponible');
    if (!rawRank) missing.push('rank de domaine absent');
    if (distribution.source === 'unavailable') missing.push('répartition (TLD, pays, pages cibles) non renvoyée');
    else if (distribution.source === 'partial') missing.push('répartition partielle');
    if (missing.length >= 2) confidence = 'low';
    else if (missing.length === 1) confidence = 'medium';

    const result: AuthorityData = {
      domain,
      authority_score: computeAuthorityScore(domainRank, referringDomains, {
        toxicityScore: toxicity.toxicity_score,
        avgReferrerRank: refSample.length ? toxicity.avg_referrer_rank : undefined,
      }),
      domain_rank: domainRank,
      domain_rank_raw: rawRank,
      referring_domains: referringDomains,
      referring_main_domains: s.referring_main_domains || 0,
      backlinks_total: backlinksTotal,
      dofollow_ratio: dofollow,
      broken_backlinks: s.broken_backlinks || 0,
      first_seen: s.first_seen || null,
      top_referring_domains: topRef,
      top_anchors: anchors.slice(0, 8).map((a) => a.anchor),
      top_anchors_detail: anchors.slice(0, 10),
      toxicity,
      organic_visibility: opts?.organicVisibility ?? null,
      referring_domains_sampled: refSample.length,
      anchors_sampled: anchors.length,
      anchors_source: anchorsSource,
      confidence,
      confidence_reason: missing.length ? `échantillon partiel : ${missing.join(', ')}` : `réponse DataForSEO complète (${refSample.length} référents, ${anchors.length} ancres mesurées)`,
      calibration_version: AUTHORITY_CALIBRATION_VERSION,
      data_source: 'dataforseo',
      fetched_at: new Date().toISOString(),
    };


    // Garde-fou anti-régression : un score quasi parfait est presque toujours
    // un bug de normalisation, pas un domaine parfait.
    if (result.authority_score >= 90) {
      console.warn(`[domain-authority] score suspect ${result.authority_score}/100 sur ${domain} (rank brut ${rawRank}, ref_domains ${referringDomains}) — vérifier la calibration`);
    }

    await setCache(key, 'domain-authority', result, opts?.ttlMinutes ?? 1440);
    return result;
  } catch (e) {
    return unavailable(domain, e instanceof Error ? e.message : 'erreur inconnue');
  }
}

/** Section texte injectable dans un prompt LLM. Jamais silencieuse. */
export function buildAuthorityPromptSection(a: AuthorityData | null): string {
  if (!a) return 'AUTORITE / BACKLINKS : bloc non collecté pour cet audit.';
  if (a.data_source !== 'dataforseo') {
    return `AUTORITE / BACKLINKS : données indisponibles (${a.unavailable_reason || 'raison inconnue'}). N'invente aucun chiffre de backlinks ni d'Authority Score.`;
  }
  const refs = a.top_referring_domains.length
    ? a.top_referring_domains.slice(0, 5).map(r => `${r.domain}(rank ${r.rank}, ${r.backlinks} liens)`).join(', ')
    : 'aucun domaine référent notable';
  const lines = [
    `AUTORITE / BACKLINKS (DataForSEO, chiffres réels — ne pas deviner) :`,
    `- Authority Score Crawlers = ${a.authority_score}/100 (estimation propriétaire, plafonnée à 92 ; rank source ${a.domain_rank_raw}/1000 normalisé à ${a.domain_rank}/100)`,
    `- Fiabilité de la mesure : ${a.confidence} (${a.confidence_reason})`,
    `- Domaines référents = ${a.referring_domains} (dont domaines principaux : ${a.referring_main_domains})`,
    `- Backlinks totaux = ${a.backlinks_total}, ratio dofollow = ${a.dofollow_ratio}%, liens cassés = ${a.broken_backlinks}`,
    `- Premier backlink observé : ${a.first_seen || 'inconnu'}`,
    `- Top domaines référents : ${refs}`,
    `- Échantillon analysé : ${a.referring_domains_sampled} domaines référents sur ${a.referring_domains}, ${a.anchors_sampled} ancres (${a.anchors_source === 'anchors_endpoint' ? 'ancres mesurées via endpoint dédié' : a.anchors_source === 'summary_sample' ? 'ancres issues du résumé, échantillon tronqué' : 'ancres indisponibles'})`,
    a.top_anchors.length ? `- Ancres principales : ${a.top_anchors.join(', ')}` : `- Ancres principales : non exploitables`,
  ];
  if (a.toxicity) {
    const t = a.toxicity;
    lines.push(
      `- TOXICITE DU PROFIL = ${t.toxicity_score}/100, verdict "${t.verdict}" (ancre dominante ${Math.round(t.dominant_anchor_ratio * 100)} %, ancres non naturelles ${Math.round(t.unnatural_anchor_ratio * 100)} %, rank moyen des référents ${t.avg_referrer_rank}/100, ${t.links_per_domain} liens/domaine)`,
      t.signals.length ? `- Signaux de toxicité : ${t.signals.join(' ; ')}` : `- Signaux de toxicité : aucun`,
      `- Action liens : ${t.recommendation}`,
    );
  }
  const v = a.organic_visibility;
  if (v && v.source === 'dataforseo_labs') {
    lines.push(`- VISIBILITE ORGANIQUE : ${v.ranked_keywords ?? 'n/a'} mots-clés positionnés, trafic estimé ${v.estimated_traffic ?? 'n/a'}/mois, position moyenne ${v.average_position ?? 'n/a'}, top3=${v.top3 ?? 'n/a'}, top10=${v.top10 ?? 'n/a'}`);
  } else {
    lines.push(`- VISIBILITE ORGANIQUE : non mesurée dans cet audit. N'invente ni trafic ni position.`);
  }
  lines.push(`- IMPORTANT : l'Authority Score est une estimation propriétaire Crawlers, pas un score Semrush/Moz/Majestic. Ne la présente jamais comme un chiffre officiel.`);
  return lines.join('\n');
}
