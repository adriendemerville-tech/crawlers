import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Users, FileText, CreditCard, TrendingUp, Activity, Calendar, AlertCircle } from 'lucide-react';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, BarChart, Bar, CartesianGrid } from 'recharts';

interface DashboardStats {
  totalUsers: number;
  totalReports: number;
  totalCredits: number;
  totalTransactions: number;
  recentSignups: Array<{ date: string; count: number }>;
  reportsByType: Array<{ type: string; count: number }>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorFallback({ error }: { error: string }) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-destructive font-medium">Erreur de chargement</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Essayez de rafraîchir la page.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Simple KPI Card component - inline to avoid external dependency issues
function KPICard({ 
  icon: Icon, 
  label, 
  value, 
  description 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  value: number; 
  description: string; 
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground/80">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all stats in parallel with individual error handling
        const [usersResult, reportsResult, transactionsResult, signupsResult, reportTypesResult] = await Promise.allSettled([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('saved_reports').select('id', { count: 'exact', head: true }),
          supabase.from('credit_transactions').select('amount').gt('amount', 0),
          supabase.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('saved_reports').select('report_type')
        ]);

        if (!mounted) return;

        // Extract values safely
        const totalUsers = usersResult.status === 'fulfilled' ? (usersResult.value.count ?? 0) : 0;
        const totalReports = reportsResult.status === 'fulfilled' ? (reportsResult.value.count ?? 0) : 0;
        
        let totalCredits = 0;
        let totalTransactions = 0;
        if (transactionsResult.status === 'fulfilled' && transactionsResult.value.data) {
          totalTransactions = transactionsResult.value.data.length;
          totalCredits = transactionsResult.value.data.reduce((sum, t) => sum + (t.amount || 0), 0);
        }

        // Process signups by date
        const recentSignups: Array<{ date: string; count: number }> = [];
        if (signupsResult.status === 'fulfilled' && signupsResult.value.data) {
          const signupsByDate = new Map<string, number>();
          signupsResult.value.data.forEach((profile) => {
            const date = new Date(profile.created_at).toLocaleDateString('fr-FR', { 
              day: '2-digit', 
              month: '2-digit' 
            });
            signupsByDate.set(date, (signupsByDate.get(date) || 0) + 1);
          });
          signupsByDate.forEach((count, date) => {
            recentSignups.push({ date, count });
          });
        }

        // Process reports by type
        const reportsByType: Array<{ type: string; count: number }> = [];
        if (reportTypesResult.status === 'fulfilled' && reportTypesResult.value.data) {
          const typeMap = new Map<string, number>();
          reportTypesResult.value.data.forEach((report) => {
            const type = report.report_type || 'unknown';
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
          });
          typeMap.forEach((count, type) => {
            const label = getReportTypeLabel(type);
            reportsByType.push({ type: label, count });
          });
        }

        setStats({
          totalUsers,
          totalReports,
          totalCredits,
          totalTransactions,
          recentSignups,
          reportsByType
        });
      } catch (err) {
        if (mounted) {
          console.error('Analytics fetch error:', err);
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <ErrorFallback error={error} />;
  }

  if (loading || !stats) {
    return <LoadingSkeleton />;
  }

  const chartConfig = {
    count: {
      label: "Inscriptions",
      color: "hsl(var(--primary))",
    },
  };

  const barChartConfig = {
    count: {
      label: "Rapports",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Users}
          label="Utilisateurs"
          value={stats.totalUsers}
          description="Total inscrits"
        />
        <KPICard
          icon={FileText}
          label="Rapports"
          value={stats.totalReports}
          description="Rapports sauvegardés"
        />
        <KPICard
          icon={CreditCard}
          label="Crédits achetés"
          value={stats.totalCredits}
          description={`${stats.totalTransactions} transactions`}
        />
        <KPICard
          icon={Activity}
          label="Activité"
          value={stats.recentSignups.length}
          description="Jours actifs (30j)"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Signups Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Inscriptions (30 jours)
            </CardTitle>
            <CardDescription>
              Nouvelles inscriptions par jour
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentSignups.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <AreaChart data={stats.recentSignups} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Aucune inscription récente
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reports by Type Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Rapports par type
            </CardTitle>
            <CardDescription>
              Distribution des rapports sauvegardés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.reportsByType.length > 0 ? (
              <ChartContainer config={barChartConfig} className="h-[200px] w-full">
                <BarChart data={stats.reportsByType} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="type" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Aucun rapport sauvegardé
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getReportTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'seo_technical': 'SEO Tech',
    'seo_strategic': 'SEO Strat',
    'llm': 'LLM',
    'geo': 'GEO',
    'pagespeed': 'PageSpeed',
    'crawlers': 'Crawlers'
  };
  return labels[type] || type;
}
