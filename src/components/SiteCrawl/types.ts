export interface CrawlPage {
  id: string;
  url: string;
  path: string;
  http_status: number | null;
  title: string | null;
  h1: string | null;
  seo_score: number | null;
  word_count: number | null;
  images_without_alt: number | null;
  has_schema_org: boolean | null;
  has_canonical: boolean | null;
  has_og: boolean | null;
  has_noindex: boolean | null;
  has_nofollow: boolean | null;
  is_indexable: boolean | null;
  index_source: string | null;
  issues: string[];
  content_hash?: string | null;
  schema_org_types?: string[];
  schema_org_errors?: string[];
  custom_extraction?: Record<string, string>;
  crawl_depth?: number | null;
}

export interface CrawlResult {
  id: string;
  domain: string;
  url: string;
  status: string;
  total_pages: number;
  crawled_pages: number;
  avg_score: number | null;
  ai_summary: string | null;
  ai_recommendations: any[];
  created_at: string;
  completed_at: string | null;
  tone_consistency_score: number | null;
}

export interface CustomSelector {
  name: string;
  selector: string;
  type: 'css';
}

export interface ComparisonResult {
  newPages: string[];
  removedPages: string[];
  improved: { path: string; before: number; after: number }[];
  degraded: { path: string; before: number; after: number }[];
  scoreChange: number;
}

export function getCreditCost(pages: number) {
  if (pages <= 50) return 5;
  if (pages <= 100) return 10;
  if (pages <= 200) return 15;
  if (pages <= 350) return 25;
  return 40;
}

export function getScoreColor(score: number) {
  if (score >= 160) return 'text-emerald-500';
  if (score >= 120) return 'text-amber-500';
  return 'text-red-500';
}

export function getScoreBg(score: number) {
  if (score >= 160) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 120) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function generateSitemapXml(pages: CrawlPage[], domain: string): string {
  const urls = pages
    .filter(p => p.http_status === 200 && !(p.issues || []).includes('noindex'))
    .map(p => {
      const loc = p.url.startsWith('http') ? p.url : `https://${domain}${p.path}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <priority>${(p.seo_score || 0) >= 160 ? '1.0' : (p.seo_score || 0) >= 120 ? '0.8' : '0.5'}</priority>\n  </url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

export const CREDIT_PACKAGES = [
  { id: 'essential', name: 'Essentiel', credits: 10, price: 5, color: 'from-blue-500 to-cyan-500', border: 'border-blue-500/30' },
  { id: 'pro', name: 'Lite', credits: 50, price: 19, color: 'from-emerald-500 to-green-500', border: 'border-emerald-500/50', popular: true, savings: '24%' },
  { id: 'premium', name: 'Premium', credits: 150, price: 45, color: 'from-amber-500 to-orange-500', border: 'border-amber-500/30', savings: '40%' },
] as const;
