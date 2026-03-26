import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Bug, Search, BarChart3, AlertTriangle, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2, Globe, FileText, Image, Link2, Code2, ChevronDown, ChevronUp, Sparkles, TrendingUp, Settings2, Download, GitCompare, Filter, Layers, Plus, Trash2, Hash, ShieldAlert, Crown, Star, Lock, Bot, FileCode2, FolderTree, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import microwaveDing from '@/assets/sounds/microwave-ding.mp3';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ReportPreviewModal } from '@/components/ReportPreview';
import { SiteCrawlReportData } from '@/components/ReportPreview/generators/siteCrawlHtmlGenerator';
import { HttpStatusChart } from '@/components/SiteCrawl/HttpStatusChart';
import { StrategicErrorBoundary } from '@/components/ExpertAudit/StrategicErrorBoundary';

const crawlI18n = {
  fr: {
    pageTitle: 'Crawl Multi-Pages SEO — Analysez votre site complet | Crawlers.fr',
    pageDesc: 'Analysez toutes les pages de votre site en un clic. Score SEO/200 par page, détection d\'erreurs, synthèse IA globale.',
    badge: 'Crawl Multi-Pages',
    h1_1: 'Auditez votre site',
    h1_2: 'page par page',
    subtitle: 'Crawl complet avec score SEO/200 par page, détection d\'erreurs techniques et synthèse IA globale.',
    whyTitle: 'Pourquoi auditer plusieurs pages de votre site ?',
    whyText: 'Un audit SEO mono-page ne révèle qu\'une infime partie de vos problèmes techniques. En analysant l\'ensemble de vos URLs, vous identifiez les balises manquantes, les erreurs de maillage interne, les pages orphelines et les contenus dupliqués qui freinent votre indexation.',
    scoreTitle: 'Un score SEO/200 par page, une synthèse IA globale',
    scoreText: 'Chaque page crawlée reçoit un score sur 200 points couvrant les critères techniques, sémantiques et structurels. L\'intelligence artificielle consolide ensuite ces résultats en une synthèse exploitable.',
    placeholder: 'https://votre-site.fr',
    launchBtn: 'Lancer le crawl',
    crawling: 'Crawl en cours…',
    pagesToAnalyze: 'Pages à analyser',
    unlimited: 'Illimité',
    credits: 'crédits',
    insufficientCredits: 'Crédits insuffisants. Requis :',
    available: 'disponibles :',
    mapping: 'Mapping du site…',
    queued: 'En file d\'attente…',
    analyzing: 'Synthèse IA en cours…',
    crawlingProgress: 'Analyse en cours :',
    pages: 'pages',
    pagesDiscovered: 'pages découvertes — audit lancé en arrière-plan',
    auditQueued: 'pages découvertes — audit en file d\'attente…',
    auditDone: 'Audit terminé :',
    pagesAnalyzed: 'pages analysées !',
    viewReport: 'Voir le rapport',
    pagesAnalyzedLabel: 'Pages analysées',
    avgScore: 'Score moyen',
    perfectPages: 'Pages parfaites',
    totalErrors: 'Erreurs totales',
    aiSummary: 'Synthèse IA',
    priorityRecs: 'Recommandations prioritaires',
    pagesAffected: 'pages concernées',
    topErrors: 'Erreurs les plus fréquentes',
    crawledPages: 'Pages crawlées',
    sortScoreAsc: 'Score ↑ (pires d\'abord)',
    sortScoreDesc: 'Score ↓ (meilleurs)',
    sortPath: 'Chemin A→Z',
    noTitle: '(sans titre)',
    words: 'Mots:',
    imgsNoAlt: 'Imgs sans alt:',
    weight: 'Poids:',
    previousCrawls: 'Crawls précédents',
    runningCrawls: 'Crawl en cours',
    errorCrawl: 'Erreur lors du crawl',
    advancedOptions: 'Options avancées',
    crawlDepth: 'Profondeur max',
    depthUnlimited: 'Illimitée',
    depthLevel: 'Niveau',
    urlFilter: 'Filtre URL (regex)',
    urlFilterPlaceholder: '/blog/.*|/produits/.*',
    customSelectors: 'Extraction custom (CSS)',
    selectorName: 'Nom',
    selectorValue: 'Sélecteur CSS',
    addSelector: 'Ajouter',
    sitemapExport: 'Exporter Sitemap XML',
    compareCrawls: 'Comparer les crawls',
    selectCrawlA: 'Crawl A',
    selectCrawlB: 'Crawl B',
    compare: 'Comparer',
    comparisonResults: 'Résultat de la comparaison',
    newPages: 'Pages ajoutées',
    removedPages: 'Pages supprimées',
    improvedPages: 'Pages améliorées',
    degradedPages: 'Pages dégradées',
    duplicateContent: 'Contenu quasi-dupliqué',
    schemaErrors: 'Erreurs Schema.org',
  },
  en: {
    pageTitle: 'Multi-Page SEO Crawl — Analyze your full site | Crawlers.fr',
    pageDesc: 'Analyze all pages of your site in one click. SEO score/200 per page, error detection, global AI synthesis.',
    badge: 'Multi-Page Crawl',
    h1_1: 'Audit your site',
    h1_2: 'page by page',
    subtitle: 'Full crawl with SEO score/200 per page, technical error detection and global AI synthesis.',
    whyTitle: 'Why audit multiple pages of your site?',
    whyText: 'A single-page SEO audit only reveals a tiny part of your technical issues. By analyzing all your URLs, you identify missing tags, internal linking errors, orphan pages and duplicate content that hinder your indexing.',
    scoreTitle: 'A SEO/200 score per page, a global AI synthesis',
    scoreText: 'Each crawled page receives a score out of 200 points covering technical, semantic and structural criteria. AI then consolidates these results into an actionable synthesis.',
    placeholder: 'https://your-site.com',
    launchBtn: 'Launch crawl',
    crawling: 'Crawling…',
    pagesToAnalyze: 'Pages to analyze',
    unlimited: 'Unlimited',
    credits: 'credits',
    insufficientCredits: 'Insufficient credits. Required:',
    available: 'available:',
    mapping: 'Mapping site…',
    queued: 'Queued…',
    analyzing: 'AI synthesis in progress…',
    crawlingProgress: 'Analyzing:',
    pages: 'pages',
    pagesDiscovered: 'pages discovered — audit launched in background',
    auditQueued: 'pages discovered — audit queued…',
    auditDone: 'Audit complete:',
    pagesAnalyzed: 'pages analyzed!',
    viewReport: 'View report',
    pagesAnalyzedLabel: 'Pages analyzed',
    avgScore: 'Average score',
    perfectPages: 'Perfect pages',
    totalErrors: 'Total errors',
    aiSummary: 'AI Synthesis',
    priorityRecs: 'Priority recommendations',
    pagesAffected: 'pages affected',
    topErrors: 'Most frequent errors',
    crawledPages: 'Crawled pages',
    sortScoreAsc: 'Score ↑ (worst first)',
    sortScoreDesc: 'Score ↓ (best first)',
    sortPath: 'Path A→Z',
    noTitle: '(no title)',
    words: 'Words:',
    imgsNoAlt: 'Imgs no alt:',
    weight: 'Weight:',
    previousCrawls: 'Previous crawls',
    runningCrawls: 'Crawl in progress',
    errorCrawl: 'Crawl error',
    advancedOptions: 'Advanced options',
    crawlDepth: 'Max depth',
    depthUnlimited: 'Unlimited',
    depthLevel: 'Level',
    urlFilter: 'URL filter (regex)',
    urlFilterPlaceholder: '/blog/.*|/products/.*',
    customSelectors: 'Custom extraction (CSS)',
    selectorName: 'Name',
    selectorValue: 'CSS Selector',
    addSelector: 'Add',
    sitemapExport: 'Export Sitemap XML',
    compareCrawls: 'Compare crawls',
    selectCrawlA: 'Crawl A',
    selectCrawlB: 'Crawl B',
    compare: 'Compare',
    comparisonResults: 'Comparison results',
    newPages: 'New pages',
    removedPages: 'Removed pages',
    improvedPages: 'Improved pages',
    degradedPages: 'Degraded pages',
    duplicateContent: 'Near-duplicate content',
    schemaErrors: 'Schema.org errors',
  },
  es: {
    pageTitle: 'Crawl Multi-Páginas SEO — Analice su sitio completo | Crawlers.fr',
    pageDesc: 'Analice todas las páginas de su sitio en un clic. Puntuación SEO/200 por página, detección de errores, síntesis IA global.',
    badge: 'Crawl Multi-Páginas',
    h1_1: 'Audite su sitio',
    h1_2: 'página por página',
    subtitle: 'Crawl completo con puntuación SEO/200 por página, detección de errores técnicos y síntesis IA global.',
    whyTitle: '¿Por qué auditar varias páginas de su sitio?',
    whyText: 'Una auditoría SEO de una sola página solo revela una ínfima parte de sus problemas técnicos. Al analizar todas sus URLs, identifica las etiquetas faltantes, los errores de enlazado interno, las páginas huérfanas y el contenido duplicado.',
    scoreTitle: 'Una puntuación SEO/200 por página, una síntesis IA global',
    scoreText: 'Cada página rastreada recibe una puntuación sobre 200 puntos que cubre criterios técnicos, semánticos y estructurales. La IA consolida estos resultados en una síntesis accionable.',
    placeholder: 'https://su-sitio.es',
    launchBtn: 'Lanzar crawl',
    crawling: 'Crawl en curso…',
    pagesToAnalyze: 'Páginas a analizar',
    unlimited: 'Ilimitado',
    credits: 'créditos',
    insufficientCredits: 'Créditos insuficientes. Requeridos:',
    available: 'disponibles:',
    mapping: 'Mapeando sitio…',
    queued: 'En cola…',
    analyzing: 'Síntesis IA en curso…',
    crawlingProgress: 'Analizando:',
    pages: 'páginas',
    pagesDiscovered: 'páginas descubiertas — auditoría lanzada en segundo plano',
    auditQueued: 'páginas descubiertas — auditoría en cola…',
    auditDone: 'Auditoría completada:',
    pagesAnalyzed: '¡páginas analizadas!',
    viewReport: 'Ver informe',
    pagesAnalyzedLabel: 'Páginas analizadas',
    avgScore: 'Puntuación media',
    perfectPages: 'Páginas perfectas',
    totalErrors: 'Errores totales',
    aiSummary: 'Síntesis IA',
    priorityRecs: 'Recomendaciones prioritarias',
    pagesAffected: 'páginas afectadas',
    topErrors: 'Errores más frecuentes',
    crawledPages: 'Páginas rastreadas',
    sortScoreAsc: 'Puntuación ↑ (peores primero)',
    sortScoreDesc: 'Puntuación ↓ (mejores)',
    sortPath: 'Ruta A→Z',
    noTitle: '(sin título)',
    words: 'Palabras:',
    imgsNoAlt: 'Imgs sin alt:',
    weight: 'Peso:',
    previousCrawls: 'Crawls anteriores',
    runningCrawls: 'Crawl en curso',
    errorCrawl: 'Error de crawl',
    advancedOptions: 'Opciones avanzadas',
    crawlDepth: 'Profundidad máx',
    depthUnlimited: 'Ilimitada',
    depthLevel: 'Nivel',
    urlFilter: 'Filtro URL (regex)',
    urlFilterPlaceholder: '/blog/.*|/productos/.*',
    customSelectors: 'Extracción personalizada (CSS)',
    selectorName: 'Nombre',
    selectorValue: 'Selector CSS',
    addSelector: 'Añadir',
    sitemapExport: 'Exportar Sitemap XML',
    compareCrawls: 'Comparar crawls',
    selectCrawlA: 'Crawl A',
    selectCrawlB: 'Crawl B',
    compare: 'Comparar',
    comparisonResults: 'Resultado de la comparación',
    newPages: 'Páginas añadidas',
    removedPages: 'Páginas eliminadas',
    improvedPages: 'Páginas mejoradas',
    degradedPages: 'Páginas degradadas',
    duplicateContent: 'Contenido quasi-duplicado',
    schemaErrors: 'Errores Schema.org',
  },
};

function getCreditCost(pages: number) {
  if (pages <= 50) return 5;
  if (pages <= 100) return 10;
  if (pages <= 200) return 15;
  if (pages <= 350) return 25;
  return 40;
}

function getScoreColor(score: number) {
  if (score >= 160) return 'text-emerald-500';
  if (score >= 120) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreBg(score: number) {
  if (score >= 160) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 120) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

interface CrawlPage {
  id: string;
  url: string;
  path: string;
  http_status: number | null;
  title: string | null;
  h1: string | null;
  seo_score: number | null;
  word_count: number | null;
  images_without_alt: number | null;
  has_schema_org: boolean | null;
  has_canonical: boolean | null;
  has_og: boolean | null;
  has_noindex: boolean | null;
  has_nofollow: boolean | null;
  is_indexable: boolean | null;
  index_source: string | null;
  issues: string[];
  content_hash?: string | null;
  schema_org_types?: string[];
  schema_org_errors?: string[];
  custom_extraction?: Record<string, string>;
  crawl_depth?: number | null;
}

interface CrawlResult {
  id: string;
  domain: string;
  url: string;
  status: string;
  total_pages: number;
  crawled_pages: number;
  avg_score: number | null;
  ai_summary: string | null;
  ai_recommendations: any[];
  created_at: string;
  completed_at: string | null;
}

interface CustomSelector {
  name: string;
  selector: string;
  type: 'css';
}

interface ComparisonResult {
  newPages: string[];
  removedPages: string[];
  improved: { path: string; before: number; after: number }[];
  degraded: { path: string; before: number; after: number }[];
  scoreChange: number;
}

// ── Sitemap XML Generator ──────────────────────────────────
function generateSitemapXml(pages: CrawlPage[], domain: string): string {
  const urls = pages
    .filter(p => p.http_status === 200 && !(p.issues || []).includes('noindex'))
    .map(p => {
      const loc = p.url.startsWith('http') ? p.url : `https://${domain}${p.path}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <priority>${(p.seo_score || 0) >= 160 ? '1.0' : (p.seo_score || 0) >= 120 ? '0.8' : '0.5'}</priority>\n  </url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

// ── Fair-Use Limit Modal with 4 credit cards ──────────────
const CREDIT_PACKAGES = [
  { id: 'essential', name: 'Essentiel', credits: 10, price: 5, color: 'from-blue-500 to-cyan-500', border: 'border-blue-500/30' },
  { id: 'pro', name: 'Pro', credits: 50, price: 19, color: 'from-emerald-500 to-green-500', border: 'border-emerald-500/50', popular: true, savings: '24%' },
  { id: 'premium', name: 'Premium', credits: 150, price: 45, color: 'from-amber-500 to-orange-500', border: 'border-amber-500/30', savings: '40%' },
  { id: 'ultimate', name: 'Ultime', credits: 500, price: 99, color: 'from-violet-500 to-fuchsia-500', border: 'border-violet-500/40', savings: '60%' },
];

function FairUseLimitModal({ language, crawlPagesThisMonth, fairUseLimit, onClose }: { language: string; crawlPagesThisMonth: number; fairUseLimit: number; onClose: () => void }) {
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    setLoadingPkg(packageId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', {
        body: { action: 'credit-checkout', package_type: packageId },
      });
      if (error) throw error;
      if (data?.url) {
        // Open in same tab so user returns to /site-crawl with URL preserved
        window.open(data.url, '_blank', 'noopener');
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
      setLoadingPkg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border-2 border-amber-500/50 bg-card shadow-2xl shadow-amber-500/10 p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
            <Bot className="h-7 w-7 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {language === 'fr' ? '5 000 pages déjà consommées' : language === 'es' ? '5 000 páginas ya consumidas' : '5,000 pages already consumed'}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {language === 'fr'
              ? `Vous avez utilisé ${crawlPagesThisMonth.toLocaleString()} pages sur vos 5 000 incluses ce mois-ci. Rechargez des crédits pour continuer.`
              : language === 'es'
              ? `Ha utilizado ${crawlPagesThisMonth.toLocaleString()} páginas de sus 5 000 incluidas este mes.`
              : `You've used ${crawlPagesThisMonth.toLocaleString()} pages out of your 5,000 included this month.`}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/5 to-amber-600/10 border border-amber-500/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{language === 'fr' ? 'Pages utilisées' : 'Pages used'}</span>
            <span className="font-bold text-amber-500">{crawlPagesThisMonth.toLocaleString()} / 5 000</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, (crawlPagesThisMonth / fairUseLimit) * 100)}%` }} />
          </div>
        </div>

        {/* 4 Credit Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <div key={pkg.id} className={`relative rounded-xl border-2 p-3 ${pkg.border} ${pkg.popular ? 'ring-2 ring-emerald-500/50' : ''} bg-card hover:border-primary/50 transition-all`}>
              {pkg.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-[10px]">
                  ⭐ {language === 'fr' ? 'Populaire' : 'Popular'}
                </Badge>
              )}
              <div className="flex flex-col items-center text-center h-full justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm">{pkg.name}</h4>
                  <p className="text-xl font-bold mt-1 flex items-center justify-center gap-1">
                    {pkg.credits} <CreditCoin size="sm" />
                  </p>
                  <p className="text-lg font-bold">{pkg.price}€</p>
                  {pkg.savings && (
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{pkg.savings}
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loadingPkg !== null}
                  size="sm"
                  className={`w-full bg-gradient-to-r ${pkg.color} hover:opacity-90 text-white border-0`}
                >
                  {loadingPkg === pkg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (language === 'fr' ? 'Acheter' : 'Buy')}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
          {language === 'fr' ? 'Fermer' : language === 'es' ? 'Cerrar' : 'Close'}
        </Button>
      </div>
    </div>
  );
}

export default function SiteCrawl() {
  const { user, loading } = useAuth();
  const { balance: credits, isAgencyPro, planType } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdmin();
  useCanonicalHreflang('/app/site-crawl');
  const t = crawlI18n[language];

  const isUnlimited = isAgencyPro || isAdmin;

  const [url, setUrl] = useState(() => {
    try {
      const paramUrl = searchParams.get('url');
      if (paramUrl) return paramUrl;
      return localStorage.getItem('crawl_last_url') || '';
    } catch { return ''; }
  });
  const isAgencyPlus = planType === 'agency_premium';
  const maxSliderCap = isAdmin ? 50 : (isAgencyPlus ? 50 : 20);
  const [maxPages, setMaxPages] = useState(maxSliderCap);
  const [isLoading, setIsLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [pages, setPages] = useState<CrawlPage[]>([]);
  const [showTopUp, setShowTopUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score_asc' | 'score_desc' | 'path'>('score_asc');
  const [indexFilter, setIndexFilter] = useState<'all' | 'indexed' | 'noindex'>('all');
  const [pastCrawls, setPastCrawls] = useState<CrawlResult[]>([]);
  const [viewingCrawlId, setViewingCrawlId] = useState<string | null>(null);
  const [isLoadingPastCrawl, setIsLoadingPastCrawl] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [crawlBacklinks, setCrawlBacklinks] = useState<any[]>([]);
  const [isScanningBacklinks, setIsScanningBacklinks] = useState(false);
  const [indexedPagesCount, setIndexedPagesCount] = useState<number | null>(null);
  const [sitemapPagesCount, setSitemapPagesCount] = useState<number | null>(null);
  const [totalEstimatedPages, setTotalEstimatedPages] = useState<number | null>(null);
  const [isDetectingPages, setIsDetectingPages] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Sitemap directory & page selectors
  const [sitemapTree, setSitemapTree] = useState<Array<{ path: string; label: string; count: number }>>([]);
  const [sitemapPages, setSitemapPages] = useState<Array<{ path: string; label: string }>>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  // Filter modes: include_dirs, exclude_dirs, include_pages, exclude_pages
  const [includeDir, setIncludeDir] = useState<string>('');
  const [excludeDir, setExcludeDir] = useState<string>('');
  const [includePage, setIncludePage] = useState<string>('');
  const [excludePage, setExcludePage] = useState<string>('');

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxDepth, setMaxDepth] = useState(0); // 0 = unlimited
  const [urlFilter, setUrlFilter] = useState('');
  const [customSelectors, setCustomSelectors] = useState<CustomSelector[]>([]);
  const [newSelectorName, setNewSelectorName] = useState('');
  const [newSelectorValue, setNewSelectorValue] = useState('');

  // Comparison
  const [showComparison, setShowComparison] = useState(false);
  const [compareCrawlA, setCompareCrawlA] = useState('');
  const [compareCrawlB, setCompareCrawlB] = useState('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isButtonShaking, setIsButtonShaking] = useState(false);
  const [crawlPagesThisMonth, setCrawlPagesThisMonth] = useState(0);
  const FAIR_USE_LIMIT = isAgencyPlus ? 50000 : 5000;
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const creditCost = isUnlimited ? 0 : getCreditCost(maxPages);

  // Delayed upsell reveal
  useEffect(() => {
    if (isUnlimited) return;
    const timer = setTimeout(() => setShowUpsell(true), 2500);
    return () => clearTimeout(timer);
  }, [isUnlimited]);

  // Load past crawls & crawl_pages_this_month
  useEffect(() => {
    if (!user) return;
    supabase
      .from('site_crawls')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setPastCrawls(data as any);
      });
    // Fetch crawl_pages_this_month from profile
    supabase
      .from('profiles')
      .select('crawl_pages_this_month')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setCrawlPagesThisMonth(data.crawl_pages_this_month || 0);
      });
  }, [user, crawlResult?.id]);

  // Auto-load crawl from ?view= query param
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (!viewId) return;
    (async () => {
      const { data } = await supabase
        .from('site_crawls')
        .select('*')
        .eq('id', viewId)
        .single();
      if (data) {
        const crawl = data as any;
        setUrl(crawl.url || crawl.domain || '');
        setCrawlResult({
          ...crawl,
          ai_recommendations: Array.isArray(crawl.ai_recommendations) ? crawl.ai_recommendations : [],
        });
        setViewingCrawlId(crawl.id);
        await loadPages(crawl.id);
      }
    })();
  }, [searchParams]);


  // Use a ref to track the crawl ID for polling, avoiding re-creating intervals on every crawlResult change
  const pollingCrawlIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start polling when crawlResult changes to an active state
  useEffect(() => {
    const shouldPoll = crawlResult && !viewingCrawlId && crawlResult.status !== 'completed' && crawlResult.status !== 'error';
    
    if (!shouldPoll) {
      // Stop any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollingCrawlIdRef.current = null;
      }
      return;
    }

    // Don't restart polling if already polling this crawl
    if (pollingCrawlIdRef.current === crawlResult.id) return;

    // Clear previous interval if any
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingCrawlIdRef.current = crawlResult.id;
    const crawlId = crawlResult.id;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('site_crawls')
          .select('*')
          .eq('id', crawlId)
          .single();
        if (data) {
          const r = data as any;
          const sanitizedResult = {
            ...r,
            ai_recommendations: Array.isArray(r.ai_recommendations) ? r.ai_recommendations : [],
          };
          setCrawlResult(sanitizedResult);
          if (sanitizedResult.total_pages > 0) setProgress(Math.round((sanitizedResult.crawled_pages / sanitizedResult.total_pages) * 100));
          if (sanitizedResult.status === 'queued') setPhase(t.queued);
          else if (sanitizedResult.status === 'mapping') setPhase(t.mapping);
          else if (sanitizedResult.status === 'crawling') setPhase(`${t.crawlingProgress} ${sanitizedResult.crawled_pages}/${sanitizedResult.total_pages} ${t.pages}…`);
          else if (sanitizedResult.status === 'analyzing') setPhase(t.analyzing);
          if (sanitizedResult.status === 'completed') {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            pollingCrawlIdRef.current = null;
            setIsLoading(false);
            setPhase('');
            loadPages(sanitizedResult.id);
            try { const audio = new Audio(microwaveDing); audio.volume = 0.6; audio.play().catch(() => {}); } catch {}
            toast.success(`✅ ${t.auditDone} ${sanitizedResult.crawled_pages} ${t.pagesAnalyzed}`, { duration: 10000 });
            supabase.functions.invoke('agent-cto', {
              body: { auditResult: { ai_summary: sanitizedResult.ai_summary, ai_recommendations: sanitizedResult.ai_recommendations, avg_score: sanitizedResult.avg_score, crawled_pages: sanitizedResult.crawled_pages }, auditType: 'crawl', url: sanitizedResult.url, domain: sanitizedResult.domain }
            }).catch(() => {});
          }
          if (sanitizedResult.status === 'error') {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            pollingCrawlIdRef.current = null;
            setIsLoading(false);
            setPhase('');
            toast.error(sanitizedResult.error_message || t.errorCrawl);
          }
        }
      } catch (pollErr) {
        console.error('[CrawlPoll] Error during polling:', pollErr);
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollingCrawlIdRef.current = null;
      }
    };
  }, [crawlResult?.id, crawlResult?.status, viewingCrawlId]);

  // Pre-scan: detect indexed + sitemap pages when URL changes (debounced)
  useEffect(() => {
    setIndexedPagesCount(null);
    setSitemapPagesCount(null);
    setTotalEstimatedPages(null);
    setSitemapTree([]);
    setSitemapPages([]);
    setSelectedDirectory('');
    setIncludeDir('');
    setExcludeDir('');
    setIncludePage('');
    setExcludePage('');
    if (!url || url.length < 5) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        let normalizedUrl = url.trim();
        if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;
        const domain = new URL(normalizedUrl).hostname;
        if (!domain || domain.length < 3) return;

        setIsDetectingPages(true);

        // Query SERP (indexed pages) and sitemap in parallel
        const [serpRes, sitemapRes] = await Promise.all([
          supabase.functions.invoke('fetch-serp-kpis', { body: { domain } }),
          supabase.functions.invoke('fetch-sitemap-tree', { body: { domain } }),
        ]);

        if (cancelled) return;

        const indexed = serpRes.data?.data?.indexed_pages as number | undefined;
        const sitemapTotal = sitemapRes.data?.totalUrls as number | undefined;

        if (indexed != null) setIndexedPagesCount(indexed);
        if (sitemapTotal != null) setSitemapPagesCount(sitemapTotal);

        // Extract top-level directories from sitemap tree
        const tree = sitemapRes.data?.tree as Array<{ path: string; label: string; count: number; children?: any[] }> | undefined;
        if (tree && tree.length > 0) {
          const dirs = tree
            .filter(n => n.path !== '/' && n.count > 1)
            .slice(0, 15)
            .map(n => ({ path: n.path, label: n.label, count: n.count }));
          setSitemapTree(dirs);

          // Extract individual page patterns from tree URLs
          const pagePatterns: Array<{ path: string; label: string }> = [];
          const seen = new Set<string>();
          for (const node of tree) {
            const nodeUrls = (node as any).urls;
            if (Array.isArray(nodeUrls)) {
              for (const u of nodeUrls.slice(0, 5)) {
                try {
                  const parsed = new URL(u);
                  // Get filename-like pattern (last segment)
                  const segments = parsed.pathname.split('/').filter(Boolean);
                  if (segments.length >= 2) {
                    const pattern = segments.slice(-1)[0];
                    if (!seen.has(pattern) && pattern.length > 2 && !/^\d+$/.test(pattern)) {
                      seen.add(pattern);
                      pagePatterns.push({ path: parsed.pathname, label: pattern });
                    }
                  }
                } catch {}
              }
            }
          }
          setSitemapPages(pagePatterns.slice(0, 20));
        }

        // Total = max of sitemap and indexed (they overlap, so we take the greater)
        const total = Math.max(indexed || 0, sitemapTotal || 0);
        if (total > 0) {
          setTotalEstimatedPages(total);
          // Auto-cap slider
          const capMax = maxSliderCap;
          if (maxPages > Math.min(capMax, total)) {
            setMaxPages(Math.min(capMax, total));
          }
        }
      } catch {
        // Silent — pre-scan is best-effort
      } finally {
        if (!cancelled) setIsDetectingPages(false);
      }
    }, 1200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [url]);

  // #8: useMemo for expensive computations (MUST be before early returns)
  const filteredPages = useMemo(() => {
    if (indexFilter === 'indexed') return pages.filter(p => p.is_indexable !== false && !(p.issues || []).includes('noindex'));
    if (indexFilter === 'noindex') return pages.filter(p => p.is_indexable === false || (p.issues || []).includes('noindex'));
    return pages;
  }, [pages, indexFilter]);

  const sortedPages = useMemo(() => [...filteredPages].sort((a, b) => {
    if (sortBy === 'score_asc') return (a.seo_score || 0) - (b.seo_score || 0);
    if (sortBy === 'score_desc') return (b.seo_score || 0) - (a.seo_score || 0);
    return a.path.localeCompare(b.path);
  }), [filteredPages, sortBy]);

  const indexedCount = useMemo(() => pages.filter(p => p.is_indexable !== false && !(p.issues || []).includes('noindex')).length, [pages]);
  const noindexCount = useMemo(() => pages.length - indexedCount, [pages, indexedCount]);

  const issueStats = useMemo(() => pages.reduce<Record<string, number>>((acc, p) => {
    (p.issues || []).forEach((issue: string) => {
      acc[issue] = (acc[issue] || 0) + 1;
    });
    return acc;
  }, {}), [pages]);

  const nearDuplicates = useMemo(() => pages.filter(p => (p.issues || []).includes('near_duplicate_content')), [pages]);
  const schemaErrorPages = useMemo(() => pages.filter(p => (p.issues || []).includes('schema_org_errors')), [pages]);

  const completedCrawls = useMemo(() => pastCrawls.filter(c => c.status === 'completed'), [pastCrawls]);

  const siteCrawlReportData = useMemo((): SiteCrawlReportData | null => {
    if (!crawlResult) return null;

    // Compute duplicate titles
    const titleMap = new Map<string, string[]>();
    pages.forEach(p => {
      const t = (p.title || '').trim();
      if (!t) return;
      if (!titleMap.has(t)) titleMap.set(t, []);
      titleMap.get(t)!.push(p.url);
    });
    const duplicateTitles = Array.from(titleMap.entries())
      .filter(([, urls]) => urls.length > 1)
      .map(([title, urls]) => ({ title, count: urls.length, urls }))
      .sort((a, b) => b.count - a.count);

    // Compute thin content (< 300 words)
    const thinContentPages = pages
      .filter(p => (p.word_count ?? 0) > 0 && (p.word_count ?? 0) < 300 && p.http_status === 200)
      .map(p => ({ url: p.url, path: p.path, word_count: p.word_count ?? 0 }))
      .sort((a, b) => a.word_count - b.word_count);

    // Compute deep pages (depth > 3)
    const deepPages = pages
      .filter(p => (p as any).crawl_depth != null && (p as any).crawl_depth > 3)
      .map(p => ({ url: p.url, path: p.path, depth: (p as any).crawl_depth as number }))
      .sort((a, b) => b.depth - a.depth);

    // Compute broken links
    const brokenLinksArr: Array<{ source_url: string; broken_url: string; status?: number }> = [];
    pages.forEach(p => {
      const bl = (p as any).broken_links;
      if (Array.isArray(bl)) {
        bl.forEach((link: any) => {
          if (typeof link === 'string') {
            brokenLinksArr.push({ source_url: p.url, broken_url: link });
          } else if (link?.url) {
            brokenLinksArr.push({ source_url: p.url, broken_url: link.url, status: link.status });
          }
        });
      }
    });

    // Compute indexability ratio
    const indexable = pages.filter(p => p.is_indexable !== false && !(p.issues || []).includes('noindex')).length;
    const noindex = pages.length - indexable;

    return {
      domain: crawlResult.domain,
      crawledPages: crawlResult.crawled_pages,
      totalPages: crawlResult.total_pages,
      avgScore: crawlResult.avg_score,
      aiSummary: crawlResult.ai_summary,
      aiRecommendations: crawlResult.ai_recommendations || [],
      issueStats,
      pages: pages.map(p => ({
        url: p.url,
        path: p.path,
        seo_score: p.seo_score,
        http_status: p.http_status,
        title: p.title,
        issues: p.issues || [],
        has_noindex: p.is_indexable === false || (p.issues || []).includes('noindex'),
        word_count: p.word_count,
      })),
      createdAt: crawlResult.created_at,
      duplicateTitles,
      thinContentPages,
      deepPages,
      brokenLinks: brokenLinksArr,
      indexabilityRatio: { indexable, noindex, total: pages.length },
      externalBacklinks: crawlBacklinks.map((bl: any) => ({
        url: bl.url,
        path: bl.path,
        referring_domains: bl.referring_domains || 0,
        backlinks_total: bl.backlinks_total || 0,
        domain_rank_avg: Number(bl.domain_rank_avg) || 0,
        top_anchors: Array.isArray(bl.top_anchors) ? bl.top_anchors : [],
        top_sources: Array.isArray(bl.top_sources) ? bl.top_sources : [],
      })),
    };
  }, [crawlResult, pages, issueStats, crawlBacklinks]);

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

   async function loadPages(crawlId: string) {
    try {
      const [{ data, error }, { data: blData }] = await Promise.all([
        supabase
          .from('crawl_pages')
          .select('*')
          .eq('crawl_id', crawlId)
          .order('seo_score', { ascending: true }),
        supabase
          .from('crawl_page_backlinks' as any)
          .select('*')
          .eq('crawl_id', crawlId)
          .order('referring_domains', { ascending: false }),
      ]);
      if (error) {
        console.error('[loadPages] Error:', error);
      }
      if (data) {
        // Sanitize fields that must be arrays to prevent React crashes
        const sanitized = data.map((p: any) => ({
          ...p,
          path: p.path || p.url || '',
          word_count: p.word_count ?? 0,
          images_without_alt: p.images_without_alt ?? 0,
          seo_score: p.seo_score ?? 0,
          issues: Array.isArray(p.issues) ? p.issues : [],
          schema_org_types: Array.isArray(p.schema_org_types) ? p.schema_org_types : [],
          schema_org_errors: Array.isArray(p.schema_org_errors) ? p.schema_org_errors : [],
          broken_links: Array.isArray(p.broken_links) ? p.broken_links : [],
          anchor_texts: Array.isArray(p.anchor_texts) ? p.anchor_texts : [],
          custom_extraction: (p.custom_extraction && typeof p.custom_extraction === 'object' && !Array.isArray(p.custom_extraction)) ? p.custom_extraction : {},
        }));
        setPages(sanitized as any);
      }
      setCrawlBacklinks(blData || []);
    } catch {
      // Silent — handled by error boundary
    }
  }

  async function viewCrawl(crawl: CrawlResult) {
    setIsLoadingPastCrawl(true);
    setExpandedPage(null);
    setViewingCrawlId(crawl.id);
    setCrawlResult({
      ...crawl,
      ai_recommendations: Array.isArray(crawl.ai_recommendations) ? crawl.ai_recommendations : [],
    });
    try {
      await loadPages(crawl.id);
      requestAnimationFrame(() => {
        historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch {
      toast.error(t.errorCrawl);
    } finally {
      setIsLoadingPastCrawl(false);
    }
  }

  function resetViewedCrawl() {
    setViewingCrawlId(null);
    setCrawlResult(null);
    setPages([]);
    setExpandedPage(null);
    setCrawlBacklinks([]);
  }

  function addSelector() {
    if (!newSelectorName.trim() || !newSelectorValue.trim()) return;
    setCustomSelectors(prev => [...prev, { name: newSelectorName.trim(), selector: newSelectorValue.trim(), type: 'css' }]);
    setNewSelectorName('');
    setNewSelectorValue('');
  }

  function removeSelector(index: number) {
    setCustomSelectors(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate('/auth'); return; }
    // #15: persist URL for next session
    try { localStorage.setItem('crawl_last_url', url); } catch {}
    
    // Fair-use limit check for subscribed users
    if (isUnlimited && (crawlPagesThisMonth >= FAIR_USE_LIMIT || crawlPagesThisMonth + maxPages > FAIR_USE_LIMIT)) {
      setIsButtonShaking(true);
      setTimeout(() => {
        setIsButtonShaking(false);
        setShowLimitModal(true);
      }, 600);
      return;
    }
    
    if (!isUnlimited && credits < creditCost) {
      toast.error(`${t.insufficientCredits} ${creditCost}, ${t.available} ${credits}`);
      return;
    }

    setIsLoading(true);
    setPhase(t.mapping);
    setProgress(0);
    setPages([]);
    setCrawlResult(null);

    try {
      // Compute effective URL filter from the 4 filter fields
      let effectiveFilter = urlFilter.trim();
      if (!effectiveFilter) {
        if (includeDir) effectiveFilter = `${includeDir}/.*`;
        else if (excludeDir) effectiveFilter = `(?!${excludeDir}/).*`;
        if (includePage) effectiveFilter = effectiveFilter ? `${effectiveFilter}|.*${includePage}.*` : `.*${includePage}.*`;
        else if (excludePage) {
          const negPage = `(?!.*${excludePage})`;
          effectiveFilter = effectiveFilter ? `${negPage}${effectiveFilter}` : `${negPage}.*`;
        }
      }

      const { data, error } = await supabase.functions.invoke('crawl-site', {
        body: { 
          url, 
          maxPages, 
          userId: user.id,
          maxDepth: maxDepth || 0,
          urlFilter: effectiveFilter || '',
          customSelectors,
        },
      });

      if (error) throw error;
      if (!data.success) {
        toast.error(data.error || t.errorCrawl);
        setIsLoading(false);
        return;
      }

      const { data: crawl } = await supabase
        .from('site_crawls')
        .select('*')
        .eq('id', data.crawlId)
        .single();

      if (crawl) {
        const sanitized = {
          ...crawl as any,
          ai_recommendations: Array.isArray((crawl as any).ai_recommendations) ? (crawl as any).ai_recommendations : [],
        };
        setCrawlResult(sanitized);
        setPastCrawls(prev => {
          const next = [sanitized as CrawlResult, ...prev.filter(c => c.id !== (sanitized as CrawlResult).id)];
          return next.slice(0, 20);
        });
        setPhase(`${data.totalPages} ${t.auditQueued}`);
      }
      // Silent — no toast for pages discovered
    } catch (err: any) {
      toast.error(err.message || t.errorCrawl);
      setIsLoading(false);
      setPhase('');
    }
  }

  // ── Sitemap export ────────────────────────────────────────
  async function handleSitemapExport() {
    if (pages.length === 0) return;
    const domain = crawlResult?.domain || '';
    const xml = generateSitemapXml(pages, domain);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const { getReportFilename } = await import('@/utils/reportFilename');
    a.download = getReportFilename(domain, 'crawl', 'xml');
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sitemap XML téléchargé');
  }

  // ── Crawl comparison ──────────────────────────────────────
  async function handleCompare() {
    if (!compareCrawlA || !compareCrawlB || compareCrawlA === compareCrawlB) return;
    setIsComparing(true);
    setComparisonResult(null);

    try {
      const [{ data: pagesA }, { data: pagesB }] = await Promise.all([
        supabase.from('crawl_pages').select('path, seo_score, url').eq('crawl_id', compareCrawlA),
        supabase.from('crawl_pages').select('path, seo_score, url').eq('crawl_id', compareCrawlB),
      ]);

      if (!pagesA || !pagesB) { toast.error('Impossible de charger les données'); return; }

      const mapA = new Map(pagesA.map((p: any) => [p.path, p.seo_score || 0]));
      const mapB = new Map(pagesB.map((p: any) => [p.path, p.seo_score || 0]));

      const newPages = pagesB.filter((p: any) => !mapA.has(p.path)).map((p: any) => p.path);
      const removedPages = pagesA.filter((p: any) => !mapB.has(p.path)).map((p: any) => p.path);

      const improved: { path: string; before: number; after: number }[] = [];
      const degraded: { path: string; before: number; after: number }[] = [];

      for (const [path, scoreB] of mapB.entries()) {
        const scoreA = mapA.get(path);
        if (scoreA !== undefined) {
          if (scoreB > scoreA + 5) improved.push({ path, before: scoreA, after: scoreB });
          else if (scoreB < scoreA - 5) degraded.push({ path, before: scoreA, after: scoreB });
        }
      }

      const avgA = pagesA.length > 0 ? pagesA.reduce((s: number, p: any) => s + (p.seo_score || 0), 0) / pagesA.length : 0;
      const avgB = pagesB.length > 0 ? pagesB.reduce((s: number, p: any) => s + (p.seo_score || 0), 0) / pagesB.length : 0;

      setComparisonResult({
        newPages,
        removedPages,
        improved: improved.sort((a, b) => (b.after - b.before) - (a.after - a.before)),
        degraded: degraded.sort((a, b) => (a.after - a.before) - (b.after - b.before)),
        scoreChange: Math.round(avgB - avgA),
      });
    } catch (err: any) {
      toast.error(err.message || 'Erreur comparaison');
    } finally {
      setIsComparing(false);
    }
  }


  return (
    <>
      <Helmet>
        <title>Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr</title>
        <meta name="description" content="Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/site-crawl" />
        <meta property="og:title" content="Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr" />
        <meta property="og:description" content="Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr" />
        <meta name="twitter:description" content="Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <Header />

      <main className="min-h-screen bg-background pt-20 pb-16 relative">

        {/* Pro Agency upsell overlay for non-subscribers */}
        {!isUnlimited && (
          <div className={`fixed inset-x-0 top-16 bottom-0 z-30 flex items-start justify-center pt-8 transition-all duration-700 ease-out ${showUpsell ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
            <div className="relative z-10 w-full max-w-lg mx-4">
              <div className="relative z-20 mb-4">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home'}
                </Link>
              </div>
              <Card className="relative w-full border-2 border-violet-500 ring-2 ring-violet-500/30 bg-gradient-to-br from-violet-500/5 via-background to-yellow-500/5 shadow-xl shadow-violet-500/10">
              <div className="absolute top-0 left-0">
                <Badge className="rounded-none rounded-br-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-0 px-3 py-1 text-xs font-bold gap-1.5 shadow-lg">
                  <Star className="h-3 w-3 fill-current" />
                  Pro Agency
                </Badge>
              </div>
              <div className="absolute top-0 right-0">
                <Badge className="rounded-none rounded-bl-lg bg-violet-600 text-white border-0 px-3 py-1 text-xs font-bold gap-1.5">
                  <Lock className="h-3 w-3" />
                  Pro
                </Badge>
              </div>
              <CardHeader className="pb-3 pt-10">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-yellow-500/10 border border-violet-500/20">
                    <Crown className="h-5 w-5 text-yellow-500" />
                  </div>
                  <span>{language === 'fr' ? 'Crawl Multi-Pages' : language === 'es' ? 'Crawl Multi-Páginas' : 'Multi-Page Crawl'}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {language === 'fr' 
                    ? 'Analysez jusqu\'à 500 pages de votre site avec un score SEO/200 par page, détection de contenu dupliqué, validation Schema.org et synthèse IA.' 
                    : language === 'es'
                    ? 'Analice hasta 500 páginas de su sitio con puntuación SEO/200 por página, detección de contenido duplicado, validación Schema.org y síntesis IA.'
                    : 'Analyze up to 500 pages with SEO/200 score per page, duplicate content detection, Schema.org validation and AI synthesis.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="grid gap-2">
                  {[
                    language === 'fr' ? 'Audit expert illimité' : language === 'es' ? 'Auditoría experta ilimitada' : 'Unlimited expert audit',
                    language === 'fr' ? 'Code correctif illimité' : language === 'es' ? 'Código correctivo ilimitado' : 'Unlimited corrective code',
                    language === 'fr' ? 'Crawl multi-pages illimité' : language === 'es' ? 'Crawl multi-páginas ilimitado' : 'Unlimited multi-page crawl',
                    language === 'fr' ? 'Marque Blanche (White Label)' : language === 'es' ? 'Marca Blanca (White Label)' : 'White Label branding',
                    language === 'fr' ? 'Assistant IA : Stratège Cocoon' : language === 'es' ? 'Asistente IA: Estratega Cocoon' : 'AI Assistant: Cocoon Strategist',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-card/50 border border-violet-500/10">
                      <div className={`p-1 rounded-md ${i === 0 ? 'bg-violet-500/10' : i === 4 ? 'bg-yellow-500/10' : 'bg-violet-500/10'}`}>
                        <CheckCircle2 className={`h-3.5 w-3.5 ${i === 0 ? 'text-violet-500' : i === 4 ? 'text-yellow-500' : 'text-violet-500'}`} />
                      </div>
                      <span className={`text-sm font-medium ${i === 0 ? 'text-foreground' : i === 4 ? 'text-yellow-500' : ''}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline gap-1 justify-center">
                  <span className="text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
                    {language === 'fr' ? '59€' : '€59'}
                  </span>
                  <span className="text-sm text-muted-foreground">/ {language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'month'}</span>
                </div>
                <Button
                  size="lg"
                  className="w-full gap-2 font-bold bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white shadow-lg shadow-violet-500/25"
                  disabled={subscribeLoading}
                  onClick={async () => {
                    if (!user) {
                      navigate('/auth?returnTo=/site-crawl');
                      return;
                    }
                    setSubscribeLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('stripe-actions', {
                        body: { action: 'subscription', returnUrl: window.location.href }
                      });
                      if (error) throw error;
                      if (data?.url) window.open(data.url, '_blank', 'noopener');
                    } catch (e: any) {
                      toast.error(e.message || 'Erreur');
                    } finally {
                      setSubscribeLoading(false);
                    }
                  }}
                >
                  <Crown className="h-4 w-4 text-yellow-300" />
                  {subscribeLoading
                    ? (language === 'fr' ? 'Redirection…' : language === 'es' ? 'Redirigiendo…' : 'Redirecting…')
                    : (language === 'fr' ? 'S\'abonner' : language === 'es' ? 'Suscribirse' : 'Subscribe')
                  }
                </Button>
              </CardContent>
            </Card>
            </div>
          </div>
        )}

        <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${!isUnlimited ? 'pointer-events-none select-none opacity-40' : ''}`}>
          
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#722F37]/10 text-[#722F37] dark:text-[#c97a82] text-sm font-medium mb-4">
              <Bug className="w-4 h-4" />
              {t.badge}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              {t.h1_1} <span className="text-[#722F37] dark:text-[#c97a82]">{t.h1_2}</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
          </div>

          {/* SEO content moved to bottom */}

          {/* Formulaire */}
          <Card className="mb-8 border-violet-500/30">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                    <Input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder={t.placeholder}
                      className="pl-10 border-violet-500/40 focus-visible:ring-violet-500/50 focus-visible:border-violet-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" disabled={isLoading || !url || (crawlResult?.status === 'completed' && !viewingCrawlId)} className={`gap-2 bg-violet-600 hover:bg-violet-700 text-white ${isButtonShaking ? 'animate-shake' : ''}`}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : crawlResult?.status === 'completed' && !viewingCrawlId ? <CheckCircle2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                    {isLoading ? phase || t.crawling : crawlResult?.status === 'completed' && !viewingCrawlId ? (language === 'fr' ? 'Terminé' : language === 'es' ? 'Terminado' : 'Done') : t.launchBtn}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {t.pagesToAnalyze}
                        {isDetectingPages && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
                        {totalEstimatedPages != null && totalEstimatedPages > 0 && (
                          <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                            <FileText className="h-2.5 w-2.5" />
                            {totalEstimatedPages.toLocaleString()} {language === 'fr' ? 'pages détectées' : language === 'es' ? 'páginas detectadas' : 'pages detected'}
                          </Badge>
                        )}
                        {indexedPagesCount != null && indexedPagesCount > 0 && sitemapPagesCount != null && sitemapPagesCount > 0 && (
                          <Badge variant="outline" className="text-[9px] font-normal gap-0.5">
                            {indexedPagesCount.toLocaleString()} {language === 'fr' ? 'indexées' : 'indexed'}
                            {sitemapPagesCount !== indexedPagesCount && (
                              <> + {Math.max(0, sitemapPagesCount - indexedPagesCount).toLocaleString()} {language === 'fr' ? 'sitemap' : 'sitemap'}</>
                            )}
                          </Badge>
                        )}
                      </span>
                    </label>
                    {/* Slider page count selector */}
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[maxPages]}
                        onValueChange={([val]) => setMaxPages(val)}
                        min={10}
                        max={isAdmin ? 50 : (isAgencyPlus ? (totalEstimatedPages != null && totalEstimatedPages > 0 ? Math.min(50, Math.max(10, totalEstimatedPages)) : 50) : (totalEstimatedPages != null && totalEstimatedPages > 0 ? Math.min(20, Math.max(10, totalEstimatedPages)) : 20))}
                        step={isAdmin || isAgencyPlus ? 10 : 5}
                        disabled={isLoading}
                        className="flex-1"
                      />
                      <span className="text-sm font-bold text-brand-violet tabular-nums min-w-[3ch] text-right">{maxPages}</span>
                    </div>
                  </div>
                  {!isUnlimited && (
                    <button type="button" onClick={() => setShowTopUp(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border hover:bg-muted/70 transition-colors cursor-pointer">
                      <CreditCoin size="md" />
                      <span className="text-sm font-semibold">{creditCost} {t.credits}</span>
                    </button>
                  )}
                </div>

                {/* Crawl Filters — from sitemap */}
                {sitemapTree.length > 0 && (
                  <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <FolderTree className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-medium text-foreground">
                        {language === 'fr' ? 'Filtrer le périmètre du crawl' : 'Filter crawl scope'}
                      </span>
                      <Badge variant="secondary" className="text-[9px] font-normal">
                        {language === 'fr' ? 'Auto-détecté via sitemap' : 'Auto-detected from sitemap'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Uniquement les répertoires */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {language === 'fr' ? 'Uniquement les répertoires' : 'Only directories'}
                        </label>
                        <Select value={includeDir} onValueChange={v => { setIncludeDir(v === '__none__' ? '' : v); if (v && v !== '__none__') setExcludeDir(''); }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={language === 'fr' ? 'Tous (aucun filtre)' : 'All (no filter)'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Tous (aucun filtre)' : 'All (no filter)'}</SelectItem>
                            {sitemapTree.map(d => (
                              <SelectItem key={d.path} value={d.path}>
                                <span className="flex items-center gap-1.5">
                                  <Folder className="w-3 h-3" /> /{d.label} <span className="text-muted-foreground">({d.count})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sauf les répertoires */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <XCircle className="w-3 h-3 text-red-500" />
                          {language === 'fr' ? 'Sauf les répertoires' : 'Exclude directories'}
                        </label>
                        <Select value={excludeDir} onValueChange={v => { setExcludeDir(v === '__none__' ? '' : v); if (v && v !== '__none__') setIncludeDir(''); }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={language === 'fr' ? 'Aucun (aucun filtre)' : 'None (no filter)'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Aucun (aucun filtre)' : 'None (no filter)'}</SelectItem>
                            {sitemapTree.map(d => (
                              <SelectItem key={d.path} value={d.path}>
                                <span className="flex items-center gap-1.5">
                                  <Folder className="w-3 h-3" /> /{d.label} <span className="text-muted-foreground">({d.count})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Uniquement les pages */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {language === 'fr' ? 'Uniquement les pages' : 'Only pages'}
                        </label>
                        <Select value={includePage} onValueChange={v => { setIncludePage(v === '__none__' ? '' : v); if (v && v !== '__none__') setExcludePage(''); }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={language === 'fr' ? 'Toutes (aucun filtre)' : 'All (no filter)'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Toutes (aucun filtre)' : 'All (no filter)'}</SelectItem>
                            {sitemapPages.map(p => (
                              <SelectItem key={p.path} value={p.path}>
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" /> {p.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sauf les pages */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <XCircle className="w-3 h-3 text-red-500" />
                          {language === 'fr' ? 'Sauf les pages' : 'Exclude pages'}
                        </label>
                        <Select value={excludePage} onValueChange={v => { setExcludePage(v === '__none__' ? '' : v); if (v && v !== '__none__') setIncludePage(''); }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={language === 'fr' ? 'Aucune (aucun filtre)' : 'None (no filter)'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Aucune (aucun filtre)' : 'None (no filter)'}</SelectItem>
                            {sitemapPages.map(p => (
                              <SelectItem key={p.path} value={p.path}>
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" /> {p.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Active filter summary */}
                    {(includeDir || excludeDir || includePage || excludePage) && (
                      <div className="flex items-center gap-2 pt-1">
                        <Filter className="w-3 h-3 text-violet-400" />
                        <p className="text-[10px] text-muted-foreground">
                          {includeDir && (language === 'fr' ? `Crawl limité à ${includeDir}/` : `Crawl limited to ${includeDir}/`)}
                          {excludeDir && (language === 'fr' ? `${excludeDir}/ sera ignoré` : `${excludeDir}/ will be excluded`)}
                          {includePage && (language === 'fr' ? `Uniquement les pages contenant "${includePage}"` : `Only pages matching "${includePage}"`)}
                          {excludePage && (language === 'fr' ? `Pages contenant "${excludePage}" exclues` : `Pages matching "${excludePage}" excluded`)}
                        </p>
                        <button type="button" onClick={() => { setIncludeDir(''); setExcludeDir(''); setIncludePage(''); setExcludePage(''); }} className="text-[10px] text-destructive hover:underline ml-auto">
                          {language === 'fr' ? 'Réinitialiser' : 'Reset'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced Options */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start">
                      <Settings2 className="w-4 h-4" />
                      {t.advancedOptions}
                      <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-3 border-t border-border mt-2">
                    {/* Crawl Depth */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        {t.crawlDepth}: <span className="font-semibold text-foreground">{maxDepth === 0 ? t.depthUnlimited : `${t.depthLevel} ${maxDepth}`}</span>
                      </label>
                      <Slider
                        value={[maxDepth]}
                        onValueChange={v => setMaxDepth(v[0])}
                        min={0}
                        max={10}
                        step={1}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">0 = {t.depthUnlimited}</p>
                    </div>

                    {/* URL Filter */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        {t.urlFilter}
                      </label>
                      <Input
                        value={urlFilter}
                        onChange={e => setUrlFilter(e.target.value)}
                        placeholder={t.urlFilterPlaceholder}
                        className="font-mono text-sm"
                        disabled={isLoading}
                      />
                    </div>

                    {/* Custom Selectors */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Code2 className="w-4 h-4" />
                        {t.customSelectors}
                      </label>
                      {customSelectors.map((sel, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
                          <span className="font-medium text-foreground">{sel.name}</span>
                          <span className="text-muted-foreground">→</span>
                          <code className="text-violet-400 font-mono flex-1 truncate">{sel.selector}</code>
                          <button type="button" onClick={() => removeSelector(i)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          value={newSelectorName}
                          onChange={e => setNewSelectorName(e.target.value)}
                          placeholder={t.selectorName}
                          className="w-32 text-sm"
                          disabled={isLoading}
                        />
                        <Input
                          value={newSelectorValue}
                          onChange={e => setNewSelectorValue(e.target.value)}
                          placeholder={t.selectorValue}
                          className="flex-1 font-mono text-sm"
                          disabled={isLoading}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSelector())}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addSelector} disabled={isLoading || !newSelectorName || !newSelectorValue}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </form>

              {isLoading && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{phase}</span>
                    <span className="font-mono text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 [&>*]:bg-brand-violet/60" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loading past crawl */}
          {crawlResult && isLoadingPastCrawl && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Résultats */}
          {crawlResult && !isLoadingPastCrawl && (crawlResult.status === 'completed' || viewingCrawlId || (pages.length > 0 && !isLoading)) && (
            <StrategicErrorBoundary onReset={() => { setCrawlResult(null); setPages([]); setViewingCrawlId(null); }}>
            <div ref={historySectionRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {viewingCrawlId && (
                <div className="flex justify-start">
                  <Button type="button" variant="ghost" size="sm" onClick={resetViewedCrawl} className="gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    {language === 'fr' ? 'Retour aux crawls précédents' : language === 'es' ? 'Volver a los crawls anteriores' : 'Back to previous crawls'}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                <Card className="border">
                  <CardContent className="p-2.5 text-center">
                    <div className="text-lg font-bold text-foreground">{crawlResult.crawled_pages}</div>
                    <div className="text-[10px] text-muted-foreground">{t.pagesAnalyzedLabel}</div>
                  </CardContent>
                </Card>
                <Card className={`border ${getScoreBg(crawlResult.avg_score || 0)}`}>
                  <CardContent className="p-2.5 text-center">
                    <div className={`text-lg font-bold ${getScoreColor(crawlResult.avg_score || 0)}`}>
                      {crawlResult.avg_score}/200
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.avgScore}</div>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-2.5 text-center">
                    <div className="text-lg font-bold text-foreground">
                      {pages.filter(p => (p.issues || []).length === 0).length}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.perfectPages}</div>
                  </CardContent>
                </Card>
                <Card className="border border-destructive/20 bg-destructive/5">
                  <CardContent className="p-2.5 text-center">
                    <div className="text-lg font-bold text-destructive">
                      {Object.values(issueStats).reduce((s, v) => s + v, 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.totalErrors}</div>
                  </CardContent>
                </Card>
                {/* Weight benchmark */}
                {(() => {
                  const pagesWithWeight = pages.filter(p => (p as any).html_size_bytes > 0);
                  if (pagesWithWeight.length === 0) return null;
                  const avgWeightKB = Math.round(pagesWithWeight.reduce((s, p) => s + ((p as any).html_size_bytes || 0), 0) / pagesWithWeight.length / 1024);
                  const weightColor = avgWeightKB < 100 ? 'text-emerald-500' : avgWeightKB < 500 ? 'text-amber-500' : 'text-destructive';
                  return (
                    <Card className="border">
                      <CardContent className="p-2.5 text-center">
                        <div className={`text-lg font-bold ${weightColor}`}>{avgWeightKB} Ko</div>
                        <div className="text-[10px] text-muted-foreground">{language === 'fr' ? 'Poids moyen' : language === 'es' ? 'Peso medio' : 'Avg weight'}</div>
                      </CardContent>
                    </Card>
                  );
                })()}
                {/* Indexed pages inline */}
                {indexedPagesCount != null && (
                  <Card className="border">
                    <CardContent className="p-2.5 text-center">
                      <div className="text-lg font-bold text-primary">{indexedPagesCount.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {language === 'fr' ? 'Indexées Google' : language === 'es' ? 'Indexadas Google' : 'Indexed (Google)'}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Near-duplicate & Schema.org alerts */}
              {(nearDuplicates.length > 0 || schemaErrorPages.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {nearDuplicates.length > 0 && (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Hash className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-foreground">{t.duplicateContent}</div>
                          <div className="text-xs text-muted-foreground">{nearDuplicates.length} {t.pages}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {schemaErrorPages.length > 0 && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-foreground">{t.schemaErrors}</div>
                          <div className="text-xs text-muted-foreground">{schemaErrorPages.length} {t.pages}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Action bar + HTTP Status compact */}
              <div className="flex flex-wrap items-stretch gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleSitemapExport}>
                    <Download className="w-4 h-4" />
                    {t.sitemapExport}
                  </Button>
                  <Button
                    onClick={() => setIsReportOpen(true)}
                    size="default"
                    className="gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,32%)] text-white border border-[hsl(263,50%,25%)] shadow-sm transition-all duration-200"
                  >
                    <FileText className="h-4 w-4" />
                    {t.viewReport}
                  </Button>
                </div>
                {pages.length > 0 && (
                  <div className="ml-auto w-full sm:w-auto sm:max-w-[280px]">
                    <HttpStatusChart pages={pages} language={language} />
                  </div>
                )}
              </div>

              {/* Synthèse IA */}
              {crawlResult.ai_summary && (
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                      {t.aiSummary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground leading-relaxed">{crawlResult.ai_summary}</p>
                    {crawlResult.ai_recommendations?.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">{t.priorityRecs}</h4>
                        {(crawlResult.ai_recommendations as any[]).map((rec: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Badge variant={rec.priority === 'critical' ? 'destructive' : rec.priority === 'high' ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                              {rec.priority}
                            </Badge>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">{rec.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{rec.description}</div>
                              {rec.affected_pages && (
                                <div className="text-xs text-muted-foreground mt-1">📄 {rec.affected_pages} {t.pagesAffected}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Top erreurs */}
              {Object.keys(issueStats).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      {t.topErrors}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(issueStats)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 12)
                        .map(([issue, count]) => (
                          <div key={issue} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                            <span className="text-sm text-foreground font-mono">{issue.replace(/_/g, ' ')}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pages list */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      {t.crawledPages} ({filteredPages.length})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Index/Noindex toggle */}
                      <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
                        <button
                          onClick={() => setIndexFilter(indexFilter === 'noindex' ? 'indexed' : 'noindex')}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            indexFilter === 'indexed' || indexFilter === 'all'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          ✓ Index ({indexedCount})
                        </button>
                        <button
                          onClick={() => setIndexFilter(indexFilter === 'indexed' ? 'noindex' : 'indexed')}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            indexFilter === 'noindex'
                              ? 'bg-destructive/15 text-destructive'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          ✗ Noindex ({noindexCount})
                        </button>
                      </div>
                      <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score_asc">{t.sortScoreAsc}</SelectItem>
                          <SelectItem value="score_desc">{t.sortScoreDesc}</SelectItem>
                          <SelectItem value="path">{t.sortPath}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {sortedPages.map(page => (
                      <div key={page.id} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => setExpandedPage(expandedPage === page.id ? null : page.id)}
                        >
                          <div className={`text-sm font-bold tabular-nums w-16 shrink-0 ${getScoreColor(page.seo_score || 0)}`}>
                            {page.seo_score}/200
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate font-medium">{page.path}</div>
                            <div className="text-xs text-muted-foreground truncate">{page.title || t.noTitle}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {page.crawl_depth !== undefined && page.crawl_depth > 0 && (
                              <Badge variant="outline" className="text-[10px] gap-1"><Layers className="w-3 h-3" />{page.crawl_depth}</Badge>
                            )}
                            {(page.issues || []).length > 0 && (
                              <Badge variant="destructive" className="text-xs">{(page.issues || []).length}</Badge>
                            )}
                            {(page.issues || []).length === 0 && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                            {expandedPage === page.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {expandedPage === page.id && (
                          <div className="px-4 pb-3 pt-1 border-t bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">H1:</span>
                                <span className="text-foreground truncate">{page.h1 || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{t.words}</span>
                                <span className="text-foreground">{page.word_count ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Image className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{t.imgsNoAlt}</span>
                                <span className={(page.images_without_alt ?? 0) > 0 ? 'text-destructive' : 'text-emerald-500'}>{page.images_without_alt ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Status:</span>
                                <span className={page.http_status === 200 ? 'text-emerald-500' : 'text-destructive'}>{page.http_status}</span>
                              </div>
                              {(page as any).html_size_bytes > 0 && (() => {
                                const sizeKB = Math.round((page as any).html_size_bytes / 1024);
                                const weightColor = sizeKB < 100 ? 'text-emerald-500' : sizeKB < 500 ? 'text-amber-500' : 'text-destructive';
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-muted-foreground">{t.weight}</span>
                                    <span className={weightColor}>{sizeKB} Ko</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {page.has_schema_org && <Badge variant="secondary" className="text-[10px]">Schema.org ✓</Badge>}
                              {page.has_canonical && (() => {
                                const hasCanonicalMismatch = Array.isArray(page.issues) && page.issues.includes('canonical_mismatch');
                                return hasCanonicalMismatch
                                  ? <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">Canonical ⚠</Badge>
                                  : <Badge variant="secondary" className="text-[10px]">Canonical ✓</Badge>;
                              })()}
                              {page.has_og && <Badge variant="secondary" className="text-[10px]">OpenGraph ✓</Badge>}
                              {!page.has_schema_org && <Badge variant="destructive" className="text-[10px]">Schema.org ✗</Badge>}
                              {!page.has_canonical && <Badge variant="destructive" className="text-[10px]">Canonical ✗</Badge>}
                              {!page.has_og && <Badge variant="destructive" className="text-[10px]">OG ✗</Badge>}
                            </div>
                            {/* Schema.org types & errors */}
                            {Array.isArray(page.schema_org_types) && page.schema_org_types.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {page.schema_org_types.map((type, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] text-violet-400 border-violet-400/30">{String(type)}</Badge>
                                ))}
                              </div>
                            )}
                            {Array.isArray(page.schema_org_errors) && page.schema_org_errors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {page.schema_org_errors.map((err, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono">{String(err)}</span>
                                ))}
                              </div>
                            )}
                            {/* Page type classification */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                                {language === 'en' ? 'Page type' : language === 'es' ? 'Tipo de página' : 'Type de page'}
                              </span>
                              <Select
                                value={(page as any).page_type_override || 'auto'}
                                onValueChange={async (val) => {
                                  const override = val === 'auto' ? null : val;
                                  await supabase.from('crawl_pages' as any).update({ page_type_override: override } as any).eq('id', page.id);
                                  setPages(prev => prev.map(p => p.id === page.id ? { ...p, page_type_override: override } as any : p));
                                  toast.success(language === 'en' ? 'Classification updated' : language === 'es' ? 'Clasificación actualizada' : 'Classification mise à jour');
                                }}
                              >
                                <SelectTrigger className="h-6 w-36 text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                                  <SelectItem value="homepage" className="text-xs">{language === 'en' ? 'Home' : language === 'es' ? 'Inicio' : 'Accueil'}</SelectItem>
                                  <SelectItem value="blog" className="text-xs">Blog</SelectItem>
                                  <SelectItem value="produit" className="text-xs">{language === 'en' ? 'Product' : language === 'es' ? 'Producto' : 'Produit'}</SelectItem>
                                  <SelectItem value="catégorie" className="text-xs">{language === 'en' ? 'Category' : language === 'es' ? 'Categoría' : 'Catégorie'}</SelectItem>
                                  <SelectItem value="faq" className="text-xs">FAQ</SelectItem>
                                  <SelectItem value="contact" className="text-xs">Contact</SelectItem>
                                  <SelectItem value="tarifs" className="text-xs">{language === 'en' ? 'Pricing' : language === 'es' ? 'Precios' : 'Tarifs'}</SelectItem>
                                  <SelectItem value="guide" className="text-xs">Guide</SelectItem>
                                  <SelectItem value="légal" className="text-xs">{language === 'en' ? 'Legal' : language === 'es' ? 'Legal' : 'Légal'}</SelectItem>
                                  <SelectItem value="à propos" className="text-xs">{language === 'en' ? 'About' : language === 'es' ? 'Acerca de' : 'À propos'}</SelectItem>
                                  <SelectItem value="page" className="text-xs">Page</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Custom extraction */}
                            {page.custom_extraction && Object.keys(page.custom_extraction).length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Extraction</div>
                                {Object.entries(page.custom_extraction).map(([name, value]) => (
                                  <div key={name} className="flex gap-2 text-xs">
                                    <span className="font-medium text-foreground shrink-0">{name}:</span>
                                    <span className="text-muted-foreground truncate">{typeof value === 'object' ? JSON.stringify(value) : (value || '—')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {(page.issues || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(page.issues as string[]).map((issue, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">
                                    {issue.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            </StrategicErrorBoundary>
          )}

          {/* Crawl Comparison */}
          {completedCrawls.length >= 2 && (
            <Card className="mb-6 mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 cursor-pointer" onClick={() => setShowComparison(!showComparison)}>
                  <GitCompare className="w-5 h-5 text-violet-400" />
                  {t.compareCrawls}
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showComparison ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
              {showComparison && (
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">{t.selectCrawlA}</label>
                      <Select value={compareCrawlA} onValueChange={setCompareCrawlA}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {completedCrawls.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.domain} — {new Date(c.created_at).toLocaleDateString()} ({c.avg_score}/200)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">{t.selectCrawlB}</label>
                      <Select value={compareCrawlB} onValueChange={setCompareCrawlB}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {completedCrawls.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.domain} — {new Date(c.created_at).toLocaleDateString()} ({c.avg_score}/200)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCompare}
                      disabled={!compareCrawlA || !compareCrawlB || compareCrawlA === compareCrawlB || isComparing}
                      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white self-end"
                    >
                      {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                      {t.compare}
                    </Button>
                  </div>

                  {comparisonResult && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className={`text-3xl font-bold ${comparisonResult.scoreChange > 0 ? 'text-emerald-500' : comparisonResult.scoreChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {comparisonResult.scoreChange > 0 ? '+' : ''}{comparisonResult.scoreChange} pts
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Score moyen Δ</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                          <div className="text-lg font-bold text-emerald-500">{comparisonResult.newPages.length}</div>
                          <div className="text-xs text-muted-foreground">{t.newPages}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/10 text-center">
                          <div className="text-lg font-bold text-destructive">{comparisonResult.removedPages.length}</div>
                          <div className="text-xs text-muted-foreground">{t.removedPages}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                          <div className="text-lg font-bold text-emerald-500">{comparisonResult.improved.length}</div>
                          <div className="text-xs text-muted-foreground">{t.improvedPages}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                          <div className="text-lg font-bold text-amber-500">{comparisonResult.degraded.length}</div>
                          <div className="text-xs text-muted-foreground">{t.degradedPages}</div>
                        </div>
                      </div>

                      {/* Improved pages detail */}
                      {comparisonResult.improved.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">↑ {t.improvedPages}</div>
                          {comparisonResult.improved.slice(0, 10).map((p, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-xs">
                              <span className="text-foreground font-mono truncate flex-1">{p.path}</span>
                              <span className="text-muted-foreground">{p.before}</span>
                              <ArrowRight className="w-3 h-3 mx-1 text-emerald-500" />
                              <span className="text-emerald-500 font-bold">{p.after}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {comparisonResult.degraded.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide">↓ {t.degradedPages}</div>
                          {comparisonResult.degraded.slice(0, 10).map((p, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-xs">
                              <span className="text-foreground font-mono truncate flex-1">{p.path}</span>
                              <span className="text-muted-foreground">{p.before}</span>
                              <ArrowRight className="w-3 h-3 mx-1 text-destructive" />
                              <span className="text-destructive font-bold">{p.after}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

              {/* Action buttons: Rapport + Cocoon for past crawl */}
              {viewingCrawlId && crawlResult && (
                <div className="flex items-center justify-center gap-3 pt-4 pb-2">
                  {siteCrawlReportData && (
                    <Button
                      type="button"
                      onClick={() => setIsReportOpen(true)}
                      className="gap-2 px-4 py-2 text-sm font-semibold bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,30%)] text-white border border-[hsl(263,70%,25%)]"
                    >
                      <FileText className="h-4 w-4" />
                      {t.viewReport}
                    </Button>
                  )}
                  <Link
                    to={`/app/cocoon?autolaunch=${encodeURIComponent(crawlResult.domain)}`}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 px-4 py-2 text-sm font-semibold border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                    >
                      <Sparkles className="h-4 w-4" />
                      Cocoon
                    </Button>
                  </Link>
                  {/* Scan backlinks button */}
                  {crawlBacklinks.length === 0 && crawlResult.status === 'completed' && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isScanningBacklinks}
                      onClick={async () => {
                        if (!user || !crawlResult) return;
                        setIsScanningBacklinks(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('backlink-scanner', {
                            body: { crawl_id: crawlResult.id },
                          });
                          if (error) throw error;
                          if (data?.results?.length) {
                            setCrawlBacklinks(data.results);
                            toast.success(`${data.scanned} pages scannées — backlinks trouvés`);
                          } else {
                            toast.info('Aucun backlink trouvé pour les pages principales');
                          }
                        } catch (err: any) {
                          toast.error(err?.message || 'Erreur lors du scan');
                        } finally {
                          setIsScanningBacklinks(false);
                        }
                      }}
                      className="gap-2 px-4 py-2 text-sm font-semibold border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                    >
                      {isScanningBacklinks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                      Scan Backlinks
                    </Button>
                  )}
                  {crawlBacklinks.length > 0 && (
                    <span className="text-xs text-amber-500/70 flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {crawlBacklinks.length} pages avec backlinks
                    </span>
                  )}
                </div>
              )}


          {/* Past crawls */}
          {pastCrawls.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{t.previousCrawls}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    if (!user) return;
                    // Keep only the latest crawl per domain
                    const latestByDomain = new Map<string, string>();
                    for (const c of pastCrawls) {
                      if (!latestByDomain.has(c.domain)) {
                        latestByDomain.set(c.domain, c.id);
                      }
                    }
                    const idsToDelete = pastCrawls
                      .filter(c => latestByDomain.get(c.domain) !== c.id)
                      .map(c => c.id);

                    if (idsToDelete.length > 0) {
                      await supabase
                        .from('site_crawls')
                        .delete()
                        .in('id', idsToDelete);
                    }

                    // Keep only latest per domain in front
                    const kept = pastCrawls.filter(c => latestByDomain.get(c.domain) === c.id);
                    setPastCrawls(kept);
                    setViewingCrawlId(null);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {language === 'fr' ? 'Nettoyer' : language === 'es' ? 'Limpiar' : 'Clear'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastCrawls.map(c => {
                    const isActive = viewingCrawlId === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => viewCrawl(c)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{c.domain}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')} · {c.crawled_pages} {t.pages}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {c.avg_score && (
                            <span className={`text-sm font-bold ${getScoreColor(c.avg_score)}`}>{c.avg_score}/200</span>
                          )}
                          <Badge variant={c.status === 'completed' ? 'default' : c.status === 'error' ? 'destructive' : 'secondary'}>
                            {c.status}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CTA Cocoon + SEO content — hidden for subscribers */}
          {!isAgencyPro && (
            <>
              <div className="flex justify-center mt-12 mb-8">
                <Link
                  to={`/app/cocoon${crawlResult?.domain ? `?autolaunch=${encodeURIComponent(crawlResult.domain)}` : ''}`}
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-yellow-500 text-yellow-500 font-semibold text-sm tracking-wide uppercase hover:bg-yellow-500/10 transition-colors duration-200"
                >
                  <Sparkles className="h-4 w-4" />
                  Cocoon · Assistant Sémantique
                </Link>
              </div>

              {/* SEO content — H2s at bottom */}
              <div className="mt-16 mb-10 max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">{t.whyTitle}</h2>
                  <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{t.whyText}</p>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3">{t.scoreTitle}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{t.scoreText}</p>
                </div>
              </div>
            </>
          )}

        </div>
      </main>

      <CreditTopUpModal open={showTopUp} onOpenChange={setShowTopUp} currentBalance={credits} />

      {/* Fair-use 5000 pages limit modal with 4 credit cards */}
      {showLimitModal && (
        <FairUseLimitModal
          language={language}
          crawlPagesThisMonth={crawlPagesThisMonth}
          fairUseLimit={FAIR_USE_LIMIT}
          onClose={() => setShowLimitModal(false)}
        />
      )}

      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        type="site_crawl"
        siteCrawlData={siteCrawlReportData}
        currentUrl={siteCrawlReportData?.domain || url}
      />

      {!isAgencyPro && <Footer />}
    </>
  );
}
