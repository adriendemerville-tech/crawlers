import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useObservatoryStats } from '@/hooks/useObservatoryStats';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Code2, Timer, AlertTriangle, TrendingUp, TrendingDown,
  BarChart3, Activity, Map, FileText, Share2, Twitter,
  Link2, Globe, ShieldCheck, Smartphone, MonitorSmartphone,
  Box, Network, Image, ImageOff, Palette, FileCode,
  Gauge, Zap, LayoutDashboard, MousePointerClick
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// ─── Translations ──────────────────────────────────────────
const translations = {
  fr: {
    title: "L'Observatoire du Web Français",
    subtitle: "Données agrégées et anonymisées issues des analyses effectuées sur Crawlers.fr. Statistiques mises à jour en temps réel à chaque nouveau scan.",
    badge: "Données en temps réel",
    totalScans: "scans analysés",
    seoSection: "Standards SEO",
    socialSection: "Réseaux sociaux & i18n",
    securitySection: "Sécurité & Mobile",
    perfSection: "Performance",
    assetsSection: "Ressources & Assets",
    chartTitle: "Évolution des métriques de performance",
    chartSubtitle: "Moyenne mensuelle sur les 6 derniers mois (en ms)",
    noData: "Les données apparaîtront ici dès les premiers scans.",
    // Boolean KPIs
    has_json_ld: "JSON-LD",
    has_sitemap: "Sitemap.xml",
    has_robots_txt: "Robots.txt",
    has_meta_description: "Meta Description",
    has_open_graph: "Open Graph",
    has_twitter_cards: "Twitter Cards",
    has_canonical: "Canonical",
    has_hreflang: "Hreflang",
    has_https: "HTTPS",
    is_mobile_friendly: "Mobile-friendly",
    has_viewport_meta: "Viewport Meta",
    // Numeric KPIs
    load_time_ms: "Temps de chargement",
    error_404_count: "Erreurs 404 / site",
    dom_size_kb: "Taille DOM",
    total_requests: "Requêtes HTTP",
    image_count: "Images / page",
    images_without_alt: "Images sans Alt",
    css_files_count: "Fichiers CSS",
    js_files_count: "Fichiers JS",
    ttfb_ms: "TTFB",
    fcp_ms: "FCP",
    lcp_ms: "LCP",
    cls_score: "CLS (×1000)",
  },
  en: {
    title: "The French Web Observatory",
    subtitle: "Aggregated and anonymized data from analyses performed on Crawlers.fr. Statistics updated in real time with each new scan.",
    badge: "Real-time data",
    totalScans: "scans analyzed",
    seoSection: "SEO Standards",
    socialSection: "Social & i18n",
    securitySection: "Security & Mobile",
    perfSection: "Performance",
    assetsSection: "Resources & Assets",
    chartTitle: "Performance metrics evolution",
    chartSubtitle: "Monthly average over the last 6 months (in ms)",
    noData: "Data will appear here after the first scans.",
    has_json_ld: "JSON-LD", has_sitemap: "Sitemap.xml", has_robots_txt: "Robots.txt",
    has_meta_description: "Meta Description", has_open_graph: "Open Graph",
    has_twitter_cards: "Twitter Cards", has_canonical: "Canonical", has_hreflang: "Hreflang",
    has_https: "HTTPS", is_mobile_friendly: "Mobile-friendly", has_viewport_meta: "Viewport Meta",
    load_time_ms: "Load Time", error_404_count: "404 Errors / site", dom_size_kb: "DOM Size",
    total_requests: "HTTP Requests", image_count: "Images / page", images_without_alt: "Images without Alt",
    css_files_count: "CSS Files", js_files_count: "JS Files", ttfb_ms: "TTFB", fcp_ms: "FCP",
    lcp_ms: "LCP", cls_score: "CLS (×1000)",
  },
  es: {
    title: "El Observatorio del Web Francés",
    subtitle: "Datos agregados y anonimizados de los análisis realizados en Crawlers.fr. Estadísticas actualizadas en tiempo real con cada nuevo escaneo.",
    badge: "Datos en tiempo real",
    totalScans: "escaneos analizados",
    seoSection: "Estándares SEO",
    socialSection: "Redes sociales e i18n",
    securitySection: "Seguridad y Móvil",
    perfSection: "Rendimiento",
    assetsSection: "Recursos y Assets",
    chartTitle: "Evolución de las métricas de rendimiento",
    chartSubtitle: "Promedio mensual en los últimos 6 meses (en ms)",
    noData: "Los datos aparecerán aquí tras los primeros escaneos.",
    has_json_ld: "JSON-LD", has_sitemap: "Sitemap.xml", has_robots_txt: "Robots.txt",
    has_meta_description: "Meta Description", has_open_graph: "Open Graph",
    has_twitter_cards: "Twitter Cards", has_canonical: "Canonical", has_hreflang: "Hreflang",
    has_https: "HTTPS", is_mobile_friendly: "Mobile-friendly", has_viewport_meta: "Viewport Meta",
    load_time_ms: "Tiempo de carga", error_404_count: "Errores 404 / sitio", dom_size_kb: "Tamaño DOM",
    total_requests: "Solicitudes HTTP", image_count: "Imágenes / página", images_without_alt: "Imágenes sin Alt",
    css_files_count: "Archivos CSS", js_files_count: "Archivos JS", ttfb_ms: "TTFB", fcp_ms: "FCP",
    lcp_ms: "LCP", cls_score: "CLS (×1000)",
  },
};

// ─── Icon & style maps ──────────────────────────────────────
const booleanIcons: Record<string, any> = {
  has_json_ld: Code2, has_sitemap: Map, has_robots_txt: FileText,
  has_meta_description: FileText, has_open_graph: Share2,
  has_twitter_cards: Twitter, has_canonical: Link2, has_hreflang: Globe,
  has_https: ShieldCheck, is_mobile_friendly: Smartphone, has_viewport_meta: MonitorSmartphone,
};

const numericIcons: Record<string, any> = {
  load_time_ms: Timer, error_404_count: AlertTriangle, dom_size_kb: Box,
  total_requests: Network, image_count: Image, images_without_alt: ImageOff,
  css_files_count: Palette, js_files_count: FileCode,
  ttfb_ms: Zap, fcp_ms: Gauge, lcp_ms: LayoutDashboard, cls_score: MousePointerClick,
};

const numericUnits: Record<string, string> = {
  load_time_ms: 'ms', ttfb_ms: 'ms', fcp_ms: 'ms', lcp_ms: 'ms',
  dom_size_kb: 'KB', cls_score: '',
  error_404_count: '', total_requests: '', image_count: '', images_without_alt: '',
  css_files_count: '', js_files_count: '',
};

// ─── Components ──────────────────────────────────────────────
const TrendBadge = ({ value }: { value: number }) => {
  if (value === 0) return null;
  const pos = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{value}%
    </span>
  );
};

interface BoolCardProps { field: string; percent: number; trend: number; label: string }
const BoolCard = ({ field, percent, trend, label }: BoolCardProps) => {
  const Icon = booleanIcons[field] || Code2;
  const good = percent >= 60;
  return (
    <Card className="shadow-sm border-border/50 bg-card hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${good ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
          <Icon className={`h-4 w-4 ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <div className="flex items-end gap-1.5">
            <span className="text-xl font-bold text-foreground">{percent}%</span>
            <TrendBadge value={trend} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface NumCardProps { field: string; avg: number; trend: number; label: string }
const NumCard = ({ field, avg, trend, label }: NumCardProps) => {
  const Icon = numericIcons[field] || Timer;
  const unit = numericUnits[field] || '';
  const display = unit === 'ms' && avg >= 1000 ? `${(avg / 1000).toFixed(1)}s` : `${avg}${unit ? ' ' + unit : ''}`;
  return (
    <Card className="shadow-sm border-border/50 bg-card hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg p-2 bg-violet-100 dark:bg-violet-900/30">
          <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <div className="flex items-end gap-1.5">
            <span className="text-xl font-bold text-foreground">{display}</span>
            <TrendBadge value={trend} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold text-foreground mb-3 mt-8 first:mt-0">{children}</h2>
);

// ─── Page ────────────────────────────────────────────────────
const Observatoire = () => {
  const { language } = useLanguage();
  const t = translations[language];
  const stats = useObservatoryStats();

  useCanonicalHreflang('/observatoire');

  const metaTitle = language === 'fr' ? "Observatoire du Web Français - Statistiques SEO en temps réel | Crawlers.fr"
    : language === 'es' ? "Observatorio del Web - Estadísticas SEO en tiempo real | Crawlers.fr"
    : "French Web Observatory - Real-time SEO Statistics | Crawlers.fr";
  const metaDesc = language === 'fr' ? "Données agrégées de milliers d'audits SEO : taux d'adoption JSON-LD, HTTPS, Core Web Vitals. Statistiques en temps réel du web français."
    : language === 'es' ? "Datos agregados de miles de auditorías SEO: adopción JSON-LD, HTTPS, Core Web Vitals. Estadísticas en tiempo real."
    : "Aggregated data from thousands of SEO audits: JSON-LD adoption, HTTPS, Core Web Vitals. Real-time French web statistics.";

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": t.title,
      "description": metaDesc,
      "url": "https://crawlers.fr/observatoire",
      "creator": { "@type": "Organization", "name": "Crawlers.fr" },
      "temporalCoverage": "2025/..",
      "license": "https://creativecommons.org/licenses/by-nc/4.0/",
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'observatoire');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => { document.querySelectorAll('script[data-schema="observatoire"]').forEach(el => el.remove()); };
  }, [language, t.title, metaDesc]);

  const seoFields = ['has_json_ld', 'has_sitemap', 'has_robots_txt', 'has_meta_description', 'has_canonical'] as const;
  const socialFields = ['has_open_graph', 'has_twitter_cards', 'has_hreflang'] as const;
  const securityFields = ['has_https', 'is_mobile_friendly', 'has_viewport_meta'] as const;
  const perfFields = ['load_time_ms', 'ttfb_ms', 'fcp_ms', 'lcp_ms', 'cls_score'] as const;
  const assetsFields = ['dom_size_kb', 'total_requests', 'image_count', 'images_without_alt', 'css_files_count', 'js_files_count', 'error_404_count'] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content="https://crawlers.fr/observatoire" />
      </Helmet>
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
        <section className="container mx-auto max-w-6xl px-4 py-10">
          {stats.loading ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* SEO Standards */}
              <SectionTitle>{t.seoSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {seoFields.map(f => (
                  <BoolCard key={f} field={f} percent={stats.booleanKpis[f].percent} trend={stats.booleanKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              {/* Social & i18n */}
              <SectionTitle>{t.socialSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {socialFields.map(f => (
                  <BoolCard key={f} field={f} percent={stats.booleanKpis[f].percent} trend={stats.booleanKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              {/* Security & Mobile */}
              <SectionTitle>{t.securitySection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {securityFields.map(f => (
                  <BoolCard key={f} field={f} percent={stats.booleanKpis[f].percent} trend={stats.booleanKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              {/* Performance */}
              <SectionTitle>{t.perfSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {perfFields.map(f => (
                  <NumCard key={f} field={f} avg={stats.numericKpis[f].avg} trend={stats.numericKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              {/* Assets */}
              <SectionTitle>{t.assetsSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {assetsFields.map(f => (
                  <NumCard key={f} field={f} avg={stats.numericKpis[f].avg} trend={stats.numericKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Chart */}
        <section className="container mx-auto max-w-6xl px-4 pb-12 md:pb-16">
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
                <Skeleton className="h-72 w-full" />
              ) : stats.monthlyData.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-muted-foreground text-sm">
                  {t.noData}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={stats.monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gTtfb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gFcp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLcp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { avgLoadTime: 'Load Time', avgTtfb: 'TTFB', avgFcp: 'FCP', avgLcp: 'LCP' };
                        return [`${value} ms`, labels[name] || name];
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="avgLoadTime" name="Load Time" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gLoad)" />
                    <Area type="monotone" dataKey="avgTtfb" name="TTFB" stroke="#f59e0b" strokeWidth={2} fill="url(#gTtfb)" />
                    <Area type="monotone" dataKey="avgFcp" name="FCP" stroke="#10b981" strokeWidth={2} fill="url(#gFcp)" />
                    <Area type="monotone" dataKey="avgLcp" name="LCP" stroke="#ef4444" strokeWidth={2} fill="url(#gLcp)" />
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
