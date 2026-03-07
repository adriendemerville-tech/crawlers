import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useObservatoryStats } from '@/hooks/useObservatoryStats';
import { useLanguage } from '@/contexts/LanguageContext';
import { Code2, Timer, AlertTriangle, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const translations = {
  fr: {
    title: "L'Observatoire du Web Français",
    subtitle: "Données agrégées et anonymisées issues des analyses effectuées sur Crawlers.fr. Statistiques mises à jour en temps réel à chaque nouveau scan.",
    badge: "Données en temps réel",
    jsonLd: "Sites utilisant JSON-LD",
    loadTime: "Temps de chargement moyen",
    errors404: "Erreurs 404 rencontrées",
    chartTitle: "Évolution du temps de chargement moyen",
    chartSubtitle: "Moyenne mensuelle sur les 6 derniers mois (en ms)",
    thisMonth: "ce mois",
    totalScans: "scans analysés",
    noData: "Les données apparaîtront ici dès les premiers scans.",
  },
  en: {
    title: "The French Web Observatory",
    subtitle: "Aggregated and anonymized data from analyses performed on Crawlers.fr. Statistics updated in real time with each new scan.",
    badge: "Real-time data",
    jsonLd: "Sites using JSON-LD",
    loadTime: "Average load time",
    errors404: "404 errors encountered",
    chartTitle: "Average load time evolution",
    chartSubtitle: "Monthly average over the last 6 months (in ms)",
    thisMonth: "this month",
    totalScans: "scans analyzed",
    noData: "Data will appear here after the first scans.",
  },
  es: {
    title: "El Observatorio del Web Francés",
    subtitle: "Datos agregados y anonimizados de los análisis realizados en Crawlers.fr. Estadísticas actualizadas en tiempo real con cada nuevo escaneo.",
    badge: "Datos en tiempo real",
    jsonLd: "Sitios con JSON-LD",
    loadTime: "Tiempo de carga promedio",
    errors404: "Errores 404 encontrados",
    chartTitle: "Evolución del tiempo de carga promedio",
    chartSubtitle: "Promedio mensual en los últimos 6 meses (en ms)",
    thisMonth: "este mes",
    totalScans: "escaneos analizados",
    noData: "Los datos aparecerán aquí tras los primeros escaneos.",
  },
};

const TrendBadge = ({ value }: { value: number }) => {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{value}%
    </span>
  );
};

const Observatoire = () => {
  const { language } = useLanguage();
  const t = translations[language];
  const stats = useObservatoryStats();

  const kpis = [
    {
      title: t.jsonLd,
      value: `${stats.jsonLdPercent}%`,
      icon: Code2,
      trend: stats.trends.jsonLd,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-100 dark:bg-violet-900/30',
    },
    {
      title: t.loadTime,
      value: `${(stats.avgLoadTimeMs / 1000).toFixed(1)}s`,
      icon: Timer,
      trend: stats.trends.loadTime,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      title: t.errors404,
      value: `${stats.error404Percent}%`,
      icon: AlertTriangle,
      trend: stats.trends.error404,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-violet-50 via-background to-amber-50 dark:from-violet-950/20 dark:via-background dark:to-amber-950/20 py-16 md:py-24">
          <div className="container mx-auto max-w-5xl px-4 text-center">
            <Badge variant="secondary" className="mb-4 gap-1.5 px-3 py-1 text-xs font-medium">
              <Activity className="h-3 w-3" />
              {t.badge}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-base md:text-lg">
              {t.subtitle}
            </p>
            {stats.totalScans > 0 && (
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                <span className="text-foreground font-bold">{stats.totalScans.toLocaleString()}</span> {t.totalScans}
              </p>
            )}
          </div>
        </section>

        {/* KPIs */}
        <section className="container mx-auto max-w-5xl px-4 -mt-8 relative z-10">
          <div className="grid gap-4 sm:grid-cols-3">
            {kpis.map((kpi, i) => (
              <Card key={i} className="shadow-lg border-border/50 bg-card">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`rounded-lg p-2.5 ${kpi.bg}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-foreground">{kpi.value}</span>
                      <TrendBadge value={kpi.trend} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Chart */}
        <section className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t.chartTitle}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">{t.chartSubtitle}</p>
            </CardHeader>
            <CardContent>
              {stats.loading ? (
                <Skeleton className="h-64 w-full" />
              ) : stats.monthlyData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
                  {t.noData}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={stats.monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="loadTimeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} unit="ms" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number) => [`${value} ms`, 'Temps moyen']}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgLoadTime"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#loadTimeGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Observatoire;
