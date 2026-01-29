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
    hasRobotsTxt: boolean;
    robotsPermissive: boolean;
    allowsAIBots?: {
      gptBot: boolean;
      claudeBot: boolean;
      perplexityBot: boolean;
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
}

export interface ExpertInsights {
  semanticConsistency: SemanticConsistency;
  contentDensity: ContentDensity;
  linkProfile: LinkProfile;
  jsonLdValidation: JsonLdValidation;
  brokenLinks?: BrokenLinksAnalysis;
}

export interface AuditMeta {
  scannedAt: string;
  renderingMode: 'static_fast' | 'dynamic_rendered';
  reliabilityScore: number;
  blockingError?: string;
}

// ============= NEW STRATEGIC AUDIT TYPES =============

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

export interface StrategicAnalysis {
  introduction?: StrategicIntroduction;
  // New format
  brand_identity?: BrandIdentity;
  market_positioning?: MarketPositioning;
  geo_score?: GeoScore;
  strategic_roadmap?: StrategicRoadmapItem[];
  executive_summary?: string;
  // Legacy format (backward compatibility)
  brandPerception?: BrandPerception;
  geoAnalysis?: GeoAnalysis;
  llmVisibility?: LLMVisibility;
  testQueries?: TestQuery[];
  executiveSummary?: string;
  overallScore?: number;
}

export interface ExpertAuditResult {
  url: string;
  domain: string;
  scannedAt: string;
  totalScore: number;
  maxScore: 200;
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
  };
  strategicAnalysis?: StrategicAnalysis;
}
