import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useObservatoryStats } from '@/hooks/useObservatoryStats';
import { useObservatorySectors } from '@/hooks/useObservatorySectors';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Code2, Timer, AlertTriangle, TrendingUp, TrendingDown,
  BarChart3, Activity, Map, FileText, Share2, Twitter,
  Link2, Globe, ShieldCheck, Smartphone, MonitorSmartphone,
  Box, Network, Image, ImageOff, Palette, FileCode,
  Gauge, Zap, LayoutDashboard, MousePointerClick,
  BookOpen, FlaskConical, HelpCircle, ArrowRight, Layers, PieChart
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar } from 'recharts';

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
    has_json_ld: "JSON-LD", has_sitemap: "Sitemap.xml", has_robots_txt: "Robots.txt",
    has_meta_description: "Meta Description", has_open_graph: "Open Graph",
    has_twitter_cards: "Twitter Cards", has_canonical: "Canonical", has_hreflang: "Hreflang",
    has_https: "HTTPS", is_mobile_friendly: "Mobile-friendly", has_viewport_meta: "Viewport Meta",
    load_time_ms: "Temps de chargement", error_404_count: "Erreurs 404 / site", dom_size_kb: "Taille DOM",
    total_requests: "Requêtes HTTP", image_count: "Images / page", images_without_alt: "Images sans Alt",
    css_files_count: "Fichiers CSS", js_files_count: "Fichiers JS", ttfb_ms: "TTFB", fcp_ms: "FCP",
    lcp_ms: "LCP", cls_score: "CLS (×1000)",
    introTitle: "Pourquoi un observatoire du web français ?",
    introP1: "L'Observatoire du Web Français est le premier tableau de bord open-data dédié à la santé technique SEO et GEO des sites web francophones. Il agrège en temps réel les résultats de milliers d'audits réalisés via Crawlers.fr pour offrir une photographie fidèle de l'état du web français.",
    introP2: "À l'ère des moteurs de recherche génératifs (Google SGE, ChatGPT Search, Perplexity), la qualité technique d'un site détermine directement sa visibilité dans les réponses des LLM. Notre observatoire mesure les signaux fondamentaux : données structurées JSON-LD, Core Web Vitals, compatibilité mobile, sécurité HTTPS et protocoles d'internationalisation.",
    introP3: "Ces métriques permettent aux professionnels du SEO, agences et développeurs de comparer la performance de leurs sites aux moyennes nationales et d'identifier rapidement les axes d'amélioration prioritaires pour le référencement classique et le référencement IA (GEO).",
    methodTitle: "Méthodologie de collecte",
    methodP1: "Chaque scan effectué sur Crawlers.fr alimente automatiquement l'observatoire. Les données sont anonymisées : aucune URL, aucun domaine ni information personnelle n'est conservé. Seuls les indicateurs techniques bruts sont agrégés.",
    methodP2: "Les tendances sont calculées sur des fenêtres glissantes de 30 jours. Un score de fraîcheur pondère les données récentes pour refléter l'évolution réelle des pratiques web, pas seulement un instantané historique.",
    methodP3: "Les Core Web Vitals (TTFB, FCP, LCP, CLS) sont mesurés via l'API Google PageSpeed Insights, garantissant une cohérence avec les données utilisées par Google pour le classement.",
    faqTitle: "Questions fréquentes",
    faq: [
      { q: "Quelles données sont collectées par l'observatoire ?", a: "L'observatoire collecte uniquement des métriques techniques anonymisées : présence de JSON-LD, sitemap, robots.txt, meta description, Open Graph, HTTPS, compatibilité mobile, Core Web Vitals (TTFB, FCP, LCP, CLS), nombre de ressources et erreurs 404. Aucune donnée personnelle ni URL n'est conservée." },
      { q: "À quelle fréquence les statistiques sont-elles mises à jour ?", a: "Les statistiques sont mises à jour en temps réel. Chaque nouvel audit effectué sur Crawlers.fr enrichit automatiquement l'observatoire. Les tendances mensuelles sont recalculées quotidiennement." },
      { q: "Comment sont calculées les tendances ?", a: "Les tendances comparent les 30 derniers jours à la période précédente de 30 jours. Un pourcentage positif indique une amélioration (pour les taux d'adoption) ou une augmentation (pour les métriques de performance)." },
      { q: "L'observatoire est-il pertinent pour le GEO (Generative Engine Optimization) ?", a: "Absolument. Les signaux mesurés — JSON-LD, données structurées, HTTPS, vitesse de chargement — sont exactement ceux que les LLM (ChatGPT, Gemini, Perplexity) utilisent pour évaluer la fiabilité d'une source. Un site conforme aux standards mesurés ici a plus de chances d'être cité dans les réponses génératives." },
      { q: "Comment utiliser ces données pour améliorer mon référencement ?", a: "Comparez vos propres métriques (obtenues via l'audit expert Crawlers.fr) aux moyennes nationales affichées ici. Si votre taux d'adoption JSON-LD est inférieur à la moyenne, c'est un axe prioritaire. Si vos Core Web Vitals dépassent les moyennes, concentrez-vous sur l'optimisation de la performance." },
    ],
    ctaTitle: "Comparez votre site aux moyennes nationales",
    ctaDesc: "Lancez un audit SEO & GEO expert gratuit et découvrez où vous vous situez par rapport au web français.",
    ctaButton: "Lancer mon audit gratuit",
    sectorTitle: "Veille sectorielle",
    sectorSubtitle: "Benchmarks par secteur d'activité — données agrégées et anonymisées",
    sectorFilter: "Filtrer par secteur",
    sectorAll: "Tous les secteurs",
    sectorScans: "audits analysés",
    sectorNoData: "Aucune donnée sectorielle disponible. Les données apparaîtront après les prochaines agrégations.",
    sectorTrendTitle: "Évolution par secteur",
    sectorRadarTitle: "Radar SEO par secteur",
    sectorBenchmarkTitle: "Benchmarks sectoriels",
    sectorMetrics: {
      json_ld_rate: "JSON-LD", schema_org_rate: "Schema.org", https_rate: "HTTPS",
      mobile_friendly_rate: "Mobile", canonical_rate: "Canonical", meta_description_rate: "Meta Desc",
      avg_seo_score: "Score SEO", avg_lcp_ms: "LCP (ms)", avg_ttfb_ms: "TTFB (ms)",
    },
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
    introTitle: "Why a French web observatory?",
    introP1: "The French Web Observatory is the first open-data dashboard dedicated to the technical SEO and GEO health of French-speaking websites. It aggregates real-time results from thousands of audits performed on Crawlers.fr to offer an accurate snapshot of the French web.",
    introP2: "In the era of generative search engines (Google SGE, ChatGPT Search, Perplexity), a site's technical quality directly determines its visibility in LLM responses. Our observatory measures fundamental signals: JSON-LD structured data, Core Web Vitals, mobile compatibility, HTTPS security and internationalization protocols.",
    introP3: "These metrics allow SEO professionals, agencies and developers to benchmark their sites against national averages and quickly identify priority areas for improvement in both classic SEO and AI referencing (GEO).",
    methodTitle: "Data collection methodology",
    methodP1: "Each scan performed on Crawlers.fr automatically feeds the observatory. Data is anonymized: no URL, domain or personal information is retained. Only raw technical indicators are aggregated.",
    methodP2: "Trends are calculated over 30-day sliding windows. A freshness score weights recent data to reflect the actual evolution of web practices, not just a historical snapshot.",
    methodP3: "Core Web Vitals (TTFB, FCP, LCP, CLS) are measured via the Google PageSpeed Insights API, ensuring consistency with the data Google uses for ranking.",
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "What data does the observatory collect?", a: "The observatory only collects anonymized technical metrics: JSON-LD presence, sitemap, robots.txt, meta description, Open Graph, HTTPS, mobile compatibility, Core Web Vitals (TTFB, FCP, LCP, CLS), resource count and 404 errors. No personal data or URLs are stored." },
      { q: "How often are the statistics updated?", a: "Statistics are updated in real time. Each new audit on Crawlers.fr automatically enriches the observatory. Monthly trends are recalculated daily." },
      { q: "How are trends calculated?", a: "Trends compare the last 30 days to the previous 30-day period. A positive percentage indicates improvement (for adoption rates) or increase (for performance metrics)." },
      { q: "Is the observatory relevant for GEO (Generative Engine Optimization)?", a: "Absolutely. The measured signals — JSON-LD, structured data, HTTPS, loading speed — are exactly those that LLMs (ChatGPT, Gemini, Perplexity) use to evaluate source reliability. A site compliant with the standards measured here is more likely to be cited in generative responses." },
      { q: "How can I use this data to improve my SEO?", a: "Compare your own metrics (obtained via the Crawlers.fr expert audit) to the national averages shown here. If your JSON-LD adoption rate is below average, it's a priority. If your Core Web Vitals exceed averages, focus on performance optimization." },
    ],
    ctaTitle: "Benchmark your site against national averages",
    ctaDesc: "Run a free expert SEO & GEO audit and discover where you stand compared to the French web.",
    ctaButton: "Start my free audit",
    sectorTitle: "Sector Watch",
    sectorSubtitle: "Benchmarks by industry — aggregated and anonymized data",
    sectorFilter: "Filter by sector",
    sectorAll: "All sectors",
    sectorScans: "audits analyzed",
    sectorNoData: "No sectoral data available yet. Data will appear after the next aggregation.",
    sectorTrendTitle: "Sector trends",
    sectorRadarTitle: "SEO Radar by sector",
    sectorBenchmarkTitle: "Sector benchmarks",
    sectorMetrics: {
      json_ld_rate: "JSON-LD", schema_org_rate: "Schema.org", https_rate: "HTTPS",
      mobile_friendly_rate: "Mobile", canonical_rate: "Canonical", meta_description_rate: "Meta Desc",
      avg_seo_score: "SEO Score", avg_lcp_ms: "LCP (ms)", avg_ttfb_ms: "TTFB (ms)",
    },
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
    introTitle: "¿Por qué un observatorio del web francés?",
    introP1: "El Observatorio del Web Francés es el primer panel open-data dedicado a la salud técnica SEO y GEO de los sitios web francófonos. Agrega en tiempo real los resultados de miles de auditorías realizadas en Crawlers.fr para ofrecer una fotografía fiel del estado del web francés.",
    introP2: "En la era de los motores de búsqueda generativos (Google SGE, ChatGPT Search, Perplexity), la calidad técnica de un sitio determina directamente su visibilidad en las respuestas de los LLM. Nuestro observatorio mide las señales fundamentales: datos estructurados JSON-LD, Core Web Vitals, compatibilidad móvil, seguridad HTTPS y protocolos de internacionalización.",
    introP3: "Estas métricas permiten a los profesionales del SEO, agencias y desarrolladores comparar el rendimiento de sus sitios con los promedios nacionales e identificar rápidamente los ejes de mejora prioritarios para el SEO clásico y el referenciamiento IA (GEO).",
    methodTitle: "Metodología de recopilación",
    methodP1: "Cada escaneo realizado en Crawlers.fr alimenta automáticamente el observatorio. Los datos son anonimizados: no se conserva ninguna URL, dominio ni información personal. Solo se agregan los indicadores técnicos brutos.",
    methodP2: "Las tendencias se calculan sobre ventanas deslizantes de 30 días. Un índice de frescura pondera los datos recientes para reflejar la evolución real de las prácticas web.",
    methodP3: "Los Core Web Vitals (TTFB, FCP, LCP, CLS) se miden a través de la API Google PageSpeed Insights, garantizando coherencia con los datos que Google usa para el posicionamiento.",
    faqTitle: "Preguntas frecuentes",
    faq: [
      { q: "¿Qué datos recopila el observatorio?", a: "El observatorio solo recopila métricas técnicas anonimizadas: presencia de JSON-LD, sitemap, robots.txt, meta description, Open Graph, HTTPS, compatibilidad móvil, Core Web Vitals, número de recursos y errores 404. No se almacenan datos personales ni URLs." },
      { q: "¿Con qué frecuencia se actualizan las estadísticas?", a: "Las estadísticas se actualizan en tiempo real. Cada nueva auditoría en Crawlers.fr enriquece automáticamente el observatorio." },
      { q: "¿Cómo se calculan las tendencias?", a: "Las tendencias comparan los últimos 30 días con el período anterior de 30 días. Un porcentaje positivo indica mejora o aumento." },
      { q: "¿Es relevante el observatorio para el GEO?", a: "Absolutamente. Las señales medidas — JSON-LD, HTTPS, velocidad — son exactamente las que los LLM usan para evaluar la fiabilidad de una fuente." },
      { q: "¿Cómo usar estos datos para mejorar mi SEO?", a: "Compare sus métricas propias con los promedios nacionales aquí mostrados para identificar prioridades." },
    ],
    ctaTitle: "Compare su sitio con los promedios nacionales",
    ctaDesc: "Lance una auditoría SEO & GEO experta gratuita y descubra su posición frente al web francés.",
    ctaButton: "Iniciar mi auditoría gratuita",
    sectorTitle: "Vigilancia sectorial",
    sectorSubtitle: "Benchmarks por sector — datos agregados y anonimizados",
    sectorFilter: "Filtrar por sector",
    sectorAll: "Todos los sectores",
    sectorScans: "auditorías analizadas",
    sectorNoData: "No hay datos sectoriales disponibles. Aparecerán tras la próxima agregación.",
    sectorTrendTitle: "Evolución por sector",
    sectorRadarTitle: "Radar SEO por sector",
    sectorBenchmarkTitle: "Benchmarks sectoriales",
    sectorMetrics: {
      json_ld_rate: "JSON-LD", schema_org_rate: "Schema.org", https_rate: "HTTPS",
      mobile_friendly_rate: "Móvil", canonical_rate: "Canonical", meta_description_rate: "Meta Desc",
      avg_seo_score: "Score SEO", avg_lcp_ms: "LCP (ms)", avg_ttfb_ms: "TTFB (ms)",
    },
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

// ─── Sub-components ─────────────────────────────────────────
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

const SectionTitle = ({ icon: Icon, children }: { icon?: any; children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold text-foreground mb-3 mt-8 first:mt-0 flex items-center gap-2">
    {Icon && <Icon className="h-5 w-5 text-primary" />}
    {children}
  </h2>
);

// ─── Page ────────────────────────────────────────────────────
const Observatoire = () => {
  const { language } = useLanguage();
  const t = translations[language];
  const stats = useObservatoryStats();
  const sectorData = useObservatorySectors();
  const [selectedSector, setSelectedSector] = useState<string>('all');

  useCanonicalHreflang('/observatoire');

  const metaTitle = language === 'fr'
    ? "Observatoire SEO & GEO du Web Français – Statistiques Temps Réel 2026"
    : language === 'es'
    ? "Observatorio SEO & GEO del Web Francés – Estadísticas 2026"
    : "French Web SEO & GEO Observatory – Real-Time Statistics 2026";

  const metaDesc = language === 'fr'
    ? "Tableau de bord open-data des statistiques SEO et GEO du web français : adoption JSON-LD, Core Web Vitals, HTTPS, compatibilité mobile. Données anonymisées en temps réel issues de milliers d'audits Crawlers.fr."
    : language === 'es'
    ? "Panel open-data de estadísticas SEO y GEO del web francés: adopción JSON-LD, Core Web Vitals, HTTPS, compatibilidad móvil. Datos anonimizados en tiempo real."
    : "Open-data dashboard of French web SEO & GEO statistics: JSON-LD adoption, Core Web Vitals, HTTPS, mobile compatibility. Real-time anonymized data from thousands of Crawlers.fr audits.";

  // JSON-LD: Dataset + FAQPage
  useEffect(() => {
    const datasetSchema = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": t.title,
      "description": metaDesc,
      "url": "https://crawlers.fr/observatoire",
      "creator": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
      "temporalCoverage": "2025/..",
      "license": "https://creativecommons.org/licenses/by-nc/4.0/",
      "keywords": ["SEO", "GEO", "Core Web Vitals", "JSON-LD", "HTTPS", "web français", "statistiques", "observatoire", "audit technique", "Generative Engine Optimization"],
      "measurementTechnique": "Automated crawl via Crawlers.fr platform + Google PageSpeed Insights API",
      "variableMeasured": [
        { "@type": "PropertyValue", "name": "JSON-LD adoption rate", "unitText": "percent" },
        { "@type": "PropertyValue", "name": "HTTPS adoption rate", "unitText": "percent" },
        { "@type": "PropertyValue", "name": "Largest Contentful Paint (LCP)", "unitText": "milliseconds" },
        { "@type": "PropertyValue", "name": "First Contentful Paint (FCP)", "unitText": "milliseconds" },
        { "@type": "PropertyValue", "name": "Time To First Byte (TTFB)", "unitText": "milliseconds" },
        { "@type": "PropertyValue", "name": "Cumulative Layout Shift (CLS)", "unitText": "score" },
      ],
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": t.faq.map(item => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": { "@type": "Answer", "text": item.a },
      })),
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home', "item": "https://crawlers.fr/" },
        { "@type": "ListItem", "position": 2, "name": t.title, "item": "https://crawlers.fr/observatoire" },
      ],
    };

    const schemas = [
      { id: 'observatoire-dataset', data: datasetSchema },
      { id: 'observatoire-faq', data: faqSchema },
      { id: 'observatoire-breadcrumb', data: breadcrumbSchema },
    ];

    schemas.forEach(({ id, data }) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-schema', id);
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    return () => {
      schemas.forEach(({ id }) => {
        document.querySelectorAll(`script[data-schema="${id}"]`).forEach(el => el.remove());
      });
    };
  }, [language, t.title, t.faq, metaDesc]);

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
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta name="googlebot" content="index, follow, max-image-preview:large" />
        <meta name="bingbot" content="index, follow" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content="https://crawlers.fr/observatoire" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <meta name="twitter:site" content="@crawlersfr" />

        {/* Author & geo */}
        <meta name="author" content="Crawlers.fr" />
        <meta name="geo.region" content="FR" />
        <meta name="geo.placename" content="France" />
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

        {/* Editorial introduction */}
        <section className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
          <div className="flex items-start gap-3 mb-6">
            <div className="rounded-lg p-2 bg-primary/10 mt-0.5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">{t.introTitle}</h2>
            </div>
          </div>
          <div className="prose prose-slate dark:prose-invert max-w-none prose-p:text-muted-foreground prose-p:leading-relaxed">
            <p>{t.introP1}</p>
            <p>{t.introP2}</p>
            <p>{t.introP3}</p>
          </div>
        </section>

        {/* KPIs */}
        <section className="container mx-auto max-w-6xl px-4 py-10" aria-label="KPI dashboard">
          {stats.loading ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : (
            <>
              <SectionTitle>{t.seoSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {seoFields.map(f => (
                  <BoolCard key={f} field={f} percent={stats.booleanKpis[f].percent} trend={stats.booleanKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              <SectionTitle>{t.socialSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {socialFields.map(f => (
                  <BoolCard key={f} field={f} percent={stats.booleanKpis[f].percent} trend={stats.booleanKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              <SectionTitle>{t.securitySection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {securityFields.map(f => (
                  <BoolCard key={f} field={f} percent={stats.booleanKpis[f].percent} trend={stats.booleanKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

              <SectionTitle>{t.perfSection}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {perfFields.map(f => (
                  <NumCard key={f} field={f} avg={stats.numericKpis[f].avg} trend={stats.numericKpis[f].trend} label={(t as any)[f]} />
                ))}
              </div>

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

        {/* ═══ SECTORAL WATCH ═══ */}
        <section className="container mx-auto max-w-6xl px-4 py-12 md:py-16" aria-label="Sectoral benchmarks">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2 bg-primary/10 mt-0.5">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{t.sectorTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t.sectorSubtitle}</p>
              </div>
            </div>
            {sectorData.sectorNames.length > 0 && (
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t.sectorFilter} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.sectorAll}</SelectItem>
                  {sectorData.sectorNames.map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {sectorData.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : sectorData.sectors.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                {t.sectorNoData}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Sector benchmark cards */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  {t.sectorBenchmarkTitle}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const filtered = selectedSector === 'all'
                      ? sectorData.sectors
                      : sectorData.sectors.filter(s => s.sector === selectedSector);
                    // Group by sector, take latest period
                    const latestBySector = new Map<string, typeof filtered[0]>();
                    for (const row of filtered) {
                      const existing = latestBySector.get(row.sector);
                      if (!existing || row.period > existing.period) {
                        latestBySector.set(row.sector, row);
                      }
                    }
                    return Array.from(latestBySector.values()).map(row => (
                      <Card key={`${row.sector}-${row.source}`} className="border-border/50 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold capitalize">{row.sector}</CardTitle>
                            <Badge variant="secondary" className="text-xs">{row.total_scans} {t.sectorScans}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{row.period} · {row.source.replace('_', ' ')}</p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {[
                              { label: 'JSON-LD', value: row.json_ld_rate, unit: '%' },
                              { label: 'HTTPS', value: row.https_rate, unit: '%' },
                              { label: 'Schema', value: row.schema_org_rate, unit: '%' },
                              { label: 'Score SEO', value: row.avg_seo_score, unit: '' },
                              { label: 'LCP', value: row.avg_lcp_ms, unit: 'ms' },
                              { label: 'TTFB', value: row.avg_ttfb_ms, unit: 'ms' },
                            ].map((m, j) => (
                              <div key={j} className="py-1">
                                <p className="text-xs text-muted-foreground">{m.label}</p>
                                <p className="text-sm font-bold text-foreground">
                                  {m.value != null ? `${m.value}${m.unit}` : '–'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                </div>
              </div>

              {/* Radar chart */}
              {(() => {
                const radarSectors = selectedSector === 'all'
                  ? sectorData.sectorNames.slice(0, 5)
                  : [selectedSector];
                const latestPeriod = sectorData.sectors.reduce((max, s) => s.period > max ? s.period : max, '');
                const radarMetrics = ['json_ld_rate', 'schema_org_rate', 'https_rate', 'mobile_friendly_rate', 'canonical_rate', 'meta_description_rate'] as const;
                const radarData = radarMetrics.map(metric => {
                  const point: Record<string, any> = { metric: (t.sectorMetrics as any)[metric] || metric };
                  for (const sec of radarSectors) {
                    const row = sectorData.sectors.find(s => s.sector === sec && s.period === latestPeriod && s.source === 'expert_audit')
                      || sectorData.sectors.find(s => s.sector === sec && s.period === latestPeriod);
                    point[sec] = row ? (row as any)[metric] ?? 0 : 0;
                  }
                  return point;
                });
                const radarColors = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

                if (radarData.some(d => Object.keys(d).length > 1)) {
                  return (
                    <Card className="mb-8 border-border/50 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          {t.sectorRadarTitle}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={360}>
                          <RadarChart data={radarData}>
                            <PolarGrid className="stroke-border" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                            {radarSectors.map((sec, i) => (
                              <Radar key={sec} name={sec.charAt(0).toUpperCase() + sec.slice(1)} dataKey={sec}
                                stroke={radarColors[i % radarColors.length]} fill={radarColors[i % radarColors.length]}
                                fillOpacity={0.15} strokeWidth={2} />
                            ))}
                            <Legend />
                            <Tooltip contentStyle={{
                              backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                              borderRadius: '8px', color: 'hsl(var(--foreground))',
                            }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  );
                }
                return null;
              })()}

              {/* Sector trend bar chart */}
              {(() => {
                const filteredTrends = selectedSector === 'all'
                  ? sectorData.trends
                  : sectorData.trends.filter(t => t.sector === selectedSector);
                // Group by period for bar chart
                const periods = [...new Set(filteredTrends.map(t => t.period))].sort().slice(-6);
                const barData = periods.map(period => {
                  const rows = filteredTrends.filter(t => t.period === period);
                  const avg = (field: keyof typeof rows[0]) => {
                    const vals = rows.map(r => Number(r[field]) || 0);
                    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
                  };
                  return {
                    period,
                    json_ld_rate: avg('json_ld_rate'),
                    https_rate: avg('https_rate'),
                    schema_org_rate: avg('schema_org_rate'),
                    avg_seo_score: avg('avg_seo_score'),
                    scans: rows.reduce((s, r) => s + r.total_scans, 0),
                  };
                });

                if (barData.length > 0) {
                  return (
                    <Card className="border-border/50 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          {t.sectorTrendTitle}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} domain={[0, 100]} unit="%" />
                            <Tooltip contentStyle={{
                              backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                              borderRadius: '8px', color: 'hsl(var(--foreground))',
                            }} />
                            <Legend />
                            <Bar dataKey="json_ld_rate" name="JSON-LD" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="https_rate" name="HTTPS" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="schema_org_rate" name="Schema.org" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="avg_seo_score" name="Score SEO" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  );
                }
                return null;
              })()}
            </>
          )}
        </section>

        {/* Methodology */}
        <section className="bg-muted/30 border-y border-border">
          <div className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
            <div className="flex items-start gap-3 mb-6">
              <div className="rounded-lg p-2 bg-primary/10 mt-0.5">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{t.methodTitle}</h2>
            </div>
            <div className="prose prose-slate dark:prose-invert max-w-none prose-p:text-muted-foreground prose-p:leading-relaxed">
              <p>{t.methodP1}</p>
              <p>{t.methodP2}</p>
              <p>{t.methodP3}</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
          <div className="flex items-start gap-3 mb-8">
            <div className="rounded-lg p-2 bg-primary/10 mt-0.5">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t.faqTitle}</h2>
          </div>
          <div className="space-y-6">
            {t.faq.map((item, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                <summary className="cursor-pointer font-semibold text-foreground list-none flex items-center justify-between gap-2">
                  <span>{item.q}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0" />
                </summary>
                <p className="mt-3 text-muted-foreground leading-relaxed text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto max-w-3xl px-4 pb-16">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-8 md:p-10 text-center">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">{t.ctaTitle}</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">{t.ctaDesc}</p>
            <Button asChild size="lg" variant="hero">
              <Link to="/audit-expert">{t.ctaButton}</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Observatoire;
