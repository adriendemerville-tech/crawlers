// ═══ NEW AUDIT METRICS TYPES (8 new data points) ═══

// === PART 1: TECHNICAL AUDIT (DOM parsing) ===

export interface DarkSocialReadiness {
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  score: number; // 0-100
}

export interface FreshnessSignals {
  score: number; // 0-100
  label: 'fresh' | 'acceptable' | 'stale';
  lastModifiedDate: string | null;
  hasCurrentYearMention: boolean;
  currentYearFound: string | null;
}

export interface ConversionFriction {
  formsCount: number;
  visibleInputs: number;
  avgFieldsPerForm: number;
  ctaCount: number;
  ctaAboveFold: boolean;
  frictionLevel: 'low' | 'optimal' | 'high';
}

// === PART 2: STRATEGIC AI AUDIT (LLM-dependent) ===

export interface QuotabilityIndex {
  score: number; // 0-100
  quotes: string[]; // up to 3 quotable sentences
}

export interface SummaryResilience {
  score: number; // 0-100
  originalH1: string;
  llmSummary: string;
}

export interface LexicalFootprint {
  score: number; // 0-100 (100 = highly specific/actionable)
  jargonRatio: number;
  concreteRatio: number;
}

export interface ExpertiseSentiment {
  rating: number; // 1-5
  justification: string;
}

export interface RedTeamAnalysis {
  flaws: string[]; // up to 3 flaws
}

export interface StrategicNewMetrics {
  quotability?: QuotabilityIndex;
  summary_resilience?: SummaryResilience;
  lexical_footprint?: LexicalFootprint;
  expertise_sentiment?: ExpertiseSentiment;
  red_team?: RedTeamAnalysis;
}
