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
  completed?: boolean;
}

export interface ExpertAuditResult {
  url: string;
  domain: string;
  scannedAt: string;
  totalScore: number;
  maxScore: 200;
  scores: ExpertAuditScores;
  recommendations: Recommendation[];
  rawData: {
    psi: any;
    safeBrowsing: any;
    htmlAnalysis: any;
  };
}
