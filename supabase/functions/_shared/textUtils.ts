/**
 * Shared text utilities for strategic audit functions.
 * Extracted from audit-strategique-ia to reduce monolith size.
 */

export const STOP_WORDS = new Set([
  'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
  'il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou',
  'plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes',
  'si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore',
  'tout','tous','même','autre','autres','chaque','quelque','quel','quelle','quels','quelles',
  'certains','plusieurs','aucun','tel','telle','tels','telles',
  'gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https',
  'bienvenue','welcome','home','officiel','official',
  'the','and','for','with','your','our','from','that','this','are','was','will','can','has','have',
  'calcul','calculer','outil','service','solution','application','app','logiciel','plateforme',
]);

/** Clean text and tokenize into meaningful words (filters stop words) */
export function cleanAndTokenize(text: string, extraExclusions?: Set<string>): string[] {
  return text.toLowerCase()
    .replace(/[|–—·:,\.!?]/g, ' ')
    .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w) && !(extraExclusions?.has(w)));
}

/** Extract Title/H1/Desc from page content context string */
export function extractMetadataTexts(pageContentContext: string): string[] {
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  return [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
}

/** Build a set of domain-derived slugs to filter out brand terms */
export function buildDomainSlugs(domain: string): Set<string> {
  const slugs = new Set<string>();
  if (!domain) return slugs;
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  for (const part of cleanDomain.split('.')) {
    if (part.length > 2) slugs.add(part);
  }
  slugs.add(cleanDomain.replace(/\./g, ''));
  if (cleanDomain.split('.').length > 0) slugs.add(cleanDomain.split('.')[0]);
  return slugs;
}

// ==================== INTERFACES ====================

export interface ToolsData {
  crawlers: any;
  geo: any;
  llm: any;
  pagespeed: any;
}

export interface EEATSignals {
  hasAuthorBio: boolean;
  authorBioCount: number;
  hasSocialLinks: boolean;
  hasLinkedInLinks: boolean;
  socialLinksCount: number;
  linkedInLinksCount: number;
  linkedInUrls: string[];
  hasSameAs: boolean;
  hasWikidataSameAs: boolean;
  hasAuthorInJsonLd: boolean;
  hasProfilePage: boolean;
  hasPerson: boolean;
  hasOrganization: boolean;
  hasCaseStudies: boolean;
  caseStudySignals: number;
  hasExpertCitations: boolean;
  detectedSocialUrls: string[];
}

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  is_ranked: boolean;
  current_rank: number | string;
  is_nugget?: boolean;
}

export interface MarketData {
  location_used: string;
  total_market_volume: number;
  top_keywords: KeywordData[];
  data_source: 'dataforseo' | 'fallback';
  fetch_timestamp: string;
}

export interface RankingOverview {
  total_ranked_keywords: number;
  average_position_global: number;
  average_position_top10: number;
  distribution: {
    top3: number;
    top10: number;
    top20: number;
    top50: number;
    top100: number;
    beyond100: number;
  };
  top_keywords: { keyword: string; position: number; volume: number; url: string }[];
  etv: number;
}

export interface BusinessContext {
  sector: string;
  location: string;
  brandName: string;
  locationCode: number | null;
  languageCode: string;
  seDomain: string;
}

export interface BrandSignal {
  source: string;
  value: string;
  weight: number;
}

export interface CtaSeoSignals {
  ctaCount: number;
  ctaTypes: string[];
  ctaAggressive: boolean;
  seoTermsInBalises: string[];
  jargonTermsInBalises: string[];
  toneExplanatory: boolean;
}

export interface FacebookPageInfo {
  pageUrl: string | null;
  pageName: string | null;
  found: boolean;
}

export interface FounderInfo {
  name: string | null;
  profileUrl: string | null;
  platform: string | null;
  isInfluencer: boolean;
  geoMismatch: boolean;
  detectedCountry: string | null;
}

export interface GMBData {
  title?: string;
  rating?: number;
  reviews_count?: number;
  category?: string;
  address?: string;
  is_claimed?: boolean;
  quick_wins?: string[];
}

// Well-known location codes
export const KNOWN_LOCATIONS: Record<string, { code: number; name: string; lang: string; seDomain: string }> = {
  'france': { code: 2250, name: 'France', lang: 'fr', seDomain: 'google.fr' },
  'belgium': { code: 2056, name: 'Belgium', lang: 'fr', seDomain: 'google.be' },
  'switzerland': { code: 2756, name: 'Switzerland', lang: 'fr', seDomain: 'google.ch' },
  'canada': { code: 2124, name: 'Canada', lang: 'fr', seDomain: 'google.ca' },
  'luxembourg': { code: 2442, name: 'Luxembourg', lang: 'fr', seDomain: 'google.lu' },
  'germany': { code: 2276, name: 'Germany', lang: 'de', seDomain: 'google.de' },
  'spain': { code: 2724, name: 'Spain', lang: 'es', seDomain: 'google.es' },
  'italy': { code: 2380, name: 'Italy', lang: 'it', seDomain: 'google.it' },
  'united kingdom': { code: 2826, name: 'United Kingdom', lang: 'en', seDomain: 'google.co.uk' },
  'united states': { code: 2840, name: 'United States', lang: 'en', seDomain: 'google.com' },
};

// ==================== BRAND DETECTION ====================

/**
 * Probabilistic algorithm to detect the real brand/company name from 5 HTML signals + domain.
 */
export function resolveBrandName(signals: BrandSignal[], domain: string, url: string): { name: string; confidence: number } {
  if (signals.length === 0) return { name: url, confidence: 0 };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9]/g, '').trim();
  const domainSlug = normalize(domain.replace(/^www\./, '').split('.')[0]);

  const groups = new Map<string, { totalWeight: number; bestValue: string; sources: string[] }>();
  for (const sig of signals) {
    const rawVal = sig.value.trim();
    if (rawVal.length > 40) {
      console.log(`⏭️ Brand detection: skipping too-long signal "${rawVal.substring(0, 50)}..." from ${sig.source}`);
      continue;
    }
    const norm = normalize(rawVal);
    if (!norm || norm.length < 2) continue;
    const existing = groups.get(norm);
    if (existing) {
      existing.totalWeight += sig.weight;
      existing.sources.push(sig.source);
      if (sig.value.length >= existing.bestValue.length) existing.bestValue = sig.value;
    } else {
      groups.set(norm, { totalWeight: sig.weight, bestValue: sig.value, sources: [sig.source] });
    }
  }

  if (groups.size === 0) return { name: url, confidence: 0 };

  const groupKeys = [...groups.keys()];
  for (let i = 0; i < groupKeys.length; i++) {
    for (let j = i + 1; j < groupKeys.length; j++) {
      const a = groupKeys[i], b = groupKeys[j];
      if (a.includes(b) || b.includes(a)) {
        const shorter = a.length <= b.length ? a : b;
        const longer = shorter === a ? b : a;
        const merged = groups.get(shorter)!;
        const other = groups.get(longer)!;
        merged.totalWeight += other.totalWeight;
        merged.sources.push(...other.sources);
        groups.delete(longer);
      }
    }
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  let best = { norm: '', totalWeight: 0, bestValue: '', sources: [] as string[] };
  for (const [norm, g] of groups) {
    if (g.totalWeight > best.totalWeight) {
      best = { norm, ...g };
    }
  }

  let confidence = best.totalWeight / totalWeight;
  if (best.sources.length >= 3) confidence = Math.min(1, confidence + 0.15);
  else if (best.sources.length >= 2) confidence = Math.min(1, confidence + 0.08);
  if (normalize(best.bestValue) === domainSlug) confidence = Math.min(1, confidence + 0.05);

  let finalName = best.bestValue.trim();
  if (finalName === finalName.toLowerCase() && finalName.length > 1) {
    finalName = finalName.replace(/\b\w/g, c => c.toUpperCase());
  }

  console.log(`🎯 Brand detection: "${finalName}" (confidence: ${(confidence * 100).toFixed(1)}%, sources: ${best.sources.join(',')})`);

  if (confidence >= 0.95) {
    return { name: finalName, confidence };
  }
  return { name: url, confidence };
}

export function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 1) return slug;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function sanitizeBrandNameInResponse(obj: any, domainSlug: string, humanName: string): any {
  if (!obj || !domainSlug || !humanName || domainSlug === humanName) return obj;
  const slugLower = domainSlug.toLowerCase();
  function replaceInString(str: string): string {
    if (!str || typeof str !== 'string') return str;
    const regex = new RegExp(slugLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return str.replace(regex, humanName);
  }
  function walk(node: any): any {
    if (typeof node === 'string') return replaceInString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) { out[k] = walk(v); }
      return out;
    }
    return node;
  }
  return walk(obj);
}

/** Extracts the REAL core business description from page metadata. */
export function extractCoreBusiness(pageContentContext: string): string {
  if (!pageContentContext) return '';
  const texts = extractMetadataTexts(pageContentContext);
  if (texts.length === 0) return '';
  const bigrams: string[] = [];
  const allWords: string[] = [];
  for (const text of texts) {
    const words = cleanAndTokenize(text);
    allWords.push(...words);
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  const uniqueWords = [...new Set(allWords)];
  const coreBusiness = uniqueWords.slice(0, 8).join(' ');
  console.log(`🎯 Core business: "${coreBusiness}"`);
  return coreBusiness;
}

/** Détecte le contexte business ET le location code. */
export function detectBusinessContext(domain: string, pageContentContext: string = ''): BusinessContext {
  const domainParts = domain.toLowerCase().split('.');
  const tld = domainParts[domainParts.length - 1];
  const tldToLocation: Record<string, string> = {
    'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada',
    'lu': 'luxembourg', 'de': 'germany', 'es': 'spain', 'it': 'italy',
    'uk': 'united kingdom', 'co.uk': 'united kingdom', 'com': 'france',
    'ai': 'france', 'io': 'france', 'dev': 'france', 'app': 'france',
  };
  const locationKey = tldToLocation[tld] || 'france';
  const locationInfo = KNOWN_LOCATIONS[locationKey] || KNOWN_LOCATIONS['france'];
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const significantParts = domainParts.filter(part =>
    !prefixes.includes(part) && part.length > 2 &&
    !['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk', 'ai', 'dev', 'app'].includes(part)
  );
  const rawSlug = significantParts.length > 0 ? significantParts[0] : domainParts[0];
  const brandName = humanizeBrandName(rawSlug);
  const coreBusiness = extractCoreBusiness(pageContentContext);
  const sector = coreBusiness || rawSlug.replace(/-/g, ' ');
  console.log(`📋 Contexte: marque="${brandName}", secteur="${sector}", location="${locationInfo.name}" (code: ${locationInfo.code}, lang: ${locationInfo.lang})`);
  return { sector, location: locationInfo.name, brandName, locationCode: locationInfo.code, languageCode: locationInfo.lang, seDomain: locationInfo.seDomain };
}

/** Default empty E-E-A-T signals */
export function defaultEEATSignals(): EEATSignals {
  return {
    hasAuthorBio: false, authorBioCount: 0, hasSocialLinks: false, hasLinkedInLinks: false,
    socialLinksCount: 0, linkedInLinksCount: 0, linkedInUrls: [],
    hasSameAs: false, hasWikidataSameAs: false, hasAuthorInJsonLd: false, hasProfilePage: false,
    hasPerson: false, hasOrganization: false, hasCaseStudies: false, caseStudySignals: 0,
    hasExpertCitations: false, detectedSocialUrls: [],
  };
}

/** Default empty CtaSeoSignals */
export function defaultCtaSeoSignals(): CtaSeoSignals {
  return { ctaCount: 0, ctaTypes: [], ctaAggressive: false, seoTermsInBalises: [], jargonTermsInBalises: [], toneExplanatory: false };
}

/** Default empty FounderInfo */
export function defaultFounderInfo(): FounderInfo {
  return { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };
}

/** Default empty FacebookPageInfo */
export function defaultFacebookPageInfo(): FacebookPageInfo {
  return { pageUrl: null, pageName: null, found: false };
}
