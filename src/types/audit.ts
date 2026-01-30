export interface BrandPerception {
  semanticUniverse: string;
  targetAudience: 'B2B' | 'B2C' | 'Both';
  marketPosition: 'entry-level' | 'mid-range' | 'premium';
  valueProposition: string;
}

export interface VisualIdentityAudit {
  faviconDetection: {
    hasSvg: boolean;
    hasPng48: boolean;
    hasAppleTouchIcon: boolean;
    httpStatus: number;
    permanentUrl: boolean;
  };
  alignedWithPosition: boolean;
  recommendations: string[];
}

export interface SEOArchitectureAudit {
  isSSR: boolean;
  crawlBudgetOptimization: 'good' | 'moderate' | 'poor';
  semanticHierarchy: 'strong' | 'moderate' | 'weak';
  recommendations: string[];
}

export interface GEOAnalysisAudit {
  citabilityIndex: number; // 0-100
  hasFactualData: boolean;
  hasComparativeTables: boolean;
  hasExpertCitations: boolean;
  contextualStrategy: string;
  recommendations: string[];
}

export interface LLMVisibilityAudit {
  entityAuthority: 'high' | 'moderate' | 'low';
  ecosystemPresence: {
    wikidata: boolean;
    press: boolean;
    reddit: boolean;
    other: string[];
  };
  recommendations: string[];
}

export interface LLMTestQuery {
  query: string;
  purpose: string;
  targetLLMs: string[];
}

export interface KeywordPositioning {
  mainKeywords: string[];
  opportunities: string[];
  competitiveGaps: string[];
  recommendations: string[];
}

export interface StrategicAuditResult {
  url: string;
  domain: string;
  scannedAt: string;
  overallScore: number;
  
  // Étape 0: Perception de marque
  brandPerception: BrandPerception;
  
  // Étape 1: Identité visuelle
  visualIdentity: VisualIdentityAudit;
  
  // Étape 2: Architecture SEO
  seoArchitecture: SEOArchitectureAudit;
  
  // Étape 3: Analyse GEO
  geoAnalysis: GEOAnalysisAudit;
  
  // Étape 4: Visibilité LLM
  llmVisibility: LLMVisibilityAudit;
  
  // Étape 5: Positionnement mots clés
  keywordPositioning?: KeywordPositioning;
  
  // Étape 6: Requêtes de test
  testQueries: LLMTestQuery[];
  
  // Rapport narratif
  executiveSummary: string;
  
  // Données agrégées des 4 outils
  toolsData: {
    crawlers: any;
    geo: any;
    llm: any;
    pagespeed: any;
  };
}
