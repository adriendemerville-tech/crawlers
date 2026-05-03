import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { toast } from 'sonner';

export interface TrackedSite {
  id: string;
  domain: string;
  site_name: string;
  created_at: string;
  last_audit_at: string | null;
  last_widget_ping?: string | null;
  api_key?: string;
  current_config?: Record<string, unknown>;
  previous_config?: Record<string, unknown>;
  market_sector?: string | null;
  products_services?: string | null;
  target_audience?: string | null;
  address?: string | null;
  commercial_area?: string | null;
  company_size?: string | null;
  entity_type?: string | null;
  media_specialties?: string[] | null;
}

export interface StatsEntry {
  recorded_at: string;
  seo_score: number | null;
  geo_score: number | null;
  llm_citation_rate: number | null;
  ai_sentiment: string | null;
  semantic_authority: number | null;
  voice_share: number | null;
  raw_data?: Record<string, unknown> | null;
}

export interface GscDataRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscData {
  rows: GscDataRow[];
  total_clicks: number;
  total_impressions: number;
  avg_position: number;
  date_range: { start: string; end: string };
}

export type GscDateMode = 'since' | 'range';
export type GscGranularity = 'daily' | 'weekly' | 'monthly';

export function useMyTracking() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro, planType } = useCredits();
  const { isAdmin } = useAdmin();
  const { isDemoMode } = useDemoMode();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Core state ───
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, StatsEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [showApiPanel, setShowApiPanel] = useState(false);

  // ─── Add site modal ───
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    suggestion?: string;
    checked: boolean;
  }>({ valid: false, checked: false });

  // ─── Refresh state ───
  const [refreshingSites, setRefreshingSites] = useState<Set<string>>(new Set());
  const [refreshExhaustedSites, setRefreshExhaustedSites] = useState<Set<string>>(new Set());
  const [refreshingSerp, setRefreshingSerp] = useState(false);

  // ─── Architect modal ───
  const [architectSiteId, setArchitectSiteId] = useState<string | null>(null);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [architectAuditResult, setArchitectAuditResult] = useState<any>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // ─── WordPress connection ───
  const [wpConnectSiteId, setWpConnectSiteId] = useState<string | null>(null);
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpApiKeyVisible, setWpApiKeyVisible] = useState(false);
  const [wpApiKeyCopied, setWpApiKeyCopied] = useState(false);
  const [generatingMagicLink, setGeneratingMagicLink] = useState(false);

  // ─── Misc ───
  const [llmBenchmarkRefreshKey, setLlmBenchmarkRefreshKey] = useState(0);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [simulatedDataEnabled, setSimulatedDataEnabled] = useState(true);

  // ─── IKTracker ───
  const [ikTrackerConnected, setIkTrackerConnected] = useState<boolean | null>(null);
  const [ikTrackerToggling, setIkTrackerToggling] = useState(false);

  // ─── GSC ───
  const [gscConnecting, setGscConnecting] = useState(false);
  const [gscData, setGscData] = useState<GscData | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const gscHasToken = !!profile?.gsc_access_token;
  const [gscSiteVerified, setGscSiteVerified] = useState(false);
  const gscConnected = gscHasToken && gscSiteVerified;

  // ─── GA4 toggle ───
  const [ga4EnabledLocal, setGa4EnabledLocal] = useState(false);
  const [ga4TogglingLocal, setGa4TogglingLocal] = useState(false);

  // ─── GSC date/granularity ───
  const [gscDateMode, setGscDateMode] = useState<GscDateMode>('since');
  const [gscSinceDate, setGscSinceDate] = useState<Date>(() => new Date(2026, 0, 1));
  const [gscRangeStart, setGscRangeStart] = useState<Date>(() => new Date(2026, 0, 1));
  const [gscRangeEnd, setGscRangeEnd] = useState<Date>(() => new Date());
  const [gscGranularity, setGscGranularity] = useState<GscGranularity>('daily');
  const [gscTodayDate] = useState(() => new Date());

  const gscStartDate = gscDateMode === 'since' ? gscSinceDate : gscRangeStart;
  const gscEndDate = gscDateMode === 'since' ? gscTodayDate : gscRangeEnd;

  // ─── Derived ───
  const currentSite = sites.find(s => s.id === selectedSite);
  const currentSiteDomain = currentSite?.domain;
  const currentStats = selectedSite ? (statsMap[selectedSite] || []) : [];
  const latestStats = currentStats.length > 0 ? currentStats[currentStats.length - 1] : null;

  // ─── Data fetching ───
  const fetchSites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tracked_sites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setSites(data as TrackedSite[]);
      if (data.length > 0 && !selectedSite && !showApiPanel) {
        setSelectedSite(data[0].id);
      }
    }
    setLoading(false);
  }, [user, selectedSite]);

  const fetchStats = useCallback(async () => {
    if (!user || sites.length === 0) return;
    const siteIds = sites.map(s => s.id);
    const { data } = await supabase
      .from('user_stats_history')
      .select('*')
      .eq('user_id', user.id)
      .in('tracked_site_id', siteIds)
      .order('recorded_at', { ascending: true });
    if (data) {
      const map: Record<string, StatsEntry[]> = {};
      data.forEach((entry: Record<string, unknown>) => {
        const siteId = entry.tracked_site_id as string;
        if (!map[siteId]) map[siteId] = [];
        map[siteId].push(entry as unknown as StatsEntry);
      });
      setStatsMap(map);
    }
  }, [user, sites]);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Collaborator check ───
  useEffect(() => {
    if (!user) return;
    supabase
      .from('agency_team_members')
      .select('id')
      .eq('member_user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        setIsCollaborator(!!data && data.length > 0);
      });
  }, [user]);

  // ─── Admin config for simulated data ───
  useEffect(() => {
    const loadSimulatedFlag = async () => {
      const { data } = await supabase
        .from('admin_dashboard_config')
        .select('card_order')
        .limit(1)
        .maybeSingle();
      if (data?.card_order && typeof data.card_order === 'object' && !Array.isArray(data.card_order)) {
        const config = data.card_order as Record<string, unknown>;
        setSimulatedDataEnabled(config.simulated_data_enabled !== false);
      }
    };
    loadSimulatedFlag();
  }, []);

  // ─── IKTracker check ───
  const isIkTrackerSite = (domain: string) => domain.replace(/^www\./, '').includes('iktracker');

  useEffect(() => {
    if (!selectedSite || !user) return;
    const site = sites.find(s => s.id === selectedSite);
    if (!site || !isIkTrackerSite(site.domain)) {
      setIkTrackerConnected(null);
      return;
    }
    const config = site.current_config as Record<string, unknown> | null;
    if (config?.iktracker_disabled === true) {
      setIkTrackerConnected(false);
      return;
    }
    (async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/iktracker-actions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: 'test-connection' }),
        });
        const json = await res.json();
        setIkTrackerConnected(json?.result?.connected === true);
      } catch {
        setIkTrackerConnected(false);
      }
    })();
  }, [selectedSite, user, sites]);

  // ─── GA4 toggle ───
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'ga4_oauth_enabled')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object' && (data.value as Record<string, unknown>).active === true) {
        setGa4EnabledLocal(true);
      }
    })();
  }, []);

  const handleGa4ToggleLocal = async (checked: boolean) => {
    setGa4TogglingLocal(true);
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'ga4_oauth_enabled',
          value: { active: checked },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      if (error) throw error;
      setGa4EnabledLocal(checked);
      toast.success(checked
        ? (language === 'en' ? 'Google Analytics enabled' : language === 'es' ? 'Google Analytics activado' : 'Google Analytics activé')
        : (language === 'en' ? 'Google Analytics disabled' : language === 'es' ? 'Google Analytics desactivado' : 'Google Analytics désactivé')
      );
    } catch {
      toast.error(language === 'en' ? 'Save error' : language === 'es' ? 'Error al guardar' : 'Erreur de sauvegarde');
    } finally {
      setGa4TogglingLocal(false);
    }
  };

  // ─── GSC OAuth callback ───
  useEffect(() => {
    const gscConnectedParam = searchParams.get('gsc_connected');
    const gscError = searchParams.get('gsc_error');
    if (gscConnectedParam === 'true') {
      toast.success(language === 'fr' ? 'Search Console connecté !' : language === 'es' ? '¡Search Console conectado!' : 'Search Console connected!');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('gsc_connected');
      setSearchParams(newParams, { replace: true });
      window.location.reload();
    } else if (gscError) {
      toast.error(language === 'fr' ? 'Erreur de connexion Search Console' : language === 'es' ? 'Error de conexión Search Console' : 'Search Console connection error');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('gsc_error');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  // ─── GSC data fetch (race-condition safe) ───
  const gscFetchIdRef = useRef(0);

  const fetchGscData = useCallback(async () => {
    if (!user || !currentSiteDomain) return;
    const fetchId = ++gscFetchIdRef.current;
    setGscLoading(true);
    setGscSiteVerified(false);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-auth', {
        body: {
          action: 'fetch',
          user_id: user.id,
          site_url: `https://${currentSiteDomain}`,
          start_date: gscStartDate.toISOString().split('T')[0],
          end_date: gscEndDate.toISOString().split('T')[0],
        },
      });
      // Stale response guard: domain changed while fetching
      if (fetchId !== gscFetchIdRef.current) return;
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'GSC not connected') {
          setGscSiteVerified(false);
          return;
        }
        if (data.error?.includes?.('not found') || data.error?.includes?.('not verified') || data.error?.includes?.('Forbidden')) {
          setGscSiteVerified(false);
          setGscData(null);
          return;
        }
        throw new Error(data.error);
      }
      const hasRows = data?.rows?.length > 0 || data?.total_clicks > 0 || data?.total_impressions > 0;
      setGscSiteVerified(true);
      setGscData(hasRows ? data : null);
    } catch (err: unknown) {
      if (fetchId !== gscFetchIdRef.current) return;
      console.error('GSC fetch error:', err);
      setGscSiteVerified(false);
    } finally {
      if (fetchId === gscFetchIdRef.current) {
        setGscLoading(false);
      }
    }
  }, [user, currentSiteDomain, gscStartDate, gscEndDate]);

  // Clear GSC data immediately on domain switch, then re-fetch
  useEffect(() => {
    setGscData(null);
    setGscSiteVerified(false);
    if (gscHasToken && currentSiteDomain) {
      fetchGscData();
    } else {
      setGscLoading(false);
    }
  }, [gscHasToken, currentSiteDomain, fetchGscData]);

  // ─── GSC aggregation ───
  const gscAggregatedRows = useMemo(() => {
    if (!gscData?.rows?.length) return [];
    const rows = gscData.rows.map(r => ({
      date: r.keys?.[0] || '',
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    }));
    if (gscGranularity === 'daily') return rows;
    const buckets: Record<string, { clicks: number; impressions: number; posSum: number; count: number }> = {};
    for (const r of rows) {
      let key: string;
      if (gscGranularity === 'weekly') {
        const d = new Date(r.date);
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        key = monday.toISOString().split('T')[0];
      } else {
        key = r.date.slice(0, 7);
      }
      if (!buckets[key]) buckets[key] = { clicks: 0, impressions: 0, posSum: 0, count: 0 };
      buckets[key].clicks += r.clicks;
      buckets[key].impressions += r.impressions;
      buckets[key].posSum += r.position;
      buckets[key].count += 1;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        clicks: b.clicks,
        impressions: b.impressions,
        position: parseFloat((b.posSum / b.count).toFixed(1)),
      }));
  }, [gscData, gscGranularity]);

  // ─── GSC connect ───
  const handleConnectGsc = async () => {
    if (!user) return;
    setGscConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-auth', {
        body: { action: 'login', user_id: user.id, frontend_origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err: unknown) {
      console.error('GSC login error:', err);
      toast.error(language === 'fr' ? 'Erreur de connexion Search Console' : language === 'es' ? 'Error de conexión Search Console' : 'Search Console connection error');
    } finally {
      setGscConnecting(false);
    }
  };

  // ─── Rate limiting ───
  const getParis5amBoundary = useCallback(() => {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const parisHour = parisNow.getHours();
    const boundary = new Date(parisNow);
    boundary.setHours(5, 0, 0, 0);
    if (parisHour < 5) boundary.setDate(boundary.getDate() - 1);
    const offset = now.getTime() - parisNow.getTime();
    return new Date(boundary.getTime() + offset).toISOString();
  }, []);

  const checkRefreshExhausted = useCallback(async (siteId: string): Promise<boolean> => {
    if (isAdmin) return false;
    // Pro Agency+ users bypass daily refresh limits for LLM benchmark/depth
    if (planType === 'agency_premium') return false;
    const since = getParis5amBoundary();
    const { count } = await supabase
      .from('user_stats_history')
      .select('id', { count: 'exact', head: true })
      .eq('tracked_site_id', siteId)
      .gte('recorded_at', since);
    return (count ?? 0) >= 2;
  }, [isAdmin, planType, getParis5amBoundary]);

  const canRefreshSite = useCallback(async (siteId: string): Promise<boolean> => {
    const exhausted = await checkRefreshExhausted(siteId);
    if (exhausted) {
      setRefreshExhaustedSites(prev => new Set(prev).add(siteId));
      toast.error(
        language === 'fr'
          ? 'Limite atteinte : 2 actualisations par jour par site (reset à 5h).'
          : language === 'es'
            ? 'Límite alcanzado: 2 actualizaciones por día por sitio (reset a las 5h).'
            : 'Limit reached: 2 refreshes per day per site (resets at 5AM).'
      );
      return false;
    }
    return true;
  }, [language, checkRefreshExhausted]);

  // ─── Check exhaustion on load ───
  useEffect(() => {
    if (!sites.length) return;
    (async () => {
      const exhausted = new Set<string>();
      await Promise.all(sites.map(async (site) => {
        const isExhausted = await checkRefreshExhausted(site.id);
        if (isExhausted) exhausted.add(site.id);
      }));
      setRefreshExhaustedSites(exhausted);
    })();
  }, [sites, checkRefreshExhausted]);

  // ─── Background audit ───
  const runBackgroundAudit = async (site: TrackedSite) => {
    if (!user) return;
    setRefreshingSites(prev => new Set(prev).add(site.id));
    try {
      const url = `https://${site.domain}`;
      const [geoRes, llmRes, psiRes, crawlersRes, serpRes] = await Promise.allSettled([
        supabase.functions.invoke('check-geo', { body: { url, lang: language } }),
        supabase.functions.invoke('check-llm', { body: { url, lang: language } }),
        supabase.functions.invoke('check-pagespeed', { body: { url, lang: language, dual: true } }),
        supabase.functions.invoke('check-crawlers', { body: { url } }),
        supabase.functions.invoke('fetch-serp-kpis', { body: { domain: site.domain, url, site_context: { products_services: site.products_services, market_sector: site.market_sector, target_audience: site.target_audience, commercial_area: site.commercial_area } } }),
      ]);
      const geoData = geoRes.status === 'fulfilled' ? geoRes.value.data : null;
      const llmData = llmRes.status === 'fulfilled' ? llmRes.value.data : null;
      const psiData = psiRes.status === 'fulfilled' ? psiRes.value.data : null;
      const crawlersData = crawlersRes.status === 'fulfilled' ? crawlersRes.value.data : null;
      const serpData = serpRes.status === 'fulfilled' ? serpRes.value.data?.data : null;

      const geoScore = geoData?.data?.totalScore ?? geoData?.data?.overallScore ?? 0;
      const llmCitationRate = llmData?.data?.citationRate;
      const citationRate = llmCitationRate
        ? (llmCitationRate.cited / (llmCitationRate.total || 1)) * 100
        : 0;
      const sentiment = llmData?.data?.overallSentiment || 'neutral';
      const llmOverallScore = llmData?.data?.overallScore ?? null;
      const seoScore = psiData?.data?.mobile?.scores?.seo ?? psiData?.data?.scores?.seo ?? null;
      const performanceScore = psiData?.data?.mobile?.scores?.performance ?? psiData?.data?.scores?.performance ?? psiData?.data?.performance ?? null;
      const performanceDesktop = psiData?.data?.desktop?.scores?.performance ?? null;
      const semanticAuthority = serpData?.semantic_authority ?? null;

      await supabase.from('user_stats_history').insert({
        user_id: user.id,
        tracked_site_id: site.id,
        domain: site.domain,
        seo_score: seoScore,
        geo_score: Math.round(geoScore),
        llm_citation_rate: citationRate,
        ai_sentiment: sentiment,
        semantic_authority: semanticAuthority,
        voice_share: citationRate || null,
        raw_data: {
          geoData: geoData?.data,
          llmData: llmData?.data,
          psiData: psiData?.data,
          crawlersData: crawlersData?.data || crawlersData,
          performanceScore,
          performanceDesktop,
          llmOverallScore,
          serpData,
        },
      });
      await supabase
        .from('tracked_sites')
        .update({ last_audit_at: new Date().toISOString() })
        .eq('id', site.id);
      await fetchSites();
      await fetchStats();
    } catch (err) {
      console.error('Background audit error:', err);
    } finally {
      setRefreshingSites(prev => {
        const next = new Set(prev);
        next.delete(site.id);
        return next;
      });
    }
  };

  // ─── Auto-refresh stale sites ───
  useEffect(() => {
    if (!user || sites.length === 0) return;
    const sessionKey = `tracking_refreshed_${user.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000;
    const staleSites = sites.filter(site => {
      const lastAudit = site.last_audit_at ? new Date(site.last_audit_at).getTime() : 0;
      return now - lastAudit > staleThreshold && !refreshingSites.has(site.id);
    });
    if (staleSites.length > 0) {
      sessionStorage.setItem(sessionKey, Date.now().toString());
      staleSites.forEach(site => runBackgroundAudit(site));
    }
  }, [sites, user]);

  // ─── Streaming audit (manual refresh) ───
  const runStreamingAudit = async (site: TrackedSite) => {
    if (!user) return;
    if (!isAdmin) {
      const allowed = await canRefreshSite(site.id);
      if (!allowed) return;
    }
    setRefreshingSites(prev => new Set(prev).add(site.id));
    const url = `https://${site.domain}`;
    const rawAccumulator: Record<string, unknown> = {};
    let currentSeoScore: number | null = null;
    let currentGeoScore = 0;
    let currentCitationRate = 0;
    let currentSentiment = 'neutral';
    let currentPerformance: number | null = null;
    let currentLlmOverallScore: number | null = null;

    const calls = [
      supabase.functions.invoke('check-crawlers', { body: { url } }).then((res) => {
        rawAccumulator.crawlersData = res.data?.data || res.data;
      }).catch(console.error),
      supabase.functions.invoke('check-pagespeed', { body: { url, lang: language, dual: true } }).then((res) => {
        const psiData = res.data;
        currentPerformance = psiData?.data?.mobile?.scores?.performance ?? psiData?.data?.scores?.performance ?? psiData?.data?.performance ?? null;
        currentSeoScore = psiData?.data?.mobile?.scores?.seo ?? psiData?.data?.scores?.seo ?? null;
        rawAccumulator.psiData = psiData?.data;
        rawAccumulator.performanceDesktop = psiData?.data?.desktop?.scores?.performance ?? null;
      }).catch(console.error),
      supabase.functions.invoke('check-geo', { body: { url, lang: language } }).then((res) => {
        currentGeoScore = res.data?.data?.totalScore ?? res.data?.data?.overallScore ?? 0;
        rawAccumulator.geoData = res.data?.data;
      }).catch(console.error),
      supabase.functions.invoke('check-llm', { body: { url, lang: language } }).then((res) => {
        const llmData = res.data;
        const llmCitationRate = llmData?.data?.citationRate;
        currentCitationRate = llmCitationRate
          ? (llmCitationRate.cited / (llmCitationRate.total || 1)) * 100
          : 0;
        currentSentiment = llmData?.data?.overallSentiment || 'neutral';
        currentLlmOverallScore = llmData?.data?.overallScore ?? null;
        rawAccumulator.llmData = llmData?.data;
      }).catch(console.error),
      supabase.functions.invoke('fetch-serp-kpis', {
        body: {
          domain: site.domain, url, tracked_site_id: site.id, user_id: user.id,
          site_context: { products_services: site.products_services, market_sector: site.market_sector, target_audience: site.target_audience, commercial_area: site.commercial_area },
        },
      }).then((res) => {
        rawAccumulator.serpData = res.data?.data || null;
      }).catch(console.error),
    ];

    await Promise.allSettled(calls);

    const computedSemanticAuth = (rawAccumulator.serpData as Record<string, unknown>)?.semantic_authority ?? null;

    await supabase.from('user_stats_history').insert({
      user_id: user.id,
      tracked_site_id: site.id,
      domain: site.domain,
      seo_score: currentSeoScore,
      geo_score: Math.round(currentGeoScore),
      llm_citation_rate: currentCitationRate,
      ai_sentiment: currentSentiment,
      semantic_authority: computedSemanticAuth as number | null,
      voice_share: currentCitationRate || null,
      raw_data: { ...rawAccumulator, performanceScore: currentPerformance, llmOverallScore: currentLlmOverallScore } as unknown as import('@/integrations/supabase/types').Json,
    });
    await fetchStats();

    const nowExhausted = await checkRefreshExhausted(site.id);
    if (nowExhausted) {
      setRefreshExhaustedSites(prev => new Set(prev).add(site.id));
    }

    await supabase
      .from('tracked_sites')
      .update({ last_audit_at: new Date().toISOString() })
      .eq('id', site.id);
    await fetchSites();

    setRefreshingSites(prev => {
      const next = new Set(prev);
      next.delete(site.id);
      return next;
    });

    toast.success(language === 'fr' ? 'Analyse complète terminée' : language === 'es' ? 'Análisis completo terminado' : 'Full analysis completed');
  };

  // ─── URL validation ───
  const handleValidateUrl = async () => {
    if (!newUrl.trim()) return;
    setValidating(true);
    setValidationResult({ valid: false, checked: false });
    const formatted = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    let brandSearch = '';
    try {
      const u = new URL(formatted);
      brandSearch = u.hostname.replace('www.', '').split('.')[0];
    } catch {
      brandSearch = newUrl.replace(/^https?:\/\//, '').split('.')[0];
    }
    try {
      const { data, error } = await supabase.functions.invoke('validate-url', {
        body: { urls: [formatted], searchBrand: brandSearch },
      });
      if (error) throw error;
      const mainResult = data?.results?.[0];
      const brandResult = data?.brandResult;
      if (mainResult?.valid) {
        const finalUrl = mainResult.finalUrl || formatted;
        setNewUrl(finalUrl);
        setValidationResult({ valid: true, checked: true });
      } else if (brandResult) {
        setValidationResult({ valid: false, checked: true, suggestion: brandResult });
      } else {
        setValidationResult({ valid: false, checked: true });
      }
    } catch (err) {
      console.error('[MyTracking] validate-url error:', err);
      setValidationResult({ valid: false, checked: true });
    } finally {
      setValidating(false);
    }
  };

  const handleAcceptSuggestion = () => {
    if (validationResult.suggestion) {
      setNewUrl(validationResult.suggestion);
      setValidationResult({ valid: true, checked: true });
    }
  };

  // ─── Add site ───
  const handleAddSite = async (t: Record<string, string>) => {
    if (!user) return;
    if (!validationResult.checked) {
      await handleValidateUrl();
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(newUrl.startsWith('http') ? newUrl : `https://${newUrl}`);
    } catch {
      toast.error(t.invalidUrl);
      return;
    }
    const domain = parsedUrl.hostname.replace('www.', '');
    const existing = sites.find(s => s.domain === domain);
    if (existing) {
      toast.error(t.alreadyTracked);
      // Le site existe déjà : on ferme la modal et on bascule dessus.
      setShowAddModal(false);
      setNewUrl('');
      setValidationResult({ valid: false, checked: false });
      setSelectedSite(existing.id);
      setShowApiPanel(false);
      return;
    }
    setAdding(true);
    try {
      const { data: site, error } = await supabase
        .from('tracked_sites')
        .insert({ user_id: user.id, domain, site_name: domain, last_audit_at: null })
        .select()
        .single();
      if (error) throw error;

      // 1) Ferme la modal immédiatement (UX feedback instantané)
      setShowAddModal(false);
      setNewUrl('');
      setValidationResult({ valid: false, checked: false });

      // 2) Ajout optimiste : insère le site en tête de la liste locale
      //    pour qu'il apparaisse comme tracké sans attendre fetchSites().
      if (site) {
        setSites(prev => {
          // évite tout doublon si un fetch concurrent l'a déjà inséré
          if (prev.some(s => s.id === (site as TrackedSite).id)) return prev;
          return [site as TrackedSite, ...prev];
        });
        // 3) Sélectionne le nouveau site et sort du panneau API si ouvert
        setSelectedSite(site.id);
        setShowApiPanel(false);
        toast.success(
          language === 'fr' ? `Site ajouté : ${domain}` :
          language === 'es' ? `Sitio añadido: ${domain}` :
          `Site added: ${domain}`,
        );
      }

      // 4) Refetch en arrière-plan pour garantir la cohérence (created_at, etc.)
      void fetchSites();

      if (isAgencyPro && site) {
        toast.info(language === 'fr' ? 'Analyse des KPIs en cours…' : language === 'es' ? 'Analizando KPIs…' : 'Analyzing KPIs…');
        runStreamingAudit(site as TrackedSite);
      }
    } catch (e) {
      console.error('[handleAddSite] insert failed:', e);
      toast.error(t.invalidUrl);
    } finally {
      setAdding(false);
    }
  };

  // ─── Remove site ───
  // Supprime un site suivi : désactive aussi l'autopilot lié et la cible Parménion
  // sur le même domaine afin que plus aucun audit / cycle automatique ne tourne.
  const handleRemoveSite = async (siteId: string, t: Record<string, string>) => {
    const site = sites.find(s => s.id === siteId);
    // 1) Désactiver l'autopilot (si présent)
    await supabase
      .from('autopilot_configs')
      .update({ is_active: false })
      .eq('tracked_site_id', siteId);
    // 2) Désactiver la cible Parménion sur ce domaine (si présente)
    if (site?.domain) {
      await supabase
        .from('parmenion_targets')
        .update({ is_active: false })
        .ilike('domain', site.domain);
    }
    // 3) Suppression du site suivi
    await supabase.from('tracked_sites').delete().eq('id', siteId);
    setSites(prev => prev.filter(s => s.id !== siteId));
    if (selectedSite === siteId) {
      setSelectedSite(sites.find(s => s.id !== siteId)?.id || null);
    }
    toast.success(t.removeConfirm);
  };

  // ─── Rollback ───
  const handleRollback = async (site: TrackedSite) => {
    if (!user || !site.previous_config || Object.keys(site.previous_config).length === 0) {
      toast.error(language === 'fr' ? 'Aucune configuration précédente à restaurer' : 'No previous configuration to restore');
      return;
    }
    try {
      await supabase
        .from('tracked_sites')
        .update({ current_config: site.previous_config, previous_config: {} } as Record<string, unknown>)
        .eq('id', site.id)
        .eq('user_id', user.id);
      setSites(prev => prev.map(s =>
        s.id === site.id
          ? { ...s, current_config: site.previous_config, previous_config: {} }
          : s
      ));
      toast.success(language === 'fr' ? 'Rollback effectué — configuration précédente restaurée' : 'Rollback done — previous config restored');
    } catch (err) {
      console.error('Rollback error:', err);
      toast.error(language === 'fr' ? 'Erreur lors du rollback' : 'Rollback error');
    }
  };

  // ─── IKTracker toggle ───
  const handleToggleIkTracker = async () => {
    if (!currentSite || ikTrackerToggling) return;
    const isOn = ikTrackerConnected === true;
    setIkTrackerToggling(true);
    try {
      const newDisabled = isOn;
      const config = (currentSite.current_config as Record<string, unknown>) || {};
      const updated = { ...config, iktracker_disabled: newDisabled };
      if (!newDisabled) delete (updated as Record<string, unknown>).iktracker_disabled;
      await supabase
        .from('tracked_sites')
        .update({ current_config: updated })
        .eq('id', currentSite.id);
      setIkTrackerConnected(!newDisabled);
      setSites(prev => prev.map(s => s.id === currentSite.id ? { ...s, current_config: updated } : s));
      toast.success(
        newDisabled
          ? (language === 'fr' ? 'API IKTracker débranchée' : 'IKTracker API disconnected')
          : (language === 'fr' ? 'API IKTracker branchée' : 'IKTracker API connected')
      );
    } catch {
      toast.error(language === 'fr' ? 'Erreur lors du basculement' : 'Toggle error');
    } finally {
      setIkTrackerToggling(false);
    }
  };

  // ─── Helpers for stats extraction ───
  const getPerformanceScore = (entry: StatsEntry) => entry.raw_data?.performanceScore as number | null ?? null;
  const getPerformanceDesktop = (entry: StatsEntry) => entry.raw_data?.performanceDesktop as number | null ?? null;
  const getAiVisibility = (entry: StatsEntry): number | null => entry.raw_data?.llmOverallScore as number | null ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSerpData = (entry: StatsEntry) => entry.raw_data?.serpData as any ?? null;

  const latestPerformance = latestStats ? getPerformanceScore(latestStats) : null;
  const latestPerformanceDesktop = latestStats ? getPerformanceDesktop(latestStats) : null;
  const latestAiVisibility = latestStats ? getAiVisibility(latestStats) : null;
  const latestSerpData = latestStats ? getSerpData(latestStats) : null;
  const previousSerpData = currentStats.length >= 2 ? getSerpData(currentStats[currentStats.length - 2]) : null;
  const previousIndexedPages = previousSerpData?.indexed_pages ?? null;

  // ─── Chart data ───
  const chartData = useMemo(() => {
    const byDay: Record<string, StatsEntry[]> = {};
    for (const entry of currentStats) {
      const d = new Date(entry.recorded_at);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push(entry);
    }
    const deduped: StatsEntry[] = [];
    for (const dayKey of Object.keys(byDay).sort()) {
      const entries = byDay[dayKey];
      entries.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      deduped.push(...entries.slice(0, 2).reverse());
    }
    return deduped.map((entry) => {
      const d = new Date(entry.recorded_at);
      return {
        date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        seo: entry.seo_score || 0,
        geo: entry.geo_score || 0,
        citation: entry.llm_citation_rate || 0,
        semanticAuth: entry.semantic_authority || 0,
        performanceMobile: getPerformanceScore(entry) || 0,
        performanceDesktop: getPerformanceDesktop(entry) || 0,
      };
    });
  }, [currentStats]);

  return {
    // Auth/context
    user, profile, language, isAgencyPro, planType, isAdmin, isDemoMode,
    // Core state
    sites, setSites, loading, selectedSite, setSelectedSite,
    isCollaborator, showApiPanel, setShowApiPanel,
    // Add site
    showAddModal, setShowAddModal, newUrl, setNewUrl, adding,
    validating, validationResult, setValidationResult,
    handleValidateUrl, handleAcceptSuggestion, handleAddSite,
    // Refresh
    refreshingSites, refreshExhaustedSites, refreshingSerp, setRefreshingSerp,
    runStreamingAudit, runBackgroundAudit,
    // Architect
    architectSiteId, setArchitectSiteId, isArchitectOpen, setIsArchitectOpen,
    architectAuditResult, setArchitectAuditResult, isLoadingAudit, setIsLoadingAudit,
    // WordPress
    wpConnectSiteId, setWpConnectSiteId, showWpModal, setShowWpModal,
    wpApiKeyVisible, setWpApiKeyVisible, wpApiKeyCopied, setWpApiKeyCopied,
    generatingMagicLink, setGeneratingMagicLink,
    // Misc
    llmBenchmarkRefreshKey, setLlmBenchmarkRefreshKey,
    showIdentityModal, setShowIdentityModal,
    simulatedDataEnabled,
    // IKTracker
    ikTrackerConnected, ikTrackerToggling, handleToggleIkTracker, isIkTrackerSite,
    // GSC
    gscConnecting, gscData, gscLoading, gscConnected, gscHasToken, gscSiteVerified, gscAggregatedRows,
    handleConnectGsc, fetchGscData,
    gscDateMode, setGscDateMode, gscSinceDate, setGscSinceDate,
    gscRangeStart, setGscRangeStart, gscRangeEnd, setGscRangeEnd,
    gscGranularity, setGscGranularity,
    // GA4
    ga4EnabledLocal, ga4TogglingLocal, handleGa4ToggleLocal,
    // Derived
    currentSite, currentStats, latestStats,
    latestPerformance, latestPerformanceDesktop, latestAiVisibility,
    latestSerpData, previousIndexedPages, chartData,
    // Actions
    fetchSites, fetchStats, handleRemoveSite, handleRollback,
    canRefreshSite, checkRefreshExhausted,
    getPerformanceScore, getPerformanceDesktop, getAiVisibility, getSerpData,
  };
}
