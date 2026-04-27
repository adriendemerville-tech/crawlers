import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart as LineChartIcon, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { GA4Toolbar } from './GA4Toolbar';
import { GA4KpiCards } from './GA4KpiCards';
import { GA4MainChart } from './GA4MainChart';
import { GA4PageMultiSelect } from './GA4PageMultiSelect';
import { GA4TrafficSources } from './GA4TrafficSources';
import { GA4TopPagesTable } from './GA4TopPagesTable';
import { useGA4Api, resolvePreset } from './useGA4Api';
import type {
  Granularity,
  TimeRangePreset,
  TrackedSiteOption,
  GA4TimeseriesResponse,
  GA4Source,
  GA4PageRow,
  GA4Anomaly,
  GA4PageGroup,
} from './types';

interface Props {
  externalDomain?: string | null;
}

export function GA4Explorer({ externalDomain }: Props) {
  const { user } = useAuth();
  const api = useGA4Api();

  // ── State ────────────────────────────────────────────────────
  const [sites, setSites] = useState<TrackedSiteOption[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [groups, setGroups] = useState<GA4PageGroup[]>([]);
  const [pages, setPages] = useState<GA4PageRow[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [preset, setPreset] = useState<TimeRangePreset>('28d');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [channelGroup, setChannelGroup] = useState<string>('all');
  const [compare, setCompare] = useState(false);

  const [timeseries, setTimeseries] = useState<GA4TimeseriesResponse | null>(null);
  const [sources, setSources] = useState<GA4Source[]>([]);
  const [anomalies, setAnomalies] = useState<GA4Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Resolve dates ────────────────────────────────────────────
  const dates = useMemo(() => {
    if (preset === 'custom') {
      const today = new Date();
      const start = (customStart || new Date(today.getTime() - 28 * 86400000)).toISOString().split('T')[0];
      const end = (customEnd || today).toISOString().split('T')[0];
      return { start, end };
    }
    return resolvePreset(preset);
  }, [preset, customStart, customEnd]);

  // ── Load tracked sites ───────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain, site_name')
        .eq('user_id', user.id)
        .order('site_name', { ascending: true });
      const list = (data || []) as TrackedSiteOption[];
      setSites(list);
      if (list.length > 0 && !siteId) {
        // Prefer site matching externalDomain
        const match = externalDomain
          ? list.find((s) => s.domain.replace(/^www\./, '') === externalDomain.replace(/^www\./, ''))
          : null;
        setSiteId(match?.id || list[0].id);
      }
    })();
  }, [user?.id, externalDomain, siteId]);

  // ── Load groups when site changes ────────────────────────────
  useEffect(() => {
    if (!siteId || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('ga4_page_groups')
        .select('*')
        .eq('user_id', user.id)
        .eq('tracked_site_id', siteId);
      setGroups((data || []) as GA4PageGroup[]);
    })();
    setSelectedPaths([]);
  }, [siteId, user?.id]);

  // ── Main fetch ───────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      const [tsRes, pgRes, anomRes] = await Promise.all([
        api.fetchTimeseries({
          trackedSiteId: siteId,
          startDate: dates.start,
          endDate: dates.end,
          granularity,
          pagePaths: selectedPaths,
          channelGroup: channelGroup === 'all' ? undefined : channelGroup,
          compare,
        }),
        api.listPages({ trackedSiteId: siteId, startDate: dates.start, endDate: dates.end }),
        api.detectAnomalies({ trackedSiteId: siteId, startDate: dates.start, endDate: dates.end }),
      ]);
      setTimeseries(tsRes);
      setPages(pgRes.pages || []);
      setAnomalies(anomRes.anomalies || []);

      // Sources require a property — best-effort
      try {
        const srcRes = await api.fetchSources({
          trackedSiteId: siteId,
          startDate: dates.start,
          endDate: dates.end,
          pagePaths: selectedPaths,
          domain: sites.find((s) => s.id === siteId)?.domain,
        });
        setSources(srcRes.sources || []);
      } catch {
        setSources([]);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement des données GA4');
      toast.error('Erreur GA4', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [siteId, dates.start, dates.end, granularity, selectedPaths, channelGroup, compare, api, sites]);

  // Auto-fetch when key params change
  useEffect(() => {
    if (siteId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, dates.start, dates.end, granularity, selectedPaths.join(','), channelGroup, compare]);

  // ── Derived ──────────────────────────────────────────────────
  const avgEngagementTime = useMemo(() => {
    const series = timeseries?.series || [];
    if (series.length === 0) return 0;
    const total = series.reduce((s, p) => s + (p.avg_engagement_time || 0), 0);
    return total / series.length;
  }, [timeseries]);

  const avgEngagementRate = useMemo(() => {
    const series = timeseries?.series || [];
    if (series.length === 0) return 0;
    const total = series.reduce((s, p) => s + (p.engagement_rate || 0), 0);
    return total / series.length;
  }, [timeseries]);

  const addPathToSelection = (path: string) => {
    if (!selectedPaths.includes(path)) setSelectedPaths([...selectedPaths, path]);
  };

  // ── Render ───────────────────────────────────────────────────
  if (sites.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LineChartIcon className="h-4 w-4" />
          Aucun site tracké. Ajoutez-en un dans Mes Sites pour utiliser l'explorateur GA4.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <GA4Toolbar
        sites={sites}
        siteId={siteId}
        onSiteChange={setSiteId}
        preset={preset}
        onPresetChange={setPreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomChange={(s, e) => {
          setCustomStart(s);
          setCustomEnd(e);
        }}
        granularity={granularity}
        onGranularityChange={setGranularity}
        channelGroup={channelGroup}
        onChannelGroupChange={setChannelGroup}
        compare={compare}
        onCompareChange={setCompare}
        onRefresh={refresh}
        loading={loading}
      />

      {user && (
        <GA4PageMultiSelect
          trackedSiteId={siteId}
          userId={user.id}
          pages={pages}
          selected={selectedPaths}
          onChange={setSelectedPaths}
          groups={groups}
          onGroupsChange={setGroups}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <GA4KpiCards
        totals={timeseries?.totals}
        compareTotals={timeseries?.compare_totals}
        avgEngagementTime={avgEngagementTime}
        avgEngagementRate={avgEngagementRate}
        loading={loading && !timeseries}
      />

      <GA4MainChart
        series={timeseries?.series || []}
        byPage={timeseries?.by_page}
        compareSeries={timeseries?.compare_series}
        anomalies={anomalies}
        loading={loading && !timeseries}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <GA4TrafficSources sources={sources} loading={loading && sources.length === 0} />
        <GA4TopPagesTable pages={pages} loading={loading && pages.length === 0} onAddToSelection={addPathToSelection} />
      </div>
    </div>
  );
}
