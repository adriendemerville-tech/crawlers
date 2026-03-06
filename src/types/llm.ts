export interface LLMProvider {
  id: string;
  name: string;
  company: string;
  icon?: string;
}

export type SentimentType = 'positive' | 'mostly_positive' | 'neutral' | 'mixed' | 'negative';

export interface LLMCitation {
  provider: LLMProvider;
  cited: boolean;
  iterationDepth: number; // 1 = immediate, higher = more prompts needed
  sentiment: SentimentType;
  recommends: boolean;
  coreValueMatch: boolean;
  summary: string;
  hallucinations?: string[];
  error?: boolean; // true when the model could not be queried
}

export interface LLMAnalysisResult {
  url: string;
  domain: string;
  scannedAt: string;
  overallScore: number; // 0-100
  citationRate: {
    cited: number;
    total: number;
  };
  invisibleList: LLMProvider[];
  averageIterationDepth: number;
  overallSentiment: SentimentType;
  overallRecommendation: boolean;
  coreValueSummary: string;
  citations: LLMCitation[];
}
