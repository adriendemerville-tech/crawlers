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
export const AUTHORITY_CALIBRATION_VERSION = 5;

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
  /**
   * Périmètre réellement scoré. `third_party_only` = le réseau propre (domaines
   * appartenant à la marque) a été retiré de l'échantillon : le score ne porte
   * que sur les liens tiers, seul périmètre où le désaveu est un outil pertinent.
   */
  scope: 'third_party_only' | 'all_referrers';
  /** Domaines référents rattachés au réseau propre (affichage / traçabilité). */
  own_network_domains?: string[];
  /** Part des backlinks de l'échantillon issus du réseau propre (0-1). */
  own_network_backlink_share?: number;
  /** Liens/domaine tous référents confondus (comparaison avec la valeur hors réseau). */
  links_per_domain_all?: number;
  /**
   * DataForSEO ne rattache pas une ancre à son domaine référent : le ratio
   * d'ancre dominante porte donc sur tous les référents. Quand le réseau propre
   * pèse lourd, la pénalité d'ancre est minorée au lieu d'être affirmée.
   */
  anchor_attribution: 'all_referrers' | 'all_referrers_downgraded';
  /** Dofollow lu comme facteur contextuel, jamais comme preuve autonome. */
  dofollow_context?: DofollowContext | null;
  /** Autorité apparente vs autorité indépendante estimée (simulation indicative). */
  independence?: IndependenceEstimate | null;
}

/**
 * Le caractère dofollow d'un lien est normal en SEO. Il n'est retenu comme
 * facteur aggravant que lorsqu'il est corroboré par d'autres anomalies
 * structurelles mesurées sur le profil (faisceau d'indices).
 */
export interface DofollowContext {
  ratio: number;
  level: 'faible' | 'a_surveiller' | 'aggravant';
  /** Points effectivement ajoutés au score de toxicité (0, 3 ou 8). */
  points: number;
  /** Anomalies mesurées qui corroborent la lecture — jamais des suppositions. */
  corroborating: string[];
  sitewide_suspected: boolean;
  note: string;
}

/** Volumétrie apparente ramenée à une volumétrie de recommandations plausibles. */
export interface IndependenceEstimate {
  apparent_backlinks: number;
  own_network_backlinks: number;
  repeated_third_party_backlinks: number;
  estimated_independent_backlinks: number;
  estimated_independent_domains: number;
  /** Part de la volumétrie dépendante du réseau propre ou de la répétition (0-1). */
  dependency_share: number;
  method: string;
}

/** Nature d'un domaine référent — trois compartiments mesurés séparément. */
export type ReferrerCompartment = 'own_network' | 'directory_platform' | 'third_party_editorial';

export interface CompartmentStats {
  compartment: ReferrerCompartment;
  domains: number;
  backlinks: number;
  /** Part des domaines de l'échantillon (0-1) */
  share_domains: number;
  avg_rank: number;
  top_domains: string[];
}

export interface BacklinkSegmentation {
  own_network: CompartmentStats;
  directory_platform: CompartmentStats;
  third_party_editorial: CompartmentStats;
  /** Provenance de la classification « à moi » : preuve de propriété ou heuristique de marque. */
  own_network_source: 'verified' | 'brand_token_suspected' | 'mixed' | 'none';
  own_network_domains: { domain: string; source: 'verified' | 'suspected'; backlinks: number }[];
  sampled: number;
}

/**
 * Hygiène du réseau propre — indicateur distinct, jamais additionné à la
 * toxicité. Un footer répliqué sur 6 pays est un vrai défaut SEO, mais il se
 * corrige à la source, pas par un désaveu.
 */
export interface OwnNetworkHygiene {
  domains: number;
  backlinks: number;
  links_per_domain: number;
  /** Empreinte sitewide probable (liens/domaine élevé sur le réseau propre) */
  sitewide_suspected: boolean;
  verdict: 'non_mesure' | 'sain' | 'a_corriger_a_la_source';
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
  /** Segmentation du profil en trois compartiments (réseau propre / annuaires / éditorial tiers) */
  segmentation?: BacklinkSegmentation | null;
  /** Hygiène du réseau propre — indicateur séparé, jamais ajouté à la toxicité */
  own_network_hygiene?: OwnNetworkHygiene | null;
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
 * Réseau propre de la marque : déclinaisons du même nom sur d'autres extensions
 * ou avec un suffixe traduit (avenir-renovations.fr → .be, .lu, .ch,
 * avenir-reformas.es, avenir-obras.pt). Ces liens sont du maillage inter-pays,
 * pas de l'achat de liens : les compter comme toxiques conduirait à recommander
 * un désaveu contre-productif.
 *
 * Règle déterministe : on compare les jetons du label de second niveau. Un jeton
 * commun de 5 caractères ou plus (hors mots très génériques) suffit à rattacher
 * le référent au même réseau.
 */
const GENERIC_BRAND_TOKENS = new Set([
  'group', 'groupe', 'france', 'europe', 'world', 'international', 'travaux',
  'maison', 'batiment', 'service', 'services', 'online', 'contact', 'agence',
]);

function brandTokens(host: string): string[] {
  const label = String(host || '').toLowerCase().replace(/^www\./, '').split('.')[0] || '';
  return label
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 5 && !GENERIC_BRAND_TOKENS.has(t));
}

export function detectOwnNetworkDomains(
  auditedDomain: string,
  domains: { domain: string }[],
): string[] {
  const own = brandTokens(auditedDomain);
  if (own.length === 0) return [];
  const audited = String(auditedDomain || '').toLowerCase().replace(/^www\./, '');
  const out: string[] = [];
  for (const d of domains || []) {
    const host = String(d?.domain || '').toLowerCase().replace(/^www\./, '');
    if (!host || host === audited) continue;
    const tokens = brandTokens(host);
    if (tokens.some((t) => own.includes(t))) out.push(host);
  }
  return Array.from(new Set(out));
}

const norm = (h: string) => String(h || '').toLowerCase().replace(/^www\./, '').replace(/\/.*$/, '');

/**
 * Annuaires, agrégateurs et plateformes de publication ouverte. Ce sont des
 * liens tiers (ils comptent donc dans la toxicité), mais on les isole pour que
 * le lecteur voie d'où vient réellement son profil.
 */
const DIRECTORY_PATTERNS: RegExp[] = [
  /\b(annuaire|directory|listing|pagesjaunes|yellowpages|kompass|societe|verif|infogreffe|bilansgratuits)\b/i,
  /(pages-?jaunes|118000|justacote|hotfrog|cylex|opendi|tuugo|nicelocal|europages|manageo|bloomberg-?directory)/i,
  /\b(blogspot|wordpress|wixsite|weebly|jimdo|over-?blog|medium|tumblr|webnode|strikingly)\b/i,
  /\b(forum|annonces|petites-?annonces|classifieds)\b/i,
];

function isDirectoryLike(host: string): boolean {
  return DIRECTORY_PATTERNS.some((re) => re.test(host));
}

function statsFor(
  compartment: ReferrerCompartment,
  items: { domain: string; rank: number; backlinks: number }[],
  sampled: number,
): CompartmentStats {
  const ranks = items.map((i) => normalizeDomainRank(i.rank));
  return {
    compartment,
    domains: items.length,
    backlinks: items.reduce((s, i) => s + (i.backlinks || 0), 0),
    share_domains: sampled > 0 ? Math.round((items.length / sampled) * 1000) / 1000 : 0,
    avg_rank: ranks.length ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10 : 0,
    top_domains: [...items]
      .sort((a, b) => (b.backlinks || 0) - (a.backlinks || 0))
      .slice(0, 8)
      .map((i) => norm(i.domain)),
  };
}

/**
 * Segmente l'échantillon de référents en trois compartiments.
 *
 * La classification « à moi » suit l'ordre preuves d'abord :
 *   1. `verifiedOwnDomains` — propriété prouvée (Search Console, GMB, sites
 *      suivis, déclaration client) ;
 *   2. racine de marque commune — simple **suggestion**, marquée `suspected`,
 *      jamais présentée comme un fait.
 */
export function segmentReferringDomains(
  auditedDomain: string,
  sample: { domain: string; rank: number; backlinks: number }[],
  verifiedOwnDomains: string[] = [],
): BacklinkSegmentation {
  const items = (sample || []).filter((d) => d?.domain).map((d) => ({ ...d, domain: norm(d.domain) }));
  const verified = new Set(verifiedOwnDomains.map(norm).filter(Boolean));
  const suspected = new Set(detectOwnNetworkDomains(auditedDomain, items).map(norm));

  const own: typeof items = [];
  const dir: typeof items = [];
  const third: typeof items = [];
  const ownDetail: BacklinkSegmentation['own_network_domains'] = [];

  for (const it of items) {
    if (verified.has(it.domain)) {
      own.push(it);
      ownDetail.push({ domain: it.domain, source: 'verified', backlinks: it.backlinks || 0 });
    } else if (suspected.has(it.domain)) {
      own.push(it);
      ownDetail.push({ domain: it.domain, source: 'suspected', backlinks: it.backlinks || 0 });
    } else if (isDirectoryLike(it.domain)) {
      dir.push(it);
    } else {
      third.push(it);
    }
  }

  const hasVerified = ownDetail.some((d) => d.source === 'verified');
  const hasSuspected = ownDetail.some((d) => d.source === 'suspected');
  const ownSource: BacklinkSegmentation['own_network_source'] = hasVerified && hasSuspected
    ? 'mixed'
    : hasVerified ? 'verified' : hasSuspected ? 'brand_token_suspected' : 'none';

  return {
    own_network: statsFor('own_network', own, items.length),
    directory_platform: statsFor('directory_platform', dir, items.length),
    third_party_editorial: statsFor('third_party_editorial', third, items.length),
    own_network_source: ownSource,
    own_network_domains: ownDetail.sort((a, b) => b.backlinks - a.backlinks),
    sampled: items.length,
  };
}

/**
 * Hygiène du réseau propre. Verdict actionnable à la source, jamais un désaveu :
 * le site est contrôlé par le client, donc on corrige le footer et les ancres,
 * on ne demande rien à Google.
 */
export function computeOwnNetworkHygiene(
  seg: BacklinkSegmentation | null,
  dominantAnchor: string | null,
  dominantAnchorRatio: number,
): OwnNetworkHygiene {
  const s = seg?.own_network;
  if (!s || s.domains === 0) {
    return {
      domains: 0,
      backlinks: 0,
      links_per_domain: 0,
      sitewide_suspected: false,
      verdict: 'non_mesure',
      signals: [],
      recommendation:
        "Aucun domaine du réseau propre détecté dans l'échantillon : rien à corriger à la source sur ce périmètre.",
    };
  }
  const lpd = s.domains > 0 ? Math.round((s.backlinks / s.domains) * 10) / 10 : 0;
  const sitewide = lpd >= 10;
  const signals: string[] = [
    `${s.domains} domaine${s.domains > 1 ? 's' : ''} du réseau propre (${s.top_domains.slice(0, 6).join(', ')})`,
    `${s.backlinks} liens, soit ${lpd} liens par domaine`,
  ];
  if (sitewide) signals.push(`empreinte sitewide probable : ${lpd} liens par domaine du réseau (footer ou en-tête répliqué)`);
  if (dominantAnchorRatio >= 0.3 && dominantAnchor) {
    signals.push(
      `ancre dominante « ${dominantAnchor} » à ${Math.round(dominantAnchorRatio * 100)} % — non rattachable domaine par domaine par la source, à vérifier d'abord sur le réseau propre`,
    );
  }
  const verdict: OwnNetworkHygiene['verdict'] = sitewide || dominantAnchorRatio >= 0.3 ? 'a_corriger_a_la_source' : 'sain';
  const recommendation = verdict === 'a_corriger_a_la_source'
    ? "Ne pas désavouer : ces domaines vous appartiennent. Corriger à la source — sortir les liens du footer répliqué pour les placer dans du contenu contextuel, et varier ou neutraliser les ancres exactes (marque, nom de pays, URL nue) plutôt que de répéter la même."
    : 'Maillage inter-pays cohérent : liens peu nombreux par domaine et ancres non saturées. Aucune action, et en aucun cas un désaveu.';
  return { domains: s.domains, backlinks: s.backlinks, links_per_domain: lpd, sitewide_suspected: sitewide, verdict, signals, recommendation };
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
  /** Domaine audité : sert à rattacher le réseau propre de la marque. */
  auditedDomain?: string;
  /** Domaines dont la propriété est prouvée (GSC, GMB, sites suivis, déclaration). */
  verifiedOwnDomains?: string[];
  /** Segmentation déjà calculée (évite un double calcul par l'appelant). */
  segmentation?: BacklinkSegmentation | null;
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
  const rawSample = (input.sampleReferringDomains?.length ? input.sampleReferringDomains : input.topReferringDomains) || [];
  // Segmentation en trois compartiments : le score de toxicité ne porte que sur
  // les liens tiers (éditorial + annuaires), seul périmètre où le désaveu a un
  // sens. Le réseau propre est mesuré séparément (hygiène), pas exclu en silence.
  const seg = input.segmentation
    ?? (input.auditedDomain ? segmentReferringDomains(input.auditedDomain, rawSample, input.verifiedOwnDomains || []) : null);
  const ownNetwork = seg ? seg.own_network_domains.map((d) => d.domain) : [];
  const ownSet = new Set(ownNetwork);
  const refSample = rawSample.filter((d) => !ownSet.has(norm(d?.domain || '')));
  const ranks = refSample.map((d) => normalizeDomainRank(d.rank));
  const avgReferrerRank = ranks.length
    ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10
    : 0;

  // Liens/domaine : deux volumétries, « tous référents » et « hors réseau propre ».
  // La seconde sert au score, la première reste affichée pour la vérification.
  const linksPerDomainAll = input.referringDomains > 0
    ? Math.round((input.backlinksTotal / input.referringDomains) * 10) / 10
    : 0;
  const ownBacklinks = seg?.own_network.backlinks ?? 0;
  const ownDomains = seg?.own_network.domains ?? 0;
  const thirdBacklinks = Math.max(0, input.backlinksTotal - ownBacklinks);
  const thirdDomains = Math.max(0, input.referringDomains - ownDomains);
  const linksPerDomain = thirdDomains > 0
    ? Math.round((thirdBacklinks / thirdDomains) * 10) / 10
    : linksPerDomainAll;
  const ownBacklinkShare = input.backlinksTotal > 0
    ? Math.round((ownBacklinks / input.backlinksTotal) * 1000) / 1000
    : 0;
  const brokenRatio = input.backlinksTotal > 0
    ? Math.round((input.brokenBacklinks / input.backlinksTotal) * 100) / 100
    : 0;

  const signals: string[] = [];
  let score = 0;

  // L'ancre n'est pas rattachable à son domaine référent par la source : quand le
  // réseau propre pèse 20 % des liens ou plus, la pénalité est minorée de moitié
  // et l'ancre est renvoyée vers l'hygiène du réseau propre.
  const anchorDowngraded = ownBacklinkShare >= 0.2;
  if (dominantRatio >= 0.3) {
    const full = Math.min(35, Math.round((dominantRatio - 0.3) * 100) + 15);
    const applied = anchorDowngraded ? Math.round(full / 2) : full;
    score += applied;
    signals.push(
      anchorDowngraded
        ? `ancre « ${dominant?.anchor} » répétée sur ${Math.round(dominantRatio * 100)} % de l'échantillon — pénalité minorée (${applied} au lieu de ${full}) : ${Math.round(ownBacklinkShare * 100)} % des liens viennent du réseau propre et la source ne rattache pas les ancres à leur domaine`
        : `ancre « ${dominant?.anchor} » répétée sur ${Math.round(dominantRatio * 100)} % de l'échantillon`,
    );
  }
  if (unnaturalRatio >= 0.25) {
    score += Math.min(25, Math.round((unnaturalRatio - 0.25) * 60) + 10);
    signals.push(`${Math.round(unnaturalRatio * 100)} % d'ancres non naturelles (URL nue, mot générique, emoji)`);
  }
  if (ranks.length >= 3 && avgReferrerRank < 15) {
    score += 20;
    signals.push(`principaux référents tiers à faible autorité (rank moyen ${avgReferrerRank}/100)`);
  }
  if (linksPerDomain >= 25) {
    score += Math.min(20, Math.round(linksPerDomain / 5));
    signals.push(`${linksPerDomain} liens par domaine référent tiers en moyenne — empreinte de type annuaire`);
  }

  if (brokenRatio >= 0.1) {
    score += 10;
    signals.push(`${Math.round(brokenRatio * 100)} % de liens entrants cassés`);
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

  // ── Dofollow : facteur contextuel, jamais une preuve autonome ──────────────
  // Un lien dofollow est le comportement normal d'un lien éditorial. Il ne pèse
  // que s'il est corroboré par d'autres anomalies structurelles mesurées
  // (répétition, empreinte sitewide, concentration, ancres, faible autorité).
  const ownLinksPerDomain = ownDomains > 0 ? Math.round((ownBacklinks / ownDomains) * 10) / 10 : 0;
  // La concentration n'a de sens qu'à partir d'une volumétrie mesurable : sinon
  // 2 liens sur 6 suffiraient à fabriquer une « anomalie ».
  const topReferrerShare = input.backlinksTotal >= 50

    ? Math.max(0, ...rawSample.map((d) => (d.backlinks || 0) / input.backlinksTotal))
    : 0;
  const sitewideSuspected = ownLinksPerDomain >= 10 || linksPerDomainAll >= 25;

  const corroborating: string[] = [];
  if (sitewideSuspected) {
    corroborating.push(
      ownLinksPerDomain >= 10
        ? `empreinte sitewide probable : ${ownLinksPerDomain} liens par domaine du réseau propre`
        : `${linksPerDomainAll} liens par domaine référent en moyenne — répétition probable des liens`,
    );
  }
  if (ownBacklinkShare >= 0.2) {
    corroborating.push(`${Math.round(ownBacklinkShare * 100)} % des liens proviennent de ${ownDomains} domaine${ownDomains > 1 ? 's' : ''} rattaché${ownDomains > 1 ? 's' : ''} au réseau propre`);
  }
  if (dominantRatio >= 0.3) {
    corroborating.push(`ancre « ${dominant?.anchor} » sur ${Math.round(dominantRatio * 100)} % de l'échantillon`);
  }
  if (unnaturalRatio >= 0.25) {
    corroborating.push(`${Math.round(unnaturalRatio * 100)} % d'ancres non naturelles`);
  }
  if (ranks.length >= 3 && avgReferrerRank < 15) {
    corroborating.push(`autorité moyenne des domaines tiers très faible (${avgReferrerRank}/100)`);
  }
  if (topReferrerShare >= 0.15) {
    corroborating.push(`un seul domaine référent concentre ${Math.round(topReferrerShare * 100)} % des liens mesurés`);
  }
  if (suspicious.length > 0) {
    corroborating.push(`${suspicious.length} référent${suspicious.length > 1 ? 's' : ''} hors-sujet`);
  }

  const dofollowHigh = input.dofollowRatio >= 95 && input.referringDomains > 50;
  const dofollowLevel: DofollowContext['level'] = !dofollowHigh
    ? 'faible'
    : corroborating.length >= 2
      ? 'aggravant'
      : corroborating.length === 1
        ? 'a_surveiller'
        : 'faible';
  const dofollowPoints = dofollowLevel === 'aggravant' ? 8 : dofollowLevel === 'a_surveiller' ? 3 : 0;
  if (dofollowPoints > 0) {
    score += dofollowPoints;
    signals.push(
      `${Math.round(input.dofollowRatio)} % de liens dofollow — facteur ${dofollowLevel === 'aggravant' ? 'aggravant' : 'à surveiller'} dans ce contexte (${corroborating.length} anomalie${corroborating.length > 1 ? 's' : ''} structurelle${corroborating.length > 1 ? 's' : ''} corroborante${corroborating.length > 1 ? 's' : ''}), et non un défaut en soi`,
    );
  }
  const dofollow_context: DofollowContext = {
    ratio: Math.round(input.dofollowRatio * 10) / 10,
    level: dofollowLevel,
    points: dofollowPoints,
    corroborating,
    sitewide_suspected: sitewideSuspected,
    note: dofollowHigh
      ? 'Un lien dofollow est un lien normal : un profil naturel peut en contenir une très forte proportion. Il n\'est retenu comme facteur aggravant que corroboré par d\'autres anomalies mesurées.'
      : 'Proportion de liens dofollow dans la norme observée, ou échantillon de domaines trop réduit pour en tirer un signal.',
  };

  // ── Autorité apparente vs autorité indépendante estimée ───────────────────
  // Simulation indicative : on neutralise conceptuellement les liens du réseau
  // propre puis la répétition au-delà de 3 liens par domaine tiers (footer,
  // en-tête, template). Ce n'est pas une reproduction du calcul de Google.
  const independentLinks = Math.min(thirdBacklinks, thirdDomains * 3);
  const independence: IndependenceEstimate = {
    apparent_backlinks: input.backlinksTotal,
    own_network_backlinks: ownBacklinks,
    repeated_third_party_backlinks: Math.max(0, thirdBacklinks - independentLinks),
    estimated_independent_backlinks: independentLinks,
    estimated_independent_domains: thirdDomains,
    dependency_share: input.backlinksTotal > 0
      ? Math.round((1 - independentLinks / input.backlinksTotal) * 1000) / 1000
      : 0,
    method: 'Réseau propre retiré, puis répétition au-delà de 3 liens par domaine tiers neutralisée. Simulation indicative — non équivalente au calcul de Google.',
  };


  const toxicity = Math.max(0, Math.min(100, score));
  let verdict: BacklinkToxicity['verdict'] = toxicity >= 60 ? 'pollue' : toxicity >= 35 ? 'a_surveiller' : 'sain';
  // Plancher : jamais « sain » quand des référents hors-sujet sont mesurés.
  if (suspicious.length > 0 && verdict === 'sain') verdict = 'a_surveiller';

  const suspiciousNote = suspicious.length > 0
    ? ` Domaines à examiner en priorité : ${suspicious.slice(0, 6).join(', ')}.`
    : '';
  // Le réseau propre n'est pas « sain » par décret : il est mesuré à part
  // (hygiène du réseau) et sorti du périmètre de désaveu, qui n'a de sens que
  // sur des domaines tiers.
  const ownVerified = seg?.own_network_domains.filter((d) => d.source === 'verified').length ?? 0;
  const ownSuspected = seg?.own_network_domains.filter((d) => d.source === 'suspected').length ?? 0;
  const ownNote = ownNetwork.length > 0
    ? ` ${ownNetwork.length} domaine${ownNetwork.length > 1 ? 's' : ''} référent${ownNetwork.length > 1 ? 's' : ''} relève${ownNetwork.length > 1 ? 'nt' : ''} de votre réseau propre (${ownNetwork.slice(0, 6).join(', ')}${ownSuspected > 0 ? `, dont ${ownSuspected} rattaché${ownSuspected > 1 ? 's' : ''} par racine de marque, à confirmer` : ''}${ownVerified > 0 ? `, dont ${ownVerified} à propriété prouvée` : ''}) : hors périmètre de désaveu, évalué séparément dans « Hygiène du réseau propre ».`
    : '';
  if (ownNetwork.length > 0) {
    signals.push(`réseau propre sorti du périmètre de toxicité (mesuré à part) : ${ownNetwork.slice(0, 6).join(', ')}`);
  }
  const recommendation = (verdict === 'pollue'
    ? `Ordre d'investigation avant toute action : 1) identifier les liens sitewide (footer, en-tête, sidebar, template) et le nombre de pages sources ; 2) vérifier les relations réelles entre domaines (propriété, marque, hébergement) — une racine de marque commune ne suffit pas à conclure ; 3) analyser la typologie des ancres ; 4) qualifier le contexte des liens (éditorial, navigationnel, annuaire). Le désaveu ne se justifie qu'après cette vérification, sur des domaines tiers réellement artificiels ; sur le réseau propre, on corrige à la source.${suspiciousNote}`
    : verdict === 'a_surveiller'
      ? `Surveillez la répétition d'ancres, l'empreinte sitewide et la qualité des nouveaux référents tiers. Un désaveu ne se justifie qu'après avoir vérifié que les liens visés sont réellement tiers et manifestement construits — ni la faible autorité ni le volume ne suffisent.${suspiciousNote}`
      : "Aucun signal de manipulation sur les liens tiers de l'échantillon : pas de désaveu justifié à ce stade, l'échantillon reste toutefois limité aux principaux référents.")

    + ownNote;

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
    scope: ownNetwork.length > 0 ? 'third_party_only' : 'all_referrers',
    own_network_domains: ownNetwork,
    own_network_backlink_share: ownBacklinkShare,
    links_per_domain_all: linksPerDomainAll,
    anchor_attribution: anchorDowngraded ? 'all_referrers_downgraded' : 'all_referrers',
    dofollow_context,
    independence,

  };
}



function unavailable(domain: string, reason: string): AuthorityData {
  return {
    domain, authority_score: 0, domain_rank: 0, domain_rank_raw: 0, referring_domains: 0,
    referring_main_domains: 0, backlinks_total: 0, dofollow_ratio: 0, broken_backlinks: 0,
    first_seen: null, top_referring_domains: [], top_anchors: [], top_anchors_detail: [],
    toxicity: null, distribution: null, top_linked_pages: [], organic_visibility: null,
    segmentation: null, own_network_hygiene: null,

    referring_domains_sampled: 0, anchors_sampled: 0, anchors_source: 'unavailable',
    confidence: 'low', confidence_reason: reason,
    calibration_version: AUTHORITY_CALIBRATION_VERSION,
    data_source: 'unavailable', unavailable_reason: reason, fetched_at: new Date().toISOString(),
  };
}

/** Appel DataForSEO backlinks partagé (exporté pour l'historisation — lot 3 — et le link gap — lot 4). */
export async function dfsBacklinksPost(path: string, payload: unknown, label: string, target: string) {
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
    recommendation = 'Diversité géographique et technique équilibrée : conserver la même répartition de pays, d\'extensions et de pages cibles lors des prochaines acquisitions. Ce constat porte uniquement sur la répartition des sources, pas sur leur qualité : la toxicité des ancres et l\'autorité des référents sont évaluées séparément.';
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
  opts?: {
    ttlMinutes?: number;
    skipCache?: boolean;
    organicVisibility?: OrganicVisibility | null;
    /** Domaines dont la propriété est prouvée (GSC, GMB, sites suivis, déclaration client). */
    verifiedOwnDomains?: string[];
  },

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
      dfsBacklinksPost('backlinks/summary/live', [{ target: domain, internal_list_limit: 10, include_subdomains: true }], 'backlinks/summary/live', domain),
      dfsBacklinksPost(
        'backlinks/referring_domains/live',
        [{ target: domain, limit: REFERRING_DOMAINS_SAMPLE_LIMIT, order_by: ['rank,desc'], internal_list_limit: 1 }],
        'backlinks/referring_domains/live',
        domain,
      ),
      dfsBacklinksPost(
        'backlinks/anchors/live',
        [{ target: domain, limit: ANCHORS_SAMPLE_LIMIT, order_by: ['backlinks,desc'], internal_list_limit: 1 }],
        'backlinks/anchors/live',
        domain,
      ),
      dfsBacklinksPost(
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

    // Segmentation en trois compartiments, calculée une seule fois puis partagée
    // avec le score de toxicité et l'indicateur d'hygiène du réseau propre.
    const segmentation = segmentReferringDomains(domain, refSample, opts?.verifiedOwnDomains || []);

    const toxicity = computeBacklinkToxicity({
      anchors,
      topReferringDomains: topRef,
      sampleReferringDomains: refSample,
      backlinksTotal,
      referringDomains,
      brokenBacklinks: s.broken_backlinks || 0,
      dofollowRatio: dofollow,
      auditedDomain: domain,
      verifiedOwnDomains: opts?.verifiedOwnDomains || [],
      segmentation,
    });
    const ownNetworkHygiene = computeOwnNetworkHygiene(
      segmentation,
      toxicity.dominant_anchor,
      toxicity.dominant_anchor_ratio,
    );



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
      distribution,
      top_linked_pages: linkedPages.slice(0, 10),
      segmentation,
      own_network_hygiene: ownNetworkHygiene,

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
  if (a.segmentation && a.segmentation.sampled > 0) {
    const g = a.segmentation;
    const fmt = (c: CompartmentStats) => `${c.domains} domaines (${Math.round(c.share_domains * 100)} %), ${c.backlinks} liens, rank moyen ${c.avg_rank}/100`;
    lines.push(
      `- SEGMENTATION DU PROFIL (échantillon de ${g.sampled} référents) : réseau propre → ${fmt(g.own_network)} ; annuaires/plateformes → ${fmt(g.directory_platform)} ; éditorial tiers → ${fmt(g.third_party_editorial)}`,
      `- Classification du réseau propre : ${g.own_network_source === 'verified' ? 'propriété prouvée' : g.own_network_source === 'brand_token_suspected' ? 'rattachement par racine de marque, À CONFIRMER (ne pas affirmer que ces domaines appartiennent au client)' : g.own_network_source === 'mixed' ? 'partiellement prouvée, partiellement supposée' : 'aucun réseau propre détecté'}`,
    );
  }
  if (a.toxicity) {
    const t = a.toxicity;
    lines.push(
      `- TOXICITE DU PROFIL = ${t.toxicity_score}/100 (périmètre : ${t.scope === 'third_party_only' ? 'liens tiers uniquement, réseau propre exclu' : 'tous les référents'}), verdict "${t.verdict}" (ancre dominante ${Math.round(t.dominant_anchor_ratio * 100)} %, ancres non naturelles ${Math.round(t.unnatural_anchor_ratio * 100)} %, rank moyen des référents tiers ${t.avg_referrer_rank}/100, ${t.links_per_domain} liens/domaine hors réseau propre${typeof t.links_per_domain_all === 'number' ? ` contre ${t.links_per_domain_all} tous référents` : ''})`,
      t.signals.length ? `- Signaux de toxicité : ${t.signals.join(' ; ')}` : `- Signaux de toxicité : aucun`,
      `- Action liens : ${t.recommendation}`,
    );
  }
  if (a.own_network_hygiene && a.own_network_hygiene.verdict !== 'non_mesure') {
    const h = a.own_network_hygiene;
    lines.push(
      `- HYGIENE DU RESEAU PROPRE (indicateur distinct, JAMAIS additionné à la toxicité) = verdict "${h.verdict}" : ${h.domains} domaines, ${h.backlinks} liens, ${h.links_per_domain} liens/domaine${h.sitewide_suspected ? ', empreinte sitewide probable' : ''}`,
      `- Action réseau propre : ${h.recommendation} Ne jamais proposer de désaveu sur ces domaines.`,
    );
  }

  const d = a.distribution;
  if (d && d.source !== 'unavailable') {
    const pct = (b: DistributionBucket) => `${b.key} ${Math.round(b.share * 100)} %`;
    if (d.tld.length) lines.push(`- Répartition par TLD (mesurée) : ${d.tld.slice(0, 5).map(pct).join(', ')}`);
    if (d.countries.length) lines.push(`- Répartition par pays (mesurée) : ${d.countries.slice(0, 5).map(pct).join(', ')}`);
    if (d.platform_types.length) lines.push(`- Types de plateformes référentes : ${d.platform_types.slice(0, 5).map(pct).join(', ')}`);
    if (a.top_linked_pages.length) {
      lines.push(
        `- Pages cibles les plus liées (${d.linked_pages_sampled} pages liées dans l'échantillon) : ${a.top_linked_pages.slice(0, 5).map(p => `${p.url} (${p.referring_domains} domaines)`).join(' ; ')}`,
        `- Concentration sur la page la plus liée : ${Math.round(d.top_page_share * 100)} % des domaines référents`,
      );
    }
    lines.push(
      d.signals.length ? `- Signaux de répartition : ${d.signals.join(' ; ')}` : `- Signaux de répartition : aucun déséquilibre notable`,
      `- Action répartition : ${d.recommendation}`,
    );
  } else {
    lines.push(`- RÉPARTITION DU PROFIL (TLD, pays, pages cibles) : non mesurée dans cet audit. N'invente ni géographie ni page cible.`);
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
