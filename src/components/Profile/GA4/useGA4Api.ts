import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  GA4TimeseriesResponse,
  GA4Anomaly,
  GA4Source,
  GA4PageRow,
  Granularity,
} from './types';

interface FetchTimeseriesArgs {
  trackedSiteId: string;
  startDate: string;
  endDate: string;
  granularity: Granularity;
  pagePaths: string[];
  channelGroup?: string;
  compare?: boolean;
}

export function useGA4Api() {
  const invoke = useCallback(async <T = any>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke('fetch-ga4-data', { body });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) throw new Error((data as any).error);
    return data as T;
  }, []);

  const fetchTimeseries = useCallback(
    (args: FetchTimeseriesArgs): Promise<GA4TimeseriesResponse> =>
      invoke({
        action: 'fetch_timeseries',
        tracked_site_id: args.trackedSiteId,
        start_date: args.startDate,
        end_date: args.endDate,
        granularity: args.granularity,
        page_paths: args.pagePaths,
        channel_group: args.channelGroup,
        compare: args.compare,
      }),
    [invoke],
  );

  const fetchSources = useCallback(
    (args: { trackedSiteId: string; startDate: string; endDate: string; pagePaths: string[]; domain?: string; forceRefresh?: boolean; cacheTtlMinutes?: number }) =>
      invoke<{ success: boolean; sources: GA4Source[]; cached_from?: 'db' | 'live'; fetched_at?: string; expires_at?: string }>({
        action: 'fetch_traffic_sources',
        tracked_site_id: args.trackedSiteId,
        start_date: args.startDate,
        end_date: args.endDate,
        page_paths: args.pagePaths,
        domain: args.domain,
        force_refresh: args.forceRefresh ?? false,
        cache_ttl_minutes: args.cacheTtlMinutes ?? 360,
      }),
    [invoke],
  );

  const listPages = useCallback(
    (args: { trackedSiteId: string; startDate: string; endDate: string; limit?: number }) =>
      invoke<{ success: boolean; pages: GA4PageRow[] }>({
        action: 'list_pages',
        tracked_site_id: args.trackedSiteId,
        start_date: args.startDate,
        end_date: args.endDate,
        limit: args.limit ?? 500,
      }),
    [invoke],
  );

  const detectAnomalies = useCallback(
    (args: { trackedSiteId: string; startDate: string; endDate: string }) =>
      invoke<{ success: boolean; anomalies: GA4Anomaly[] }>({
        action: 'detect_anomalies',
        tracked_site_id: args.trackedSiteId,
        start_date: args.startDate,
        end_date: args.endDate,
      }),
    [invoke],
  );

  return { fetchTimeseries, fetchSources, listPages, detectAnomalies };
}

/** Resolve a preset to ISO date strings. */
export function resolvePreset(preset: string): { start: string; end: string } {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const map: Record<string, number> = { '7d': 7, '28d': 28, '90d': 90, '6m': 180, '12m': 365 };
  const days = map[preset] ?? 28;
  const start = new Date(today.getTime() - days * 86400000).toISOString().split('T')[0];
  return { start, end };
}
