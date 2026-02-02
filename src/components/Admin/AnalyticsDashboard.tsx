import { useState, useEffect } from 'react';
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
  CheckCircle
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
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topPages, setTopPages] = useState<PageVisit[]>([]);
  const [analyzedUrlsCount, setAnalyzedUrlsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Limite aux 30 derniers jours pour éviter la surcharge mémoire
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      // Fetch events des 30 derniers jours seulement
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('event_type, url, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const newStats: AnalyticsStats = {
        totalVisits: events?.filter(e => e.event_type === 'page_view').length || 0,
        signupClicks: events?.filter(e => e.event_type === 'signup_click').length || 0,
        signupCompleted: events?.filter(e => e.event_type === 'signup_complete').length || 0,
        reportClicks: events?.filter(e => e.event_type === 'report_button_click').length || 0,
        freeAnalysisCrawlers: events?.filter(e => e.event_type === 'free_analysis_crawlers').length || 0,
        expertAuditLaunched: events?.filter(e => e.event_type === 'expert_audit_launched').length || 0,
        expertAuditStep1: events?.filter(e => e.event_type === 'expert_audit_step_1').length || 0,
        expertAuditStep2: events?.filter(e => e.event_type === 'expert_audit_step_2').length || 0,
        expertAuditStep3: events?.filter(e => e.event_type === 'expert_audit_step_3').length || 0,
        errorCount: events?.filter(e => e.event_type === 'error').length || 0,
      };
      setStats(newStats);

      // Calculate daily data (last 30 days)
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return format(date, 'yyyy-MM-dd');
      });

      const dailyStats = last30Days.map(date => {
        const dayEvents = events?.filter(e => 
          e.created_at && format(parseISO(e.created_at), 'yyyy-MM-dd') === date
        ) || [];
        
        return {
          date: format(parseISO(date), 'dd MMM', { locale: fr }),
          visits: dayEvents.filter(e => e.event_type === 'page_view').length,
          signups: dayEvents.filter(e => e.event_type === 'signup_complete').length,
        };
      });
      setDailyData(dailyStats);

      // Calculate top pages
      const pageVisits = events?.filter(e => e.event_type === 'page_view' && e.url) || [];
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

      // Fetch analyzed URLs count
      const { count: urlsCount } = await supabase
        .from('analyzed_urls')
        .select('*', { count: 'exact', head: true });
      setAnalyzedUrlsCount(urlsCount || 0);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value.toLocaleString('fr-FR')}</div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
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
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-20 bg-muted rounded" />
                  <div className="h-8 w-16 bg-muted rounded" />
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Dashboard Statistiques</h3>
          <p className="text-sm text-muted-foreground">Activité des 30 derniers jours</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      {/* URLs analysées */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">URLs analysées uniques</CardTitle>
              <CardDescription>Sites distincts analysés par les utilisateurs</CardDescription>
            </div>
            <div className="text-3xl font-bold text-primary">
              {analyzedUrlsCount.toLocaleString('fr-FR')}
            </div>
          </div>
        </CardHeader>
      </Card>

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
    </div>
  );
}
