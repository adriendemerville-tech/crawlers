export interface NewsSource {
  id: string;
  name: string;
  url: string;
  trustScore: number;
  lastCrawled: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  imageUrl: string;
  category: 'SEO' | 'LLM' | 'GEO';
  source: NewsSource;
  publishedAt: string;
  relevanceScore: number;
  keywords: string[];
}

export interface WhitelistState {
  sources: NewsSource[];
  lastUpdated: string;
}
