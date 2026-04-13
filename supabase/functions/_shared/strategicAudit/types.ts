/**
 * Shared types for the strategic audit pipeline.
 * Single source of truth for audit-strategique-ia, strategic-synthesis, strategic-orchestrator.
 */

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

export interface GMBData {
  title?: string;
  rating?: number;
  reviews_count?: number;
  category?: string;
  address?: string;
  is_claimed?: boolean;
  quick_wins?: string[];
  totalReviews?: number;
}

export interface FounderInfo {
  name: string | null;
  profileUrl: string | null;
  platform: string | null;
  isInfluencer: boolean;
  geoMismatch: boolean;
  detectedCountry: string | null;
}

export interface FacebookPageInfo {
  pageUrl: string | null;
  pageName: string | null;
  found: boolean;
}

export interface CtaSeoSignals {
  ctaCount: number;
  ctaTypes: string[];
  ctaAggressive: boolean;
  seoTermsInBalises: string[];
  jargonTermsInBalises: string[];
  toneExplanatory: boolean;
}

export type PageType = 'homepage' | 'editorial' | 'product' | 'deep';

export const DEFAULT_EEAT_SIGNALS: EEATSignals = {
  hasAuthorBio: false, authorBioCount: 0, hasSocialLinks: false, hasLinkedInLinks: false,
  socialLinksCount: 0, linkedInLinksCount: 0, linkedInUrls: [],
  hasSameAs: false, hasWikidataSameAs: false, hasAuthorInJsonLd: false, hasProfilePage: false,
  hasPerson: false, hasOrganization: false, hasCaseStudies: false, caseStudySignals: 0,
  hasExpertCitations: false, detectedSocialUrls: [],
};

export const DEFAULT_FOUNDER_INFO: FounderInfo = {
  name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null,
};

export const DEFAULT_FACEBOOK_PAGE_INFO: FacebookPageInfo = {
  pageUrl: null, pageName: null, found: false,
};

export const DEFAULT_CTA_SEO_SIGNALS: CtaSeoSignals = {
  ctaCount: 0, ctaTypes: [], ctaAggressive: false, seoTermsInBalises: [], jargonTermsInBalises: [], toneExplanatory: false,
};
