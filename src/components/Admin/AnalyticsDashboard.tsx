import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart3, 
  MousePointer, 
  FileText, 
  Search, 
  AlertTriangle,
  TrendingUp,
  Eye,
  UserPlus,
  ShieldCheck,
  CheckCircle,
  Globe,
  ExternalLink,
  RefreshCw,
  Cpu,
  Zap,
  Brain,
  Flame,
  Swords,
  ScanSearch,
  Coins,
  CreditCard,
  Users,
  HardDrive
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// IPs et user_ids à exclure des statistiques
const EXCLUDED_IPS = ['5.49.156.158'];
const ADMIN_EMAIL = 'adriendemerville@gmail.com';

interface AnalyticsStats {
  totalVisits: number;
  signupClicks: number;
  signupCompleted: number;
  reportClicks: number;
  freeAnalysisCrawlers: number;
  expertAuditLaunched: number;
  expertAuditStep1: number;
  expertAuditStep2: number;
  expertAuditStep3: number;
  errorCount: number;
  auditCompareLaunched: number;
  multiPageCrawls: number;
  cocoonGenerated: number;
  cocoonChatSessions: number;
}




interface DailyData {
  date: string;
  visits: number;
  signups: number;
}

interface PageVisit {
  url: string;
  count: number;
}

interface AnalyzedUrl {
  id: string;
  url: string;
  domain: string;
  analysis_count: number;
  first_analyzed_at: string;
  last_analyzed_at: string;
}

interface ErrorEvent {
  id: string;
  created_at: string;
  url: string | null;
  user_id: string | null;
  user_email: string | null;
  function_name: string | null;
  error_message: string | null;
  error_response: string | null;
}

// Intervalle de rafraîchissement automatique (1 heure en ms)
const AUTO_REFRESH_INTERVAL = 60 * 60 * 1000;

export function AnalyticsDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  const [stats, setStats] = useState<AnalyticsStats>({
    totalVisits: 0,
    signupClicks: 0,
    signupCompleted: 0,
    reportClicks: 0,
    freeAnalysisCrawlers: 0,
    expertAuditLaunched: 0,
    expertAuditStep1: 0,
    expertAuditStep2: 0,
    expertAuditStep3: 0,
    errorCount: 0,
    auditCompareLaunched: 0,
    multiPageCrawls: 0,
    cocoonGenerated: 0,
    cocoonChatSessions: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topPages, setTopPages] = useState<PageVisit[]>([]);
  const [analyzedUrlsCount, setAnalyzedUrlsCount] = useState(0);
  const [analyzedUrls, setAnalyzedUrls] = useState<AnalyzedUrl[]>([]);
  const [showAllUrls, setShowAllUrls] = useState(false);
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);
  const [errorEvents, setErrorEvents] = useState<ErrorEvent[]>([]);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reliabilityScore, setReliabilityScore] = useState<{ score: number; audits: number; predictions: number } | null>(null);



  // Initial load
  useEffect(() => {
    setIsMounted(true);
    fetchAnalytics();
  }, []);

  // Auto-refresh every hour
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAnalytics(true);
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  const fetchAnalytics = useCallback(async (isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // Récupérer les user_ids des admins à exclure
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', ADMIN_EMAIL);
      
      const adminUserIds = adminProfiles?.map(p => p.user_id) || [];
      setExcludedUserIds(adminUserIds);

      // Limite aux 30 derniers jours pour éviter la surcharge mémoire
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      // Fetch ALL events des 30 derniers jours avec pagination (contourne la limite 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let allEvents: Array<{ event_type: string; url: string | null; created_at: string; user_id: string | null; event_data: Record<string, unknown> | null }> = [];
      const PAGE_SIZE = 1000;
      let currentPage = 0;
      while (true) {
        const { data: rawPage, error: pageError } = await supabase
          .from('analytics_events')
          .select('event_type, url, created_at, user_id, event_data')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
        
        if (pageError) throw pageError;
        if (!rawPage || rawPage.length === 0) break;
        allEvents = allEvents.concat(rawPage as typeof allEvents);
        if (rawPage.length < PAGE_SIZE) break;
        currentPage++;
      }

      console.log(`📊 Analytics: ${allEvents.length} événements chargés (${currentPage + 1} pages)`);


      // Filtrer les événements des admins et des IPs exclues
      const events = allEvents?.filter(e => {
        // Exclure les admins
        if (e.user_id && adminUserIds.includes(e.user_id)) return false;
        
        // Exclure les IPs spécifiées (stockées dans event_data)
        const eventData = e.event_data as Record<string, unknown> | null;
        if (eventData?.ip && EXCLUDED_IPS.includes(eventData.ip as string)) return false;
        
        return true;
      }) || [];

      // Fetch real signup count from profiles (30 days, excluding admins)
      const { count: realSignupCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo)
        .not('user_id', 'in', `(${adminUserIds.join(',')})`);

      // Calculate stats
      const newStats: AnalyticsStats = {
        totalVisits: events.filter(e => e.event_type === 'page_view').length,
        signupClicks: events.filter(e => e.event_type === 'signup_click').length,
        signupCompleted: realSignupCount || 0,
        reportClicks: events.filter(e => e.event_type === 'report_button_click').length,
        freeAnalysisCrawlers: events.filter(e => e.event_type === 'free_analysis_crawlers').length,
        expertAuditLaunched: events.filter(e => e.event_type === 'expert_audit_launched').length,
        expertAuditStep1: events.filter(e => e.event_type === 'expert_audit_step_1').length,
        expertAuditStep2: events.filter(e => e.event_type === 'expert_audit_step_2').length,
        expertAuditStep3: events.filter(e => e.event_type === 'expert_audit_step_3').length,
        errorCount: events.filter(e => e.event_type === 'error' || e.event_type === 'scan_error' || e.event_type === 'scan_error_final' || e.event_type === 'edge_function_error').length,
        auditCompareLaunched: events.filter(e => e.event_type === 'audit_compare_launched').length,
        multiPageCrawls: 0,
        cocoonGenerated: 0,
        cocoonChatSessions: 0,
      };

      // Count multi-page crawls from site_crawls table (30 days)
      const { count: crawlsCount } = await supabase
        .from('site_crawls')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo);
      newStats.multiPageCrawls = crawlsCount || 0;

      // Count cocoon sessions generated (30 days)
      const { count: cocoonCount } = await (supabase.from as any)('cocoon_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo);
      newStats.cocoonGenerated = cocoonCount || 0;

      // Count cocoon chat conversations (30 days)
      const { count: chatCount } = await (supabase.from as any)('cocoon_chat_histories')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo);
      newStats.cocoonChatSessions = chatCount || 0;

      setStats(newStats);



      // Calculate daily data (last 30 days)
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return format(date, 'yyyy-MM-dd');
      });

      // Fetch real signups from profiles table (reliable source vs analytics events)
      const { data: profileSignups } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo)
        .not('user_id', 'in', `(${adminUserIds.join(',')})`)
        .order('created_at', { ascending: false });

      const signupsByDay: Record<string, number> = {};
      (profileSignups || []).forEach(p => {
        const day = format(parseISO(p.created_at), 'yyyy-MM-dd');
        signupsByDay[day] = (signupsByDay[day] || 0) + 1;
      });

      const dailyStats = last30Days.map(date => {
        const dayEvents = events.filter(e => 
          e.created_at && format(parseISO(e.created_at), 'yyyy-MM-dd') === date
        );
        
        return {
          date: format(parseISO(date), 'dd MMM', { locale: fr }),
          visits: dayEvents.filter(e => e.event_type === 'page_view').length,
          signups: signupsByDay[date] || 0,
        };
      });
      setDailyData(dailyStats);

      // Calculate top pages
      const pageVisits = events.filter(e => e.event_type === 'page_view' && e.url);
      const pageCounts: Record<string, number> = {};
      pageVisits.forEach(e => {
        if (e.url) {
          pageCounts[e.url] = (pageCounts[e.url] || 0) + 1;
        }
      });
      
      const sortedPages = Object.entries(pageCounts)
        .map(([url, count]) => ({ url, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopPages(sortedPages);

      // Fetch analyzed URLs — exclude domains from tracked_sites (automatic monitoring scans)
      const { data: trackedSites } = await supabase
        .from('tracked_sites')
        .select('domain');
      const trackedDomains = new Set((trackedSites || []).map(s => s.domain?.toLowerCase()).filter(Boolean));

      const { data: urlsDataRaw } = await supabase
        .from('analyzed_urls')
        .select('*')
        .order('last_analyzed_at', { ascending: false })
        .limit(500);

      const filteredUrls = (urlsDataRaw || []).filter(u => !trackedDomains.has(u.domain?.toLowerCase()));
      setAnalyzedUrlsCount(filteredUrls.length);
      setAnalyzedUrls(filteredUrls.slice(0, 100));

      // Fetch error events with user emails
      const errorEventsRaw = events.filter(e => e.event_type === 'error' || e.event_type === 'scan_error' || e.event_type === 'scan_error_final' || e.event_type === 'edge_function_error');
      
      // Get unique user_ids from error events
      const errorUserIds = [...new Set(errorEventsRaw
        .filter(e => e.user_id)
        .map(e => e.user_id as string))];
      
      // Fetch emails for these users
      let userEmailMap: Record<string, string> = {};
      if (errorUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', errorUserIds);
        
        if (profilesData) {
          userEmailMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = p.email;
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      // Build error events with enriched data
      const enrichedErrors: ErrorEvent[] = errorEventsRaw.map(e => {
        const eventData = e.event_data as Record<string, unknown> | null;
        const isScanError = e.event_type === 'scan_error' || e.event_type === 'scan_error_final';
        const isEdgeFnError = e.event_type === 'edge_function_error';
        return {
          id: crypto.randomUUID(),
          created_at: e.created_at,
          url: e.url,
          user_id: e.user_id,
          user_email: e.user_id ? userEmailMap[e.user_id] || null : null,
          function_name: isEdgeFnError
            ? `⚡ ${(eventData?.function_name as string) || 'unknown'}`
            : isScanError
              ? `scan:${(eventData?.tab as string) || 'unknown'}`
              : (eventData?.function_name as string) || (eventData?.source as string) || null,
          error_message: (eventData?.message as string) || (eventData?.error_message as string) || null,
          error_response: (eventData?.error_response as string) || (eventData?.response as string) || (eventData?.details as string) || null,
        };
      });
      
      setErrorEvents(enrichedErrors);

      // Fetch system reliability metrics
      const { data: metricsData } = await supabase
        .from('system_metrics')
        .select('current_reliability_score, total_audits_processed, total_predictions_made')
        .limit(1)
        .maybeSingle();
      
      if (metricsData) {
        setReliabilityScore({
          score: metricsData.current_reliability_score,
          audits: metricsData.total_audits_processed,
          predictions: metricsData.total_predictions_made,
        });
      }

      // Fetch database size
      try {
        const { data: sizeData } = await supabase.rpc('get_database_size');
        if (sizeData) setDbSize(sizeData as any);
      } catch {}

      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    variant = 'default'
  }: { 
    title: string; 
    value: number; 
    icon: React.ElementType; 
    description?: string;
    variant?: 'default' | 'success' | 'warning' | 'error';
  }) => {
    const variantStyles = {
      default: 'text-primary',
      success: 'text-emerald-500',
      warning: 'text-amber-500',
      error: 'text-destructive',
    };

    return (
      <Card className="py-0">
        <CardHeader className="flex flex-row items-center justify-between px-2.5 py-1.5 pb-0.5">
          <CardTitle className="text-[10px] font-medium text-muted-foreground truncate">
            {title}
          </CardTitle>
          <Icon className={`h-3 w-3 shrink-0 ${variantStyles[variant]}`} />
        </CardHeader>
        <CardContent className="px-2.5 py-1.5 pt-0">
          <div className="text-sm font-bold">{value.toLocaleString('fr-FR')}</div>
          {description && (
            <p className="text-[9px] text-muted-foreground leading-tight">{description}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  // Protection contre l'hydratation SSR pour Recharts
  if (!isMounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="animate-pulse space-y-1.5">
                  <div className="h-3 w-16 bg-muted rounded" />
                  <div className="h-5 w-12 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Dashboard Statistiques</h3>
            <p className="text-sm text-muted-foreground">
              Activité des 30 derniers jours
              {lastUpdated && (
                <span className="ml-2 text-xs">
                  • Mis à jour {format(lastUpdated, 'HH:mm', { locale: fr })}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAnalytics(true)}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Actualisation...' : 'Actualiser'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatCard 
          title="Visites totales" 
          value={stats.totalVisits} 
          icon={Eye}
          description="Toutes les pages"
        />
        <StatCard 
          title="Clics inscription" 
          value={stats.signupClicks} 
          icon={MousePointer}
        />
        <StatCard 
          title="Inscriptions complètes" 
          value={stats.signupCompleted} 
          icon={UserPlus}
          variant="success"
        />
        <StatCard 
          title="Clics rapport" 
          value={stats.reportClicks} 
          icon={FileText}
        />
        <StatCard 
          title="Analyses gratuites" 
          value={stats.freeAnalysisCrawlers} 
          icon={Search}
          description="Crawlers.fr"
        />
        <StatCard 
          title="Audits expert lancés" 
          value={stats.expertAuditLaunched} 
          icon={TrendingUp}
        />
        <StatCard 
          title="Audits complétés" 
          value={stats.expertAuditStep3} 
          icon={CheckCircle}
          variant="success"
          description={`Étape 1: ${stats.expertAuditStep1} | 2: ${stats.expertAuditStep2} | 3: ${stats.expertAuditStep3}`}
        />
        <StatCard 
          title="Erreurs" 
          value={stats.errorCount} 
          icon={AlertTriangle}
          variant={stats.errorCount > 0 ? 'error' : 'default'}
        />
        <StatCard 
          title="Audits comparés" 
          value={stats.auditCompareLaunched} 
          icon={Swords}
          description="Analyses face-à-face"
        />
        <StatCard 
          title="Crawls multi-pages" 
          value={stats.multiPageCrawls} 
          icon={ScanSearch}
          description="Sites entiers analysés"
        />
        <StatCard 
          title="Cocoons générés" 
          value={stats.cocoonGenerated} 
          icon={Globe}
          description="Graphes sémantiques"
        />
        <StatCard 
          title="Discussions Assistant" 
          value={stats.cocoonChatSessions} 
          icon={Brain}
          description="Conversations IA Cocoon"
        />
      </div>


      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Visits Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visites par jour
            </CardTitle>
            <CardDescription>30 derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="visits" 
                    name="Visites"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Signups Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Inscriptions par jour
            </CardTitle>
            <CardDescription>30 derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="signups" 
                    name="Inscriptions"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pages les plus visitées
          </CardTitle>
          <CardDescription>Classement par nombre de visites</CardDescription>
        </CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune donnée disponible</p>
          ) : (
            <div className="space-y-3">
              {topPages.map((page, index) => (
                <div 
                  key={page.url} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="font-mono text-sm truncate max-w-[300px]">
                      {page.url || '/'}
                    </span>
                  </div>
                  <span className="font-semibold text-primary">
                    {page.count.toLocaleString('fr-FR')} visites
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>




      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Registre des erreurs ({errorEvents.length})
              </CardTitle>
              <CardDescription>
                Erreurs utilisateurs + Edge Functions (30 derniers jours)
                {errorEvents.filter(e => e.function_name?.startsWith('⚡')).length > 0 && (
                  <span className="ml-2 text-amber-500 font-medium">
                    dont {errorEvents.filter(e => e.function_name?.startsWith('⚡')).length} backend
                  </span>
                )}
              </CardDescription>
            </div>
            {errorEvents.length > 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllErrors(!showAllErrors)}
              >
                {showAllErrors ? 'Voir moins' : `Voir tout (${errorEvents.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {errorEvents.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <CheckCircle className="h-4 w-4 text-primary" />
              Aucune erreur enregistrée sur cette période
            </div>
          ) : (
            <ScrollArea className={showAllErrors ? 'h-[500px]' : 'h-auto'}>
              <div className="space-y-3">
                {(showAllErrors ? errorEvents : errorEvents.slice(0, 10)).map((error) => (
                  <div 
                    key={error.id} 
                    className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2"
                  >
                    {/* Header: Date et email */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(error.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                      </span>
                      {error.user_email ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {error.user_email}
                        </span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          Utilisateur anonyme
                        </span>
                      )}
                    </div>
                    
                    {/* Page */}
                    {error.url && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground min-w-[60px]">Page :</span>
                        <span className="text-xs font-mono text-foreground break-all">{error.url}</span>
                      </div>
                    )}
                    
                    {/* Fonction */}
                    {error.function_name && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground min-w-[60px]">Fonction :</span>
                        <span className="text-xs font-mono text-accent-foreground">{error.function_name}</span>
                      </div>
                    )}
                    
                    {/* Message d'erreur */}
                    {error.error_message && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground min-w-[60px]">Erreur :</span>
                        <span className="text-xs text-destructive break-all">{error.error_message}</span>
                      </div>
                    )}
                    
                    {/* Réponse d'erreur */}
                    {error.error_response && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground min-w-[60px]">Réponse :</span>
                        <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-w-full flex-1">
                          {error.error_response.length > 300 
                            ? error.error_response.substring(0, 300) + '...' 
                            : error.error_response}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Info filtrage */}
      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center">
            ℹ️ Les données des administrateurs et de l'IP {EXCLUDED_IPS.join(', ')} sont exclues des statistiques
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
