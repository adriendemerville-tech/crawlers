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

export interface JargonTargetScore {
  distance: number; // 0-100
  qualifier: string; // Adapté | Accessible | Spécialisé | Très distant | Opaque
  terms_causing_distance: string[];
  confidence: number; // 0-1
}

export interface JargonIntentionality {
  score: number; // 0-1
  label: string; // Spécialisation assumée | Positionnement ambigu | Distance non maîtrisée
  components: {
    cta_aggressiveness: number;
    seo_pattern_alignment: number;
    tone_assertiveness: number;
    structural_consistency: number;
  };
}

export interface JargonDistance {
  primary: JargonTargetScore;
  secondary: JargonTargetScore;
  untapped: JargonTargetScore;
  intentionality: JargonIntentionality;
}

export interface LexicalFootprint {
  score?: number;
  jargonRatio: number;
  concreteRatio: number;
  jargon_distance?: JargonDistance;
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
