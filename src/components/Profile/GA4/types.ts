export type Granularity = 'day' | 'week' | 'month';

export type ChartMetric =
  | 'sessions'
  | 'users'
  | 'pageviews'
  | 'avg_engagement_time'
  | 'engagement_rate';

export interface GA4SeriesPoint {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  revenue?: number;
  avg_engagement_time?: number;
  engagement_rate?: number;
  conversions?: number;
}

export interface GA4Totals {
  sessions: number;
  users: number;
  pageviews: number;
  revenue: number;
}

export interface GA4TimeseriesResponse {
  success: boolean;
  granularity: Granularity;
  period: { start: string; end: string };
  series: GA4SeriesPoint[];
  by_page?: Record<string, GA4SeriesPoint[]>;
  compare_series?: GA4SeriesPoint[];
  totals: GA4Totals;
  compare_totals?: GA4Totals;
}

export interface GA4Anomaly {
  date: string;
  metric: 'sessions' | 'users' | 'pageviews';
  value: number;
  mean: number;
  z: number;
  direction: 'up' | 'down';
}

export interface GA4Source {
  channel: string;
  sessions: number;
  users: number;
}

export interface GA4PageRow {
  path: string;
  pageviews: number;
  sessions: number;
  conversions: number;
}

export interface GA4PageGroup {
  id: string;
  name: string;
  page_paths: string[];
  color: string | null;
  tracked_site_id: string;
}

export interface TrackedSiteOption {
  id: string;
  domain: string;
  site_name: string;
}

export type TimeRangePreset = '7d' | '28d' | '90d' | '6m' | '12m' | 'custom';
