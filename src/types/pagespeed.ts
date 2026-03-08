export interface PageSpeedScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: string;
  lcp: string;
  cls: string;
  tbt: string;
  speedIndex: string;
  tti: string;
}

export interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  scores: PageSpeedScores;
  dataSource?: 'field' | 'lab';
  scannedAt: string;
}
