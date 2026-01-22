export type BotStatus = 'allowed' | 'blocked' | 'unknown';

export interface BotResult {
  name: string;
  userAgent: string;
  company: string;
  status: BotStatus;
  reason?: string;
  blockSource?: 'robots.txt' | 'meta-tag' | 'http-status';
  lineNumber?: number;
}

export interface CrawlResult {
  url: string;
  httpStatus: number;
  robotsTxt: string | null;
  metaRobots: string | null;
  bots: BotResult[];
  scannedAt: string;
}

export const AI_BOTS = [
  { name: 'GPTBot', userAgent: 'GPTBot', company: 'OpenAI' },
  { name: 'CCBot', userAgent: 'CCBot', company: 'Common Crawl' },
  { name: 'Google-Extended', userAgent: 'Google-Extended', company: 'Google (Gemini)' },
  { name: 'ClaudeBot', userAgent: 'ClaudeBot', company: 'Anthropic' },
  { name: 'Applebot-Extended', userAgent: 'Applebot-Extended', company: 'Apple Intelligence' },
  { name: 'PerplexityBot', userAgent: 'PerplexityBot', company: 'Perplexity AI' },
] as const;
