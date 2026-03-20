export interface ExpertAuditScores {
  performance: {
    score: number;
    maxScore: 40;
    psiPerformance: number;
    lcp: number;
    fcp: number;
    cls: number;
    tbt: number;
  };
  technical: {
    score: number;
    maxScore: 50;
    psiSeo: number;
    httpStatus: number;
    isHttps: boolean;
    brokenLinksCount?: number;
    brokenLinksChecked?: number;
  };
  semantic: {
    score: number;
    maxScore: 60;
    hasTitle: boolean;
    titleLength: number;
    hasMetaDesc: boolean;
    metaDescLength: number;
    hasUniqueH1: boolean;
    h1Count: number;
    wordCount: number;
  };
  aiReady: {
    score: number;
    maxScore: 30;
    hasSchemaOrg: boolean;
    schemaTypes: string[];
    isSchemaJsGenerated?: boolean;
    hasRobotsTxt: boolean;
    robotsPermissive: boolean;
    allowsAIBots?: {
      gptBot: boolean;
      claudeBot: boolean;
      perplexityBot: boolean;
      googleExtended?: boolean;
      appleBotExtended?: boolean;
      ccBot?: boolean;
    };
  };
  security: {
    score: number;
    maxScore: 20;
    isHttps: boolean;
    safeBrowsingOk: boolean;
    threats: string[];
  };
}

export interface Recommendation {
  id: string;
  priority: 'critical' | 'important' | 'optional';
  category: 'performance' | 'technique' | 'contenu' | 'ia' | 'securite';
  icon: string;
  title: string;
  description: string;
  strengths?: string[];
  weaknesses?: string[];
  fixes?: string[];
  completed?: boolean;
}

export interface StrategicIntroduction {
  presentation: string;
  strengths: string;
  improvement: string;
  competitors?: string[];
}

// Expert Insights from smart analysis
export interface SemanticConsistency {
  titleH1Similarity: number;
  verdict: 'redundant' | 'optimal' | 'acceptable' | 'inconsistent' | 'missing' | 'unknown';
  details: string;
}

export interface ContentDensity {
  ratio: number;
  verdict: 'critical' | 'warning' | 'acceptable' | 'optimal' | 'unknown';
  htmlSize: number;
  textSize: number;
}

export interface LinkProfile {
  internal: number;
  external: number;
  total: number;
  toxicAnchors: string[];
  toxicAnchorsCount: number;
}

export interface BrokenLink {
  url: string;
  status: number;
  anchor: string;
  type: 'internal' | 'external';
}

export interface BrokenLinksAnalysis {
  total: number;
  broken: BrokenLink[];
  checked: number;
  corsBlocked: number;
  verdict: 'optimal' | 'warning' | 'critical';
}

export interface JsonLdValidation {
  valid: boolean;
  types: string[];
  parseErrors: string[];
  count: number;
  isJsGenerated?: boolean;
}

export interface ExpertInsights {
  semanticConsistency: SemanticConsistency;
  contentDensity: ContentDensity;
  linkProfile: LinkProfile;
  jsonLdValidation: JsonLdValidation;
  brokenLinks?: BrokenLinksAnalysis;
  internalLinking?: {
    internalLinksCount: number;
    externalLinksCount: number;
    totalLinksCount: number;
    internalLinkRatio: number;
    uniqueInternalPaths: number;
    orphanRisk: boolean;
  };
}

export interface AuditMeta {
  scannedAt: string;
  renderingMode: 'static_fast' | 'dynamic_rendered';
  reliabilityScore: number;
  blockingError?: string;
}

// ============= PREMIUM STRATEGIC AUDIT TYPES 2026 =============

export interface BrandIdentity {
  archetype: string;
  clarity_score: number;
  perceived_values: string[];
  tone_analysis: string;
}

export interface MarketPositioning {
  target_audience: string;
  price_perception: 'Low-cost' | 'Mid-market' | 'Premium';
  detected_usp: string;
}

export interface GeoScore {
  score: number;
  analysis: string;
}

// NEW: Competitive Landscape with 4 actors
export interface CompetitorActor {
  name: string;
  url?: string;
  authority_factor: string;
  analysis: string;
}

export interface CompetitiveLandscape {
  leader: CompetitorActor;
  direct_competitor: CompetitorActor;
  challenger: CompetitorActor;
  inspiration_source: CompetitorActor;
}

// NEW: Social & Human Authority (Off-Site Signals)
export interface SocialProofSource {
  platform: 'reddit' | 'x' | 'linkedin' | 'youtube' | 'instagram' | 'other';
  presence_level: 'strong' | 'moderate' | 'weak' | 'absent';
  analysis: string;
  profile_url?: string;
  profile_name?: string;
}

export interface ThoughtLeadership {
  founder_authority: 'high' | 'moderate' | 'low' | 'unknown';
  entity_recognition: string;
  eeat_score: number; // 0-10
  analysis: string;
}

export interface SentimentAnalysis {
  overall_polarity: 'positive' | 'mostly_positive' | 'neutral' | 'mixed' | 'negative';
  hallucination_risk: 'low' | 'medium' | 'high';
  reputation_vibration: string;
}

export interface SocialSignals {
  proof_sources: SocialProofSource[];
  thought_leadership: ThoughtLeadership;
  sentiment: SentimentAnalysis;
  founder_geo_mismatch?: boolean;
  founder_geo_country?: string;
}

// NEW: Market Intelligence
export interface MarketSophistication {
  level: 1 | 2 | 3 | 4 | 5;
  description: string;
  emotional_levers: string[];
}

export interface SemanticGapMatrix {
  current_position: number; // 0-100
  leader_position: number; // 0-100
  gap_distance: number;
  priority_themes: string[];
  closing_strategy: string;
}

export interface MarketIntelligence {
  sophistication: MarketSophistication;
  semantic_gap: SemanticGapMatrix;
  positioning_verdict: string;
}

// NEW: Premium Executive Roadmap Item
export interface PremiumRoadmapItem {
  title: string;
  prescriptive_action: string; // 4-5 sentences paragraph
  strategic_rationale: string;
  expected_roi: 'High' | 'Medium' | 'Low';
  category: 'Identité' | 'Contenu' | 'Autorité' | 'Social' | 'Technique';
  priority: 'Prioritaire' | 'Important' | 'Opportunité';
}

// Legacy types (backward compatibility)
export interface StrategicRoadmapItem {
  category: 'Identité' | 'Contenu' | 'Autorité';
  priority: 'Prioritaire' | 'Important' | 'Opportunité';
  action_concrete: string;
  strategic_goal: string;
}

export interface LLMVisibility {
  entityAuthority: 'high' | 'moderate' | 'low';
  ecosystemPresence: {
    wikidata: boolean;
    press: boolean;
    reddit: boolean;
    other: string[];
  };
  recommendations: string[];
}

export interface TestQuery {
  query: string;
  purpose: string;
  targetLLMs: string[];
}

// Legacy GEO Analysis (for backward compatibility)
export interface GeoAnalysis {
  citabilityIndex: number;
  hasFactualData: boolean;
  hasComparativeTables: boolean;
  hasExpertCitations: boolean;
  contextualStrategy: string;
  recommendations: string[];
}

// Legacy Brand Perception (for backward compatibility)
export interface BrandPerception {
  semanticUniverse: string;
  targetAudience: 'B2B' | 'B2C' | 'Both';
  marketPosition: 'entry-level' | 'mid-range' | 'premium';
  valueProposition: string;
}

// NEW: Brand Authority Analysis
export interface BrandAuthority {
  dna_analysis: string;
  thought_leadership_score: number; // 0-100
  entity_strength: 'dominant' | 'established' | 'emerging' | 'unknown';
}

// NEW: GEO Readiness 2026
// NEW: Keyword Positioning (DataForSEO based)
export interface KeywordStrategicAnalysis {
  intent: string;
  business_value: 'High' | 'Medium' | 'Low';
  pain_point: string;
  recommended_action: string;
}

export interface KeywordItem {
  keyword: string;
  volume: number;
  difficulty: number;
  current_rank: number | string;
  strategic_analysis?: KeywordStrategicAnalysis;
  is_nugget?: boolean;
}

export interface QuickWinKeyword {
  keyword: string;
  current_rank: number;
  volume: number;
  action: string;
}

export interface ContentGap {
  keyword: string;
  volume: number;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

export interface MissingTerm {
  term: string;
  importance: 'critical' | 'important' | 'optional';
  competitor_usage: string;
  suggested_placement: string;
}

export interface SemanticDensityAnalysis {
  score: number; // 0-100
  verdict: 'optimal' | 'acceptable' | 'thin' | 'critical';
  analysis: string;
  vs_competitors: string;
  top_missing_clusters: string[];
}

export interface SerpRecommendation {
  action: string;
  expected_impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  timeframe: string;
}

export interface AlternativeStrategy {
  trigger_reason: string;
  strategy_type: 'RP' | 'partnership' | 'video_social' | 'event' | 'other';
  what: string;
  how: string;
  estimated_cost: string;
  ideal_partner?: string;
  offsite_seo_impact: string;
}

export interface KeywordPositioning {
  main_keywords: KeywordItem[];
  quick_wins: QuickWinKeyword[];
  content_gaps: ContentGap[];
  opportunities: string[];
  competitive_gaps: string[];
  recommendations: string[];
  missing_terms?: MissingTerm[];
  semantic_density?: SemanticDensityAnalysis;
  serp_recommendations?: SerpRecommendation[];
  alternative_strategy?: AlternativeStrategy | null;
}

export interface MarketDataSummary {
  total_market_volume: number;
  keywords_ranked: number;
  keywords_analyzed: number;
  average_position: number;
  data_source: 'dataforseo' | 'fallback';
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
  indexed_pages?: number | null;
}

export interface ContentFreshness {
  has_recent_content: boolean;
  last_update_days: number;
  verdict: string;
  recommendation: string;
}

export interface JsDependency {
  is_js_dependent: boolean;
  static_readability_score: number;
  verdict: string;
}

export interface StructuredDataDepth {
  complexity_score: number;
  nesting_depth: number;
  uses_graph: boolean;
  verdict: string;
}

export interface AIFavoredFormats {
  has_tldr: boolean;
  has_tables: boolean;
  has_lists: boolean;
  has_faq: boolean;
  format_score: number;
  missing_formats: string[];
  verdict: string;
}

export interface GeoReadiness {
  citability_score: number; // 0-100
  semantic_gap_analysis: SemanticGapMatrix;
  ai_accessibility_score: number; // 0-100
  performance_impact: string;
  semantic_coherence: {
    title_h1_alignment: number; // 0-100
    verdict: string;
  };
  content_freshness?: ContentFreshness;
  js_dependency?: JsDependency;
  structured_data_depth?: StructuredDataDepth;
  ai_favored_formats?: AIFavoredFormats;
  eeat_signals?: {
    has_author_bios: boolean;
    has_expert_citations: boolean;
    data_density_score: number;
    has_case_studies: boolean;
    verdict: string;
  };
  knowledge_graph_readiness?: {
    has_social_links: boolean;
    has_linkedin_profiles: boolean;
    has_wikidata_sameas: boolean;
    entity_recognizability_score: number;
    verdict: string;
  };
}

// Hallucination correction data stored for reference
export interface HallucinationCorrections {
  sector?: string;
  country?: string;
  valueProposition?: string;
  targetAudience?: string;
  businessAge?: string;
  businessType?: string;
  mainProducts?: string;
}

// Google My Business data
export interface GoogleMyBusinessData {
  title?: string;
  rating?: number;
  reviews_count?: number;
  category?: string;
  address?: string;
  is_claimed?: boolean;
  quick_wins?: string[];
}

// UPDATED: Premium Strategic Analysis
export type AuditPageType = 'homepage' | 'editorial' | 'product' | 'deep';

export interface StrategicAnalysis {
  introduction?: StrategicIntroduction;
  
  // Page type detection (replaces simple isContentMode boolean)
  isContentMode?: boolean;
  pageType?: AuditPageType;
  
  // NEW PREMIUM FORMAT
  brand_authority?: BrandAuthority;
  social_signals?: SocialSignals;
  market_intelligence?: MarketIntelligence;
  competitive_landscape?: CompetitiveLandscape;
  geo_readiness?: GeoReadiness;
  executive_roadmap?: PremiumRoadmapItem[];
  
  // NEW: Keyword Positioning (DataForSEO based)
  keyword_positioning?: KeywordPositioning;
  market_data_summary?: MarketDataSummary;
  ranking_overview?: RankingOverview;
  
  // Legacy format (backward compatibility)
  brand_identity?: BrandIdentity;
  market_positioning?: MarketPositioning;
  geo_score?: GeoScore;
  strategic_roadmap?: StrategicRoadmapItem[];
  brandPerception?: BrandPerception;
  geoAnalysis?: GeoAnalysis;
  llmVisibility?: LLMVisibility;
  testQueries?: TestQuery[];
  executive_summary?: string;
  executiveSummary?: string;
  overallScore?: number;
  
  // Hallucination correction data (if user corrected)
  hallucinationCorrections?: HallucinationCorrections | null;
 
   // NEW: Raw LLM visibility data from check-llm
   llm_visibility_raw?: LLMVisibilityRaw | null;

  // NEW: 5 Strategic Metrics 2026
  quotability?: import('./newAuditMetrics').QuotabilityIndex;
  summary_resilience?: import('./newAuditMetrics').SummaryResilience;
  lexical_footprint?: import('./newAuditMetrics').LexicalFootprint;
  expertise_sentiment?: import('./newAuditMetrics').ExpertiseSentiment;
  red_team?: import('./newAuditMetrics').RedTeamAnalysis;

  // Google My Business
  google_my_business?: GoogleMyBusinessData | null;
}

 // Raw LLM visibility data from check-llm edge function
 export interface LLMVisibilityRaw {
   url: string;
   domain: string;
   scannedAt: string;
   overallScore: number;
   citationRate: {
     cited: number;
     total: number;
   };
   invisibleList: Array<{ id: string; name: string; company: string }>;
   averageIterationDepth: number;
   overallSentiment: 'positive' | 'mostly_positive' | 'neutral' | 'mixed' | 'negative';
   overallRecommendation: boolean;
   coreValueSummary: string;
   citations: Array<{
     provider: { id: string; name: string; company: string };
     cited: boolean;
     iterationDepth: number;
     sentiment: 'positive' | 'mostly_positive' | 'neutral' | 'mixed' | 'negative';
     recommends: boolean;
     coreValueMatch: boolean;
     summary: string;
     hallucinations?: string[];
   }>;
 }
 
// AI Bots Crawlers data from check-crawlers
export interface AIBotResult {
  name: string;
  userAgent: string;
  company: string;
  status: 'allowed' | 'blocked' | 'unknown';
  reason?: string;
  blockSource?: 'robots.txt' | 'meta-tag' | 'http-status';
  lineNumber?: number;
}

export interface CrawlersData {
  bots: AIBotResult[];
  allowsAIBots: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
    googleExtended: boolean;
    appleBotExtended: boolean;
    ccBot: boolean;
  };
  allowedCount: number;
  blockedCount: number;
}

export interface ExpertAuditResult {
  url: string;
  domain: string;
  scannedAt: string;
  totalScore: number;
  maxScore: 200;
  isSPA?: boolean;
  meta?: AuditMeta;
  scores: ExpertAuditScores;
  insights?: ExpertInsights;
  recommendations: Recommendation[];
  introduction?: StrategicIntroduction;
  rawData: {
    psi: any;
    safeBrowsing: any;
    htmlAnalysis: any;
    robotsAnalysis?: any;
    crawlersData?: CrawlersData;
  };
  strategicAnalysis?: StrategicAnalysis;
}
