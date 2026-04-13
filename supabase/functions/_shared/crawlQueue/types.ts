/**
 * Shared types for the crawl queue system.
 */

export interface PageAnalysis {
  url: string;
  path: string;
  http_status: number;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  h2_count: number;
  h3_count: number;
  h4_h6_count: number;
  has_schema_org: boolean;
  has_canonical: boolean;
  canonical_url: string | null;
  has_hreflang: boolean;
  has_og: boolean;
  has_noindex: boolean;
  has_nofollow: boolean;
  word_count: number;
  images_total: number;
  images_without_alt: number;
  internal_links: number;
  external_links: number;
  broken_links: string[];
  anchor_texts: AnchorText[];
  response_time_ms: number | null;
  redirect_url: string | null;
  seo_score: number;
  issues: string[];
  content_hash: string | null;
  schema_org_types: string[];
  schema_org_errors: string[];
  custom_extraction: Record<string, string>;
  crawl_depth: number;
  html_size_bytes: number;
  body_text_truncated: string | null;
}

export interface AnchorText {
  href: string;
  text: string;
  type: 'internal' | 'external';
}

export interface CustomSelector {
  name: string;
  selector: string;
  type: 'css' | 'xpath';
}
