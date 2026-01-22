export interface LLMProvider {
  id: string;
  name: string;
  company: string;
  icon?: string;
}

export interface LLMCitation {
  provider: LLMProvider;
  cited: boolean;
  iterationDepth: number; // 1 = immediate, higher = more prompts needed
  sentiment: 'positive' | 'neutral' | 'negative';
  recommends: boolean;
  coreValueMatch: boolean;
  summary: string;
  hallucinations?: string[];
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
  overallSentiment: 'positive' | 'neutral' | 'negative';
  overallRecommendation: boolean;
  coreValueSummary: string;
  citations: LLMCitation[];
}
