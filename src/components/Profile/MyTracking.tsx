import { useState, useEffect, useCallback, useMemo, ElementType } from 'react';
import { ActiveCrawlBanner } from '@/components/Profile/ActiveCrawlBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Radar, Trash2, TrendingUp, Globe, Brain, BarChart3, Loader2, ExternalLink, Gauge, Wrench, Plug, Unplug, Download, Link2, MoreVertical, AlertCircle, Search, CheckCircle2, MousePointerClick, Eye, Undo2, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { handleWPIntegration, isSiteSynced } from '@/utils/wpIntegration';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Bar, BarChart, ComposedChart } from 'recharts';
import { SmartConfigurator } from '@/components/ExpertAudit/CorrectiveCodeEditor/SmartConfigurator';
import { SerpKpiBanner } from '@/components/Profile/SerpKpiBanner';
import { LLMVisibilityDashboard } from '@/components/Profile/LLMVisibilityDashboard';
import { LLMDepthCard } from '@/components/Profile/LLMDepthCard';
import { WordPressConfigCard } from '@/components/Profile/WordPressConfigCard';
import { IASCard } from '@/components/Profile/IASCard';


const translations = {
  fr: {
    title: 'Mes sites',
    description: 'Suivez l\'évolution SEO & IA de vos sites au fil du temps.',
    noSites: 'Aucun site suivi pour le moment.',
    addSite: 'Ajouter un site',
    addSiteDesc: 'Entrez l\'URL du site à suivre. Un audit de référence sera lancé automatiquement.',
    urlPlaceholder: 'https://exemple.com',
    add: 'Ajouter',
    adding: 'Ajout...',
    remove: 'Retirer',
    removeConfirm: 'Site retiré du suivi',
    lastAudit: 'Dernier audit',
    never: 'Jamais',
    aiVisibility: 'Visibilité IA',
    seoScore: 'Score SEO',
    geoScore: 'Score GEO',
    citationRate: 'Taux de citation LLM',
    sentiment: 'Sentiment IA',
    performance: 'Performance',
    performanceMobile: 'Perf. Mobile',
    performanceDesktop: 'Perf. Desktop',
    semanticAuth: 'Autorité sémantique',
    voiceShare: 'Part de voix',
    evolution: 'Évolution',
    kpis: 'KPIs',
    refreshing: 'Mise à jour...',
    autoRefresh: 'Mis à jour automatiquement',
    invalidUrl: 'URL invalide',
    alreadyTracked: 'Ce site est déjà suivi',
  },
  en: {
    title: 'My Sites',
    description: 'Track the SEO & AI evolution of your sites over time.',
    noSites: 'No tracked sites yet.',
    addSite: 'Add a site',
    addSiteDesc: 'Enter the site URL to track. A baseline audit will run automatically.',
    urlPlaceholder: 'https://example.com',
    add: 'Add',
    adding: 'Adding...',
    remove: 'Remove',
    removeConfirm: 'Site removed from tracking',
    lastAudit: 'Last audit',
    never: 'Never',
    aiVisibility: 'AI Visibility',
    seoScore: 'SEO Score',
    geoScore: 'GEO Score',
    citationRate: 'LLM Citation Rate',
    sentiment: 'AI Sentiment',
    performance: 'Performance',
    performanceMobile: 'Perf. Mobile',
    performanceDesktop: 'Perf. Desktop',
    semanticAuth: 'Semantic Authority',
    voiceShare: 'Voice Share',
    evolution: 'Evolution',
    kpis: 'KPIs',
    refreshing: 'Updating...',
    autoRefresh: 'Automatically updated',
    invalidUrl: 'Invalid URL',
    alreadyTracked: 'This site is already tracked',
  },
  es: {
    title: 'Mis sitios',
    description: 'Sigue la evolución SEO e IA de tus sitios a lo largo del tiempo.',
    noSites: 'No hay sitios seguidos aún.',
    addSite: 'Agregar un sitio',
    addSiteDesc: 'Ingresa la URL del sitio a seguir. Se lanzará una auditoría de referencia.',
    urlPlaceholder: 'https://ejemplo.com',
    add: 'Agregar',
    adding: 'Agregando...',
    remove: 'Eliminar',
    removeConfirm: 'Sitio eliminado del seguimiento',
    lastAudit: 'Última auditoría',
    never: 'Nunca',
    aiVisibility: 'Visibilidad IA',
    seoScore: 'Score SEO',
    geoScore: 'Score GEO',
    citationRate: 'Tasa de citación LLM',
    sentiment: 'Sentimiento IA',
    performance: 'Rendimiento',
    performanceMobile: 'Rend. Móvil',
    performanceDesktop: 'Rend. Escritorio',
    semanticAuth: 'Autoridad semántica',
    voiceShare: 'Cuota de voz',
    evolution: 'Evolución',
    kpis: 'KPIs',
    refreshing: 'Actualizando...',
    autoRefresh: 'Actualizado automáticamente',
    invalidUrl: 'URL inválida',
    alreadyTracked: 'Este sitio ya está siendo seguido',
  },
};

interface TrackedSite {
  id: string;
  domain: string;
  site_name: string;
  created_at: string;
  last_audit_at: string | null;
  api_key?: string;
  current_config?: Record<string, unknown>;
  previous_config?: Record<string, unknown>;
  market_sector?: string | null;
  products_services?: string | null;
  target_audience?: string | null;
  address?: string | null;
  commercial_area?: string | null;
  company_size?: string | null;
}

interface StatsEntry {
  recorded_at: string;
  seo_score: number | null;
  geo_score: number | null;
  llm_citation_rate: number | null;
  ai_sentiment: string | null;
  semantic_authority: number | null;
  voice_share: number | null;
}

interface GscDataRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscData {
  rows: GscDataRow[];
  total_clicks: number;
  total_impressions: number;
  avg_position: number;
  date_range: { start: string; end: string };
}

export function MyTracking() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();
  const t = translations[language] || translations.fr;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCollaborator, setIsCollaborator] = useState(false);

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, StatsEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    suggestion?: string;
    checked: boolean;
  }>({ valid: false, checked: false });
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [refreshingSites, setRefreshingSites] = useState<Set<string>>(new Set());
  const [refreshExhaustedSites, setRefreshExhaustedSites] = useState<Set<string>>(new Set());
  const [refreshingSerp, setRefreshingSerp] = useState(false);
  
  // Architect modal state
  const [architectSiteId, setArchitectSiteId] = useState<string | null>(null);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  
  // WordPress connection state
  const [wpConnectSiteId, setWpConnectSiteId] = useState<string | null>(null);
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpApiKeyVisible, setWpApiKeyVisible] = useState(false);
  const [wpApiKeyCopied, setWpApiKeyCopied] = useState(false);
  const [generatingMagicLink, setGeneratingMagicLink] = useState(false);

  // GSC state
  const [gscConnecting, setGscConnecting] = useState(false);
  const [gscData, setGscData] = useState<GscData | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const gscConnected = !!profile?.gsc_access_token;

  // GSC date range & granularity
  type GscDateMode = 'since' | 'range';
  type GscGranularity = 'daily' | 'weekly' | 'monthly';
  const [gscDateMode, setGscDateMode] = useState<GscDateMode>('since');
  const [gscSinceDate, setGscSinceDate] = useState<Date>(() => new Date(2026, 0, 1));
  const [gscRangeStart, setGscRangeStart] = useState<Date>(() => new Date(2026, 0, 1));
  const [gscRangeEnd, setGscRangeEnd] = useState<Date>(() => new Date());
  const [gscGranularity, setGscGranularity] = useState<GscGranularity>('daily');

  const gscStartDate = gscDateMode === 'since' ? gscSinceDate : gscRangeStart;
  const [gscTodayDate] = useState(() => new Date());
  const gscEndDate = gscDateMode === 'since' ? gscTodayDate : gscRangeEnd;

  const fetchSites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tracked_sites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setSites(data as TrackedSite[]);
      if (data.length > 0 && !selectedSite) {
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
      data.forEach((entry: any) => {
        const siteId = entry.tracked_site_id;
        if (!map[siteId]) map[siteId] = [];
        map[siteId].push(entry);
      });
      setStatsMap(map);
    }
  }, [user, sites]);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Check if user is a collaborator (not owner)
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

  // Handle GSC OAuth server-side callback result (edge function redirects back with ?gsc_connected=true or ?gsc_error=...)
  useEffect(() => {
    const gscConnectedParam = searchParams.get('gsc_connected');
    const gscError = searchParams.get('gsc_error');
    
    if (gscConnectedParam === 'true') {
      toast.success(language === 'fr' ? 'Search Console connecté !' : language === 'es' ? '¡Search Console conectado!' : 'Search Console connected!');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('gsc_connected');
      setSearchParams(newParams, { replace: true });
      // Force refresh to pick up new token
      window.location.reload();
    } else if (gscError) {
      toast.error(language === 'fr' ? 'Erreur de connexion Search Console' : language === 'es' ? 'Error de conexión Search Console' : 'Search Console connection error');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('gsc_error');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  const currentSiteDomain = sites.find(s => s.id === selectedSite)?.domain;

  // Fetch GSC data when site is selected and GSC is connected
  const fetchGscData = useCallback(async () => {
    if (!user || !currentSiteDomain) return;
    setGscLoading(true);
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
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'GSC not connected') return;
        throw new Error(data.error);
      }
      setGscData(data);
    } catch (err: any) {
      console.error('GSC fetch error:', err);
    } finally {
      setGscLoading(false);
    }
  }, [user, currentSiteDomain, gscStartDate, gscEndDate]);

  useEffect(() => {
    if (gscConnected && currentSiteDomain) {
      fetchGscData();
    } else {
      setGscData(null);
      setGscLoading(false);
    }
  }, [gscConnected, currentSiteDomain, fetchGscData]);

  // Aggregate GSC rows by granularity
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
        key = r.date.slice(0, 7); // YYYY-MM
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


  const handleConnectGsc = async () => {
    if (!user) return;
    setGscConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-auth', {
        body: { action: 'login', user_id: user.id, frontend_origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.auth_url) {
        // Open Google OAuth in same window
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      console.error('GSC login error:', err);
      toast.error(language === 'fr' ? 'Erreur de connexion Search Console' : language === 'es' ? 'Error de conexión Search Console' : 'Search Console connection error');
    } finally {
      setGscConnecting(false);
    }
  };

  // Auto-refresh sites not audited in 24h — only once per login session
  useEffect(() => {
    if (!user || sites.length === 0) return;
    
    // Check if we already refreshed in this session
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

  const runBackgroundAudit = async (site: TrackedSite) => {
    if (!user) return;
    setRefreshingSites(prev => new Set(prev).add(site.id));
    
    try {
      const url = `https://${site.domain}`;
      
      // Run check-geo, check-llm, check-pagespeed, check-crawlers and fetch-serp-kpis in parallel
      const [geoRes, llmRes, psiRes, crawlersRes, serpRes] = await Promise.allSettled([
        supabase.functions.invoke('check-geo', { body: { url, lang: language } }),
        supabase.functions.invoke('check-llm', { body: { url, lang: language } }),
        supabase.functions.invoke('check-pagespeed', { body: { url, lang: language, dual: true } }),
        supabase.functions.invoke('check-crawlers', { body: { url } }),
        supabase.functions.invoke('fetch-serp-kpis', { body: { domain: site.domain, url } }),
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
      
      // Compute SEO crawlability score from check-crawlers (% of AI bots allowed)
      const botResults = crawlersData?.data?.bots || crawlersData?.data?.results || crawlersData?.results || [];
      const seoScore = botResults.length > 0
        ? Math.round((botResults.filter((b: any) => b.status === 'allowed').length / botResults.length) * 100)
        : null;

      // Extract PageSpeed performance scores (mobile + desktop)
      const performanceScore = psiData?.data?.mobile?.scores?.performance ?? psiData?.data?.scores?.performance ?? psiData?.data?.performance ?? null;
      const performanceDesktop = psiData?.data?.desktop?.scores?.performance ?? null;

      // Insert stats entry
      await supabase.from('user_stats_history').insert({
        user_id: user.id,
        tracked_site_id: site.id,
        domain: site.domain,
        seo_score: seoScore,
        geo_score: Math.round(geoScore),
        llm_citation_rate: citationRate,
        ai_sentiment: sentiment,
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

      // Update last_audit_at
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

  const handleValidateUrl = async () => {
    if (!newUrl.trim()) return;
    setValidating(true);
    setValidationResult({ valid: false, checked: false });

    const formatted = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    // Extract brand-like term for LLM search
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
        // URL is valid — use finalUrl if available
        const finalUrl = mainResult.finalUrl || formatted;
        setNewUrl(finalUrl);
        setValidationResult({ valid: true, checked: true });
      } else if (brandResult) {
        // URL invalid but LLM found a suggestion
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

  // Get the last Paris 5AM boundary (reset point)
  const getParis5amBoundary = useCallback(() => {
    const now = new Date();
    // Get current Paris time
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const parisHour = parisNow.getHours();
    // If before 5AM Paris, boundary is yesterday 5AM; otherwise today 5AM
    const boundary = new Date(parisNow);
    boundary.setHours(5, 0, 0, 0);
    if (parisHour < 5) boundary.setDate(boundary.getDate() - 1);
    // Convert back to UTC for DB comparison
    const offset = now.getTime() - parisNow.getTime();
    return new Date(boundary.getTime() + offset).toISOString();
  }, []);

  // Check if a site has exhausted its 2 daily refreshes
  const checkRefreshExhausted = useCallback(async (siteId: string): Promise<boolean> => {
    if (isAdmin) return false;
    const since = getParis5amBoundary();
    const { count } = await supabase
      .from('user_stats_history')
      .select('id', { count: 'exact', head: true })
      .eq('tracked_site_id', siteId)
      .gte('recorded_at', since);
    return (count ?? 0) >= 2;
  }, [isAdmin, getParis5amBoundary]);

  // Rate limit: max 2 KPI refreshes per day per site (Paris 5AM reset)
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

  // Check refresh exhaustion for all sites on load and when sites change
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

  const runStreamingAudit = async (site: TrackedSite) => {
    if (!user) return;

    // Rate limit check (admins bypass)
    if (!isAdmin) {
      const allowed = await canRefreshSite(site.id);
      if (!allowed) return;
    }

    setRefreshingSites(prev => new Set(prev).add(site.id));

    const url = `https://${site.domain}`;
    // Accumulator for raw_data — updated progressively
    const rawAccumulator: Record<string, any> = {};
    let currentSeoScore: number | null = null;
    let currentGeoScore = 0;
    let currentCitationRate = 0;
    let currentSentiment = 'neutral';
    let currentPerformance: number | null = null;
    let currentLlmOverallScore: number | null = null;

    // Fire all 5 calls independently
    const calls = [
      // 1. Crawlers → SEO score
      supabase.functions.invoke('check-crawlers', { body: { url } }).then((res) => {
        const crawlersData = res.data;
        const botResults = crawlersData?.data?.bots || crawlersData?.data?.results || crawlersData?.results || [];
        currentSeoScore = botResults.length > 0
          ? Math.round((botResults.filter((b: any) => b.status === 'allowed').length / botResults.length) * 100)
          : null;
        rawAccumulator.crawlersData = crawlersData?.data || crawlersData;
      }).catch(console.error),

      // 2. PageSpeed → Performance (mobile + desktop)
      supabase.functions.invoke('check-pagespeed', { body: { url, lang: language, dual: true } }).then((res) => {
        const psiData = res.data;
        currentPerformance = psiData?.data?.mobile?.scores?.performance ?? psiData?.data?.scores?.performance ?? psiData?.data?.performance ?? null;
        rawAccumulator.psiData = psiData?.data;
        rawAccumulator.performanceDesktop = psiData?.data?.desktop?.scores?.performance ?? null;
      }).catch(console.error),

      // 3. GEO → GEO score
      supabase.functions.invoke('check-geo', { body: { url, lang: language } }).then((res) => {
        const geoData = res.data;
        currentGeoScore = geoData?.data?.totalScore ?? geoData?.data?.overallScore ?? 0;
        rawAccumulator.geoData = geoData?.data;
      }).catch(console.error),

      // 4. LLM → Citation, Sentiment, AI Visibility
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

      // 5. SERP KPIs
      supabase.functions.invoke('fetch-serp-kpis', { body: { domain: site.domain, url, tracked_site_id: site.id, user_id: user.id } }).then((res) => {
        rawAccumulator.serpData = res.data?.data || null;
      }).catch(console.error),
    ];

    await Promise.allSettled(calls);

    // Insert ONE single snapshot with all collected data
    await supabase.from('user_stats_history').insert({
      user_id: user.id,
      tracked_site_id: site.id,
      domain: site.domain,
      seo_score: currentSeoScore,
      geo_score: Math.round(currentGeoScore),
      llm_citation_rate: currentCitationRate,
      ai_sentiment: currentSentiment,
      voice_share: currentCitationRate || null,
      raw_data: { ...rawAccumulator, performanceScore: currentPerformance, llmOverallScore: currentLlmOverallScore },
    });
    await fetchStats();

    // Re-check if site is now exhausted
    const nowExhausted = await checkRefreshExhausted(site.id);
    if (nowExhausted) {
      setRefreshExhaustedSites(prev => new Set(prev).add(site.id));
    }

    // Update last_audit_at
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

  const handleAddSite = async () => {
    if (!user) return;

    // If not validated yet, validate first
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

    // Check if already tracked
    const existing = sites.find(s => s.domain === domain);
    if (existing) {
      toast.error(t.alreadyTracked);
      return;
    }

    setAdding(true);
    try {
      const { data: site, error } = await supabase
        .from('tracked_sites')
        .insert({
          user_id: user.id,
          domain,
          site_name: domain,
          last_audit_at: null,
        })
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      setNewUrl('');
      setValidationResult({ valid: false, checked: false });
      await fetchSites();

      // Pro Agency: auto-launch streaming KPI refresh
      if (isAgencyPro && site) {
        setSelectedSite(site.id);
        toast.info(language === 'fr' ? 'Analyse des KPIs en cours…' : language === 'es' ? 'Analizando KPIs…' : 'Analyzing KPIs…');
        runStreamingAudit(site as TrackedSite);
      }
    } catch {
      toast.error(t.invalidUrl);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveSite = async (siteId: string) => {
    await supabase.from('tracked_sites').delete().eq('id', siteId);
    setSites(prev => prev.filter(s => s.id !== siteId));
    if (selectedSite === siteId) {
      setSelectedSite(sites.find(s => s.id !== siteId)?.id || null);
    }
    toast.success(t.removeConfirm);
  };

  // Rollback: restore previous_config → current_config, clear previous_config
  const handleRollback = async (site: TrackedSite) => {
    if (!user || !site.previous_config || Object.keys(site.previous_config).length === 0) {
      toast.error(language === 'fr' ? 'Aucune configuration précédente à restaurer' : 'No previous configuration to restore');
      return;
    }

    try {
      await supabase
        .from('tracked_sites')
        .update({
          current_config: site.previous_config,
          previous_config: {},
        } as any)
        .eq('id', site.id)
        .eq('user_id', user.id);

      // Update local state
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

  const currentSite = sites.find(s => s.id === selectedSite);
  const currentStats = selectedSite ? (statsMap[selectedSite] || []) : [];
  const latestStats = currentStats.length > 0 ? currentStats[currentStats.length - 1] : null;
  
  // Extract performance scores from raw_data
  const getPerformanceScore = (entry: StatsEntry) => {
    const raw = entry as any;
    return raw?.raw_data?.performanceScore ?? null;
  };
  const getPerformanceDesktop = (entry: StatsEntry) => {
    const raw = entry as any;
    return raw?.raw_data?.performanceDesktop ?? null;
  };
  const getAiVisibility = (entry: StatsEntry): number | null => {
    const raw = entry as any;
    return raw?.raw_data?.llmOverallScore ?? null;
  };
  const getSerpData = (entry: StatsEntry) => {
    const raw = entry as any;
    return raw?.raw_data?.serpData ?? null;
  };
  const latestPerformance = latestStats ? getPerformanceScore(latestStats) : null;
  const latestPerformanceDesktop = latestStats ? getPerformanceDesktop(latestStats) : null;
  const latestAiVisibility = latestStats ? getAiVisibility(latestStats) : null;
  const latestSerpData = latestStats ? getSerpData(latestStats) : null;
  const previousSerpData = currentStats.length >= 2 ? getSerpData(currentStats[currentStats.length - 2]) : null;
  const previousIndexedPages = previousSerpData?.indexed_pages ?? null;

  const chartData = useMemo(() => {
    // Group entries by day, keep only the last 2 per day
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
      // Sort by recorded_at desc, keep last 2
      entries.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      const kept = entries.slice(0, 2).reverse();
      deduped.push(...kept);
    }
    return deduped.map((entry) => {
      const d = new Date(entry.recorded_at);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return {
        date: `${dd}/${mm}`,
        seo: entry.seo_score || 0,
        geo: entry.geo_score || 0,
        citation: entry.llm_citation_rate || 0,
        performance: getPerformanceScore(entry) || 0,
      };
    });
  }, [currentStats]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sentimentLabel = (s: string | null) => {
    if (!s) return '—';
    const map: Record<string, string> = {
      positive: 'Très positif', mostly_positive: 'Plutôt positif',
      neutral: 'Neutre', mixed: 'Mitigé', negative: 'Négatif'
    };
    return map[s] || s;
  };

  const sentimentColor = (s: string | null) => {
    if (!s) return '';
    const map: Record<string, string> = {
      positive: 'text-green-700 dark:text-green-300',
      mostly_positive: 'text-teal-700 dark:text-teal-300',
      neutral: 'text-gray-600 dark:text-gray-400',
      mixed: 'text-orange-700 dark:text-orange-400',
      negative: 'text-red-700 dark:text-red-400',
    };
    return map[s] || '';
  };

  return (
    <div className="space-y-6">
      {/* Active crawl progress banner */}
      <ActiveCrawlBanner />
      <Card>
        <CardHeader className="flex flex-row items-center justify-end pb-2">
          <Button variant="outline" size="icon" onClick={() => setShowAddModal(true)} aria-label={t.addSite} className="h-9 w-9 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Radar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t.noSites}</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4" />
                {t.addSite}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Site selector tabs */}
              {sites.length > 1 && (
                <Tabs value={selectedSite || ''} onValueChange={setSelectedSite}>
                  <TabsList className="w-full flex flex-wrap h-auto gap-1">
                    {sites.map(site => (
                      <TabsTrigger key={site.id} value={site.id} className="gap-2 text-xs sm:text-sm">
                        <Globe className="h-3 w-3" />
                        {site.domain}
                        {refreshingSites.has(site.id) && <Loader2 className="h-3 w-3 animate-spin" />}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}

              {currentSite && (
                <div className="space-y-6">
                  {/* Site header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{currentSite.domain}</h3>
                        <p className="text-xs text-muted-foreground">
                          {t.lastAudit}: {currentSite.last_audit_at 
                            ? new Date(currentSite.last_audit_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')
                            : t.never}
                          {refreshingSites.has(currentSite.id) && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              {t.refreshing}
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCollaborator && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveSite(currentSite.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Connect/Disconnect site button → opens modal */}
                      <Button 
                        variant="outline" 
                        size="icon"
                        className={cn(
                          "h-8 w-8 relative",
                          isSiteSynced(currentSite.current_config as Record<string, unknown>) && "border-destructive/50 text-destructive hover:text-destructive hover:bg-destructive/10"
                        )}
                        title={isSiteSynced(currentSite.current_config as Record<string, unknown>)
                          ? (language === 'fr' ? 'Débrancher mon site' : language === 'es' ? 'Desconectar mi sitio' : 'Disconnect my site')
                          : (language === 'fr' ? 'Brancher mon site' : language === 'es' ? 'Conectar mi sitio' : 'Connect my site')
                        }
                        onClick={() => {
                          setWpConnectSiteId(currentSite.id);
                          setShowWpModal(true);
                          setWpApiKeyVisible(false);
                          setWpApiKeyCopied(false);
                        }}
                      >
                        {isSiteSynced(currentSite.current_config as Record<string, unknown>) ? (
                          <Unplug className="h-3.5 w-3.5" />
                        ) : (
                          <>
                            <Plug className="h-3.5 w-3.5" />
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />
                          </>
                        )}
                      </Button>

                      {!gscConnected && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1.5"
                          disabled={gscConnecting}
                          onClick={handleConnectGsc}
                        >
                          {gscConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                          Search Console
                        </Button>
                      )}

                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => navigate(`/audit-expert?url=${encodeURIComponent(`https://${currentSite.domain}`)}&from=sites`)}
                      >
                        <Search className="h-3.5 w-3.5" />
                        {language === 'fr' ? 'Auditer' : language === 'es' ? 'Auditar' : 'Audit'}
                      </Button>
                      {latestStats && (
                        <Button 
                          size="sm" 
                          className="gap-1.5"
                          onClick={() => {
                            setArchitectSiteId(currentSite.id);
                            setIsArchitectOpen(true);
                          }}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {language === 'fr' ? 'Optimiser' : language === 'es' ? 'Optimizar' : 'Optimize'}
                        </Button>
                      )}

                      {/* Rollback button — only visible if a previous config exists */}
                      {currentSite.previous_config && Object.keys(currentSite.previous_config).length > 0 && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="gap-1.5 font-semibold"
                          onClick={() => handleRollback(currentSite)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* KPI Cards — Sortable, wrapped in a bordered Card */}
                  {(() => {
                    const defaultKpiOrder = ['performanceMobile', 'performanceDesktop', 'seoScore', 'geoScore', 'aiVisibility', 'citationRate', 'sentiment', 'semanticAuth', 'voiceShare'];
                    
                    const kpiDefinitions: Record<string, { label: string; value: string; icon: ElementType; valueClassName?: string }> = {
                      performanceMobile: { label: t.performanceMobile, value: latestPerformance !== null ? `${Math.round(latestPerformance)}/100` : '—', icon: Gauge },
                      performanceDesktop: { label: t.performanceDesktop, value: latestPerformanceDesktop !== null ? `${Math.round(latestPerformanceDesktop)}/100` : '—', icon: Gauge },
                      seoScore: { label: t.seoScore, value: latestStats?.seo_score != null ? `${latestStats.seo_score}%` : '—', icon: Search },
                      geoScore: { label: t.geoScore, value: latestStats?.geo_score ? `${latestStats.geo_score}%` : '—', icon: Globe },
                      aiVisibility: { label: t.aiVisibility, value: latestAiVisibility != null ? `${Math.round(latestAiVisibility)}/100` : '—', icon: Eye },
                      citationRate: { label: t.citationRate, value: latestStats?.llm_citation_rate ? `${Math.round(latestStats.llm_citation_rate)}%` : '—', icon: Brain },
                      sentiment: { label: t.sentiment, value: latestStats ? sentimentLabel(latestStats.ai_sentiment) : '—', icon: BarChart3, valueClassName: latestStats ? sentimentColor(latestStats.ai_sentiment) : '' },
                      semanticAuth: { label: t.semanticAuth, value: latestStats?.semantic_authority ? `${Math.round(Number(latestStats.semantic_authority))}%` : '—', icon: TrendingUp },
                      voiceShare: { label: t.voiceShare, value: latestStats?.voice_share ? `${Math.round(Number(latestStats.voice_share))}%` : '—', icon: BarChart3 },
                    };

                    // Per-KPI refresh handler map — shared for both mobile/desktop
                    const psiDualRefresh = async () => {
                      if (!currentSite) return;
                      const res = await supabase.functions.invoke('check-pagespeed', { body: { url: `https://${currentSite.domain}`, lang: language, dual: true } });
                      const mobile = res.data?.data?.mobile?.scores?.performance ?? res.data?.data?.scores?.performance ?? null;
                      const desktop = res.data?.data?.desktop?.scores?.performance ?? null;
                      if (mobile !== null) toast.success(`${t.performanceMobile}: ${Math.round(mobile)}/100`);
                      if (desktop !== null) toast.success(`${t.performanceDesktop}: ${Math.round(desktop)}/100`);
                      if (currentSite) await runStreamingAudit(currentSite);
                    };
                    const kpiRefreshMap: Record<string, () => Promise<void>> = {
                      performanceMobile: psiDualRefresh,
                      performanceDesktop: psiDualRefresh,
                      seoScore: async () => {
                        if (!currentSite) return;
                        const res = await supabase.functions.invoke('check-crawlers', { body: { url: `https://${currentSite.domain}` } });
                        const bots = res.data?.data?.results || res.data?.results || [];
                        const score = bots.length > 0 ? Math.round((bots.filter((b: any) => b.status === 'allowed').length / bots.length) * 100) : null;
                        if (score !== null) toast.success(`${t.seoScore}: ${score}%`);
                        if (currentSite) await runStreamingAudit(currentSite);
                      },
                      geoScore: async () => {
                        if (!currentSite) return;
                        const res = await supabase.functions.invoke('check-geo', { body: { url: `https://${currentSite.domain}`, lang: language } });
                        const score = res.data?.data?.totalScore ?? res.data?.data?.overallScore ?? 0;
                        toast.success(`${t.geoScore}: ${Math.round(score)}%`);
                        if (currentSite) await runStreamingAudit(currentSite);
                      },
                      aiVisibility: async () => { if (currentSite) await runStreamingAudit(currentSite); },
                      citationRate: async () => { if (currentSite) await runStreamingAudit(currentSite); },
                      sentiment: async () => { if (currentSite) await runStreamingAudit(currentSite); },
                      semanticAuth: async () => { if (currentSite) await runStreamingAudit(currentSite); },
                      voiceShare: async () => { if (currentSite) await runStreamingAudit(currentSite); },
                    };

                    const isSiteExhausted = currentSite ? refreshExhaustedSites.has(currentSite.id) : false;

                    return (
                      <SortableKPIGrid
                        kpiDefinitions={kpiDefinitions}
                        defaultOrder={defaultKpiOrder}
                        disabled={!latestStats && !refreshingSites.has(currentSite?.id || '')}
                        onRefresh={isSiteExhausted ? undefined : kpiRefreshMap}
                      />
                    );
                  })()}

                  {/* Evolution Chart */}
                  {chartData.length > 1 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          {t.evolution}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ left: 0, right: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="date" className="text-xs" interval={0} padding={{ left: 20, right: 20 }} />
                              <YAxis className="text-xs" />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="seo" name={t.seoScore} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="geo" name={t.geoScore} stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="citation" name={t.citationRate} stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="performance" name={t.performance} stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {chartData.length <= 1 && latestStats && (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center text-muted-foreground text-sm">
                        <TrendingUp className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p>{language === 'fr' ? 'Le graphique d\'évolution apparaîtra après le prochain audit.' : 'The evolution chart will appear after the next audit.'}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Google Search Console Chart */}
                  <Card className={`relative ${!gscConnected ? 'border-dashed opacity-60 pointer-events-auto' : ''}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Google Search Console
                        {gscConnected && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-green-100 dark:bg-green-900/30 px-2 py-px text-[10px] font-semibold text-green-700 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            on
                          </span>
                        )}
                        {gscConnected && gscData && (
                          <Badge variant="secondary" className="text-xs font-normal ml-auto mr-6">
                            {gscData.date_range.start} → {gscData.date_range.end}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!gscConnected ? (
                        <div className="py-8 text-center space-y-3">
                          <Plug className="h-8 w-8 mx-auto opacity-30" />
                          <p className="text-sm text-muted-foreground">
                            {language === 'fr' 
                              ? 'Conecte su cuenta de Google Search Console para visualizar sus datos de rendimiento.' 
                              : 'Connect your Google Search Console account to view your performance data.'}
                          </p>
                          <Button variant="outline" size="sm" className="gap-2" onClick={handleConnectGsc} disabled={gscConnecting}>
                            {gscConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                            {language === 'fr' ? 'Connecter Search Console' : language === 'es' ? 'Conectar Search Console' : 'Connect Search Console'}
                          </Button>
                        </div>
                      ) : gscLoading && !gscData ? (
                        <div className="flex items-center justify-center gap-2 py-10">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {language === 'fr' ? 'Chargement…' : language === 'es' ? 'Cargando…' : 'Loading…'}
                          </span>
                        </div>
                      ) : gscData && gscData.rows.length > 0 ? (
                        <div className="space-y-4 relative">
                          {gscLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg pointer-events-none">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {language === 'fr' ? 'Mise à jour…' : language === 'es' ? 'Actualizando…' : 'Updating…'}
                                </span>
                              </div>
                            </div>
                          )}
                          {/* Date controls */}
                          <div className="flex flex-wrap items-center gap-2.5 relative z-20">
                            {/* Date mode toggle */}
                            <div className="flex rounded-lg border bg-muted p-0.5 text-sm">
                              <button
                                className={cn("px-3.5 py-2 rounded-md transition-colors flex items-center gap-1.5", gscDateMode === 'since' && "bg-background shadow-sm font-medium")}
                                onClick={() => setGscDateMode('since')}
                              >
                                {language === 'fr' ? 'Depuis' : language === 'es' ? 'Desde' : 'Since'}
                              </button>
                              <button
                                className={cn("px-3.5 py-2 rounded-md transition-colors", gscDateMode === 'range' && "bg-background shadow-sm font-medium")}
                                onClick={() => setGscDateMode('range')}
                              >
                                {language === 'fr' ? 'Entre' : language === 'es' ? 'Entre' : 'Between'}
                              </button>
                            </div>

                            {/* Since date picker */}
                            {gscDateMode === 'since' && (
                              <input
                                type="date"
                                value={format(gscSinceDate, 'yyyy-MM-dd')}
                                min="2020-01-01"
                                max={format(new Date(), 'yyyy-MM-dd')}
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const [y, m, d] = e.target.value.split('-').map(Number);
                                  const date = new Date(y, m - 1, d);
                                  if (!isNaN(date.getTime())) setGscSinceDate(date);
                                }}
                                className="h-10 text-sm px-3.5 rounded-md border border-input bg-background text-foreground cursor-pointer"
                              />
                            )}

                            {/* Date pickers for range mode */}
                            {gscDateMode === 'range' && (
                              <>
                                <input
                                  type="date"
                                  value={format(gscRangeStart, 'yyyy-MM-dd')}
                                  min="2020-01-01"
                                  max={format(gscRangeEnd, 'yyyy-MM-dd')}
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                    const date = new Date(y, m - 1, d);
                                    if (!isNaN(date.getTime())) setGscRangeStart(date);
                                  }}
                                  className="h-10 text-sm px-3.5 rounded-md border border-input bg-background text-foreground cursor-pointer"
                                />
                                <span className="text-sm text-muted-foreground">→</span>
                                <input
                                  type="date"
                                  value={format(gscRangeEnd, 'yyyy-MM-dd')}
                                  min={format(gscRangeStart, 'yyyy-MM-dd')}
                                  max={format(new Date(), 'yyyy-MM-dd')}
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                    const date = new Date(y, m - 1, d);
                                    if (!isNaN(date.getTime())) setGscRangeEnd(date);
                                  }}
                                  className="h-10 text-sm px-3.5 rounded-md border border-input bg-background text-foreground cursor-pointer"
                                />
                              </>
                            )}

                            {/* Granularity toggle */}
                            <div className="flex rounded-lg border bg-muted p-0.5 text-sm ml-auto">
                              {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                                <button
                                  key={g}
                                  className={cn("px-3 py-2 rounded-md transition-colors", gscGranularity === g && "bg-background shadow-sm font-medium")}
                                  onClick={() => setGscGranularity(g)}
                                >
                                  {g === 'daily' ? (language === 'fr' ? 'Jour' : language === 'es' ? 'Día' : 'Day') 
                                    : g === 'weekly' ? (language === 'fr' ? 'Sem.' : language === 'es' ? 'Sem.' : 'Week')
                                    : (language === 'fr' ? 'Mois' : language === 'es' ? 'Mes' : 'Month')}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* GSC KPI summary */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border bg-card p-3 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MousePointerClick className="h-3 w-3" />
                                {language === 'fr' ? 'Clics' : 'Clicks'}
                              </div>
                              <p className="text-lg font-semibold text-primary">{gscData.total_clicks.toLocaleString()}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Eye className="h-3 w-3" />
                                Impressions
                              </div>
                              <p className="text-lg font-semibold text-accent-foreground">{gscData.total_impressions.toLocaleString()}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <TrendingUp className="h-3 w-3" />
                                {language === 'fr' ? 'Position moy.' : 'Avg. position'}
                              </div>
                              <p className="text-lg font-semibold">{gscData.avg_position.toFixed(1)}</p>
                            </div>
                          </div>

                          {/* GSC Chart */}
                          {(() => {
                            const chartRows = gscAggregatedRows.map(row => ({
                              date: gscGranularity === 'monthly' ? row.date : row.date.slice(5),
                              rawDate: row.date,
                              clicks: row.clicks,
                              impressions: row.impressions,
                              position: typeof row.position === 'number' ? parseFloat(row.position.toFixed(1)) : 0,
                            }));

                            return (
                              <div className="h-[18.5rem] w-[108%] -ml-[2%]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={chartRows} margin={{ left: 0, right: 40, top: 5, bottom: 5 }}>
                                    <defs>
                                      <linearGradient id="gscClicksStroke" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                                        <stop offset="100%" stopColor="hsl(var(--primary))" />
                                      </linearGradient>
                                      <linearGradient id="gscClicksFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                      </linearGradient>
                                      <linearGradient id="gscImpStroke" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="hsl(262, 83%, 58%)" />
                                        <stop offset="100%" stopColor="hsl(262, 83%, 58%)" />
                                      </linearGradient>
                                      <linearGradient id="gscImpFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                                      </linearGradient>
                                      <linearGradient id="gscPosStroke" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="hsl(25, 95%, 53%)" />
                                        <stop offset="100%" stopColor="hsl(25, 95%, 53%)" />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="date" className="text-xs" interval="preserveStartEnd" tick={false} />
                                    <YAxis yAxisId="left" className="text-xs" tick={{ fontSize: 10 }} />
                                    <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fontSize: 10 }} reversed domain={[0, 'auto']} />
                                    <Tooltip 
                                      contentStyle={{ 
                                        borderRadius: '8px', 
                                        fontSize: '12px',
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                      }} 
                                    />
                                    <Legend 
                                      formatter={(value: string) => (
                                        <span style={{ color: 'hsl(var(--foreground))', fontSize: 18 }}>{value}</span>
                                      )}
                                      payload={[
                                        { value: language === 'fr' ? 'Clics' : 'Clicks', type: 'line', color: 'hsl(var(--primary))' },
                                        { value: 'Impressions', type: 'line', color: 'hsl(262, 83%, 58%)' },
                                        { value: language === 'fr' ? 'Position moy.' : 'Avg. Position', type: 'line', color: 'hsl(25, 95%, 53%)' },
                                      ]}
                                    />
                                    <Area yAxisId="left" type="monotone" dataKey="clicks" name={language === 'fr' ? 'Clics' : 'Clicks'} stroke="url(#gscClicksStroke)" fill="url(#gscClicksFill)" strokeWidth={2} />
                                    <Area yAxisId="left" type="monotone" dataKey="impressions" name="Impressions" stroke="url(#gscImpStroke)" fill="url(#gscImpFill)" strokeWidth={2} />
                                    <Line yAxisId="right" type="monotone" dataKey="position" name={language === 'fr' ? 'Position moy.' : 'Avg. Position'} stroke="url(#gscPosStroke)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                          <p>{language === 'fr' ? 'Aucune donnée Search Console disponible pour ce site.' : 'No Search Console data available for this site.'}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* SERP Ranking Banner (DataForSEO) */}
                  <SerpKpiBanner 
                    data={latestSerpData}
                    previousIndexedPages={previousIndexedPages}
                    onRefresh={async () => {
                      if (!currentSite || !user || refreshingSerp) return;
                      setRefreshingSerp(true);
                      try {
                        const response = await supabase.functions.invoke('fetch-serp-kpis', {
                          body: { domain: currentSite.domain, url: `https://${currentSite.domain}` },
                        });
                        
                        let serpData = response.data?.data;
                        
                        // Fallback: if the API call failed or returned no data, query serp_snapshots silently
                        if (response.error || !serpData) {
                          console.warn('[SERP refresh] API failed, falling back to serp_snapshots');
                          const { data: snapshot } = await supabase
                            .from('serp_snapshots')
                            .select('*')
                            .eq('tracked_site_id', currentSite.id)
                            .order('measured_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                          
                          if (snapshot) {
                            serpData = {
                              total_keywords: snapshot.total_keywords,
                              avg_position: snapshot.avg_position,
                              homepage_position: snapshot.homepage_position,
                              top_3: snapshot.top_3,
                              top_10: snapshot.top_10,
                              top_50: snapshot.top_50,
                              etv: snapshot.etv,
                              indexed_pages: snapshot.indexed_pages,
                              sample_keywords: snapshot.sample_keywords,
                              measured_at: snapshot.measured_at,
                            };
                          }
                        }

                        if (!serpData) {
                          // Still nothing — stay silent, no error toast
                          return;
                        }
                        
                        const existingRaw = (latestStats as any)?.raw_data || {};
                        await supabase.from('user_stats_history').insert({
                          tracked_site_id: currentSite.id,
                          user_id: user.id,
                          domain: currentSite.domain,
                          seo_score: latestStats?.seo_score ?? null,
                          geo_score: latestStats?.geo_score ?? null,
                          llm_citation_rate: latestStats?.llm_citation_rate ?? null,
                          ai_sentiment: latestStats?.ai_sentiment ?? null,
                          semantic_authority: latestStats?.semantic_authority ?? null,
                          voice_share: latestStats?.voice_share ?? null,
                          raw_data: { ...existingRaw, serpData },
                        });
                        await fetchStats();
                        toast.success(language === 'fr' ? 'Données SERP mises à jour' : 'SERP data updated');
                      } catch (err) {
                        // Silent fallback on total failure — try serp_snapshots one last time
                        console.warn('[SERP refresh] Error, attempting serp_snapshots fallback:', err);
                        try {
                          const { data: snapshot } = await supabase
                            .from('serp_snapshots')
                            .select('*')
                            .eq('tracked_site_id', currentSite!.id)
                            .order('measured_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                          if (snapshot) {
                            const serpData = {
                              total_keywords: snapshot.total_keywords,
                              avg_position: snapshot.avg_position,
                              homepage_position: snapshot.homepage_position,
                              top_3: snapshot.top_3,
                              top_10: snapshot.top_10,
                              top_50: snapshot.top_50,
                              etv: snapshot.etv,
                              indexed_pages: snapshot.indexed_pages,
                              sample_keywords: snapshot.sample_keywords,
                              measured_at: snapshot.measured_at,
                            };
                            const existingRaw = (latestStats as any)?.raw_data || {};
                            await supabase.from('user_stats_history').insert({
                              tracked_site_id: currentSite!.id,
                              user_id: user!.id,
                              domain: currentSite!.domain,
                              seo_score: latestStats?.seo_score ?? null,
                              geo_score: latestStats?.geo_score ?? null,
                              llm_citation_rate: latestStats?.llm_citation_rate ?? null,
                              ai_sentiment: latestStats?.ai_sentiment ?? null,
                              semantic_authority: latestStats?.semantic_authority ?? null,
                              voice_share: latestStats?.voice_share ?? null,
                              raw_data: { ...existingRaw, serpData },
                            });
                            await fetchStats();
                          }
                        } catch (_) { /* truly silent */ }
                      } finally {
                        setRefreshingSerp(false);
                      }
                    }}
                    isRefreshing={refreshingSerp}
                  />

                  {/* IAS — Indice d'Alignement Stratégique */}
                  {currentSite && user && gscConnected && (
                    <IASCard
                      trackedSiteId={currentSite.id}
                      userId={user.id}
                      domain={currentSite.domain}
                      isPremium={isAgencyPro || isAdmin}
                      onUpgrade={() => navigate('/tarifs')}
                    />
                  )}

                   {/* LLM Visibility Dashboard */}
                   {currentSite && user && (
                    <LLMVisibilityDashboard
                      trackedSiteId={currentSite.id}
                      userId={user.id}
                      domain={currentSite.domain}
                    />
                  )}

                  {/* LLM Depth Card – Pro Agency, collaborators & admins */}
                  {currentSite && (isAgencyPro || isCollaborator || isAdmin) && (
                    <LLMDepthCard
                      key={currentSite.id}
                      domain={currentSite.domain}
                      trackedSiteId={currentSite.id}
                      userId={user?.id}
                      siteContext={{
                        market_sector: currentSite.market_sector || undefined,
                        products_services: currentSite.products_services || undefined,
                        target_audience: currentSite.target_audience || undefined,
                        address: currentSite.address || undefined,
                        commercial_area: currentSite.commercial_area || undefined,
                        company_size: currentSite.company_size || undefined,
                      }}
                    />
                   )}

                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Site Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5" />
              {t.addSite}
            </DialogTitle>
            <DialogDescription>{t.addSiteDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t.urlPlaceholder}
                value={newUrl}
                onChange={e => {
                  setNewUrl(e.target.value);
                  setValidationResult({ valid: false, checked: false });
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (!validationResult.checked) handleValidateUrl();
                    else if (validationResult.valid) handleAddSite();
                  }
                }}
                className={cn(
                  validationResult.checked && validationResult.valid && 'border-green-500 focus-visible:ring-green-500',
                  validationResult.checked && !validationResult.valid && !validationResult.suggestion && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {!validationResult.checked && (
                <Button
                  variant="secondary"
                  onClick={handleValidateUrl}
                  disabled={validating || !newUrl.trim()}
                  className="gap-2 shrink-0"
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {language === 'fr' ? 'Vérifier' : 'Verify'}
                </Button>
              )}
            </div>

            {/* Validation feedback */}
            {validationResult.checked && validationResult.valid && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {language === 'fr' ? 'URL validée ✓' : 'URL validated ✓'}
              </div>
            )}

            {validationResult.checked && !validationResult.valid && validationResult.suggestion && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  {language === 'fr' ? 'URL inaccessible. Suggestion trouvée :' : 'URL unreachable. Suggestion found:'}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                    {validationResult.suggestion}
                  </code>
                  <Button size="sm" onClick={handleAcceptSuggestion} className="gap-1.5 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {language === 'fr' ? 'Utiliser' : 'Use'}
                  </Button>
                </div>
              </div>
            )}

            {validationResult.checked && !validationResult.valid && !validationResult.suggestion && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {language === 'fr' ? 'URL inaccessible. Vérifiez l\'adresse.' : 'URL unreachable. Check the address.'}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setValidationResult({ valid: true, checked: true })}
                  className="text-xs text-muted-foreground"
                >
                  {language === 'fr' ? 'Ignorer et ajouter quand même' : 'Ignore and add anyway'}
                </Button>
              </div>
            )}

            <div className="flex justify-center">
              <Button
                onClick={handleAddSite}
                disabled={adding || !newUrl.trim() || validating || (!validationResult.checked)}
                className="gap-2"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {adding ? t.adding : t.add}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Site Connection Modal (WordPress + GTM) */}
      <Dialog open={showWpModal} onOpenChange={setShowWpModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {(() => {
            const wpSite = sites.find(s => s.id === wpConnectSiteId);
            if (!wpSite) return null;
            return (
              <WordPressConfigCard
                siteId={wpSite.id}
                siteDomain={wpSite.domain}
                siteApiKey={profile?.api_key || wpSite.api_key || ''}
                hasConfig={!!(wpSite.current_config && Object.keys(wpSite.current_config).length > 0)}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Architect Modal */}
      {(() => {
        const archSite = sites.find(s => s.id === architectSiteId);
        if (!archSite) return null;
        return (
          <SmartConfigurator
            isOpen={isArchitectOpen}
            onClose={() => {
              setIsArchitectOpen(false);
              setArchitectSiteId(null);
            }}
            technicalResult={null}
            strategicResult={null}
            siteUrl={`https://${archSite.domain}`}
            siteName={archSite.site_name || archSite.domain}
            activeSiteId={archSite.id}
          />
        );
      })()}
    </div>
  );
}


function KPICard({ label, value, icon: Icon, valueClassName, onRefresh }: { label: string; value: string; icon: ElementType; valueClassName?: string; onRefresh?: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  return (
    <div className="relative group rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`text-lg font-semibold ${valueClassName || ''}`}>{value}</p>
      {onRefresh && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted disabled:opacity-50"
          aria-label="Actualiser"
        >
          <RefreshCw className={cn("h-3 w-3 text-muted-foreground", refreshing && "animate-spin")} />
        </button>
      )}
    </div>
  );
}

function SortableKPIGrid({ kpiDefinitions, defaultOrder, disabled, onRefresh }: {
  kpiDefinitions: Record<string, { label: string; value: string; icon: ElementType; valueClassName?: string }>;
  defaultOrder: string[];
  disabled: boolean;
  onRefresh?: Record<string, () => Promise<void>>;
}) {
  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {defaultOrder.map(id => {
            const def = kpiDefinitions[id];
            if (!def) return null;
            return (
              <KPICard
                key={id}
                label={def.label}
                value={def.value}
                icon={def.icon}
                valueClassName={def.valueClassName}
                onRefresh={onRefresh?.[id]}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
