/**
 * useSiteCrawl — Extracted business logic from SiteCrawl.tsx (2319 lines → ~600 lines of logic)
 * 
 * Manages: URL state, crawl lifecycle (submit, poll, stop), past crawls,
 * page loading, sitemap pre-scan, crawl comparison, fair-use limits, 
 * and all derived computations (filtered/sorted pages, issue stats, etc.)
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { autoSaveActionPlan } from '@/utils/autoSaveActionPlan';
import microwaveDing from '@/assets/sounds/microwave-ding.mp3';

// ── Types ────────────────────────────────────────────────────
export interface CrawlPage {
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

export interface CrawlResult {
  id: string;
  domain: string;
  url: string;
  status: string;
  total_pages: number;
  crawled_pages: number;
  avg_score: number | null;
  ai_summary: string | null;
  ai_recommendations: Array<string | Record<string, unknown>>;
  created_at: string;
  completed_at: string | null;
}

export interface CustomSelector {
  name: string;
  selector: string;
  type: 'css';
}

export interface ComparisonResult {
  newPages: string[];
  removedPages: string[];
  improved: { path: string; before: number; after: number }[];
  degraded: { path: string; before: number; after: number }[];
  scoreChange: number;
}

export interface SitemapTreeNode {
  path: string;
  label: string;
  count: number;
}

export interface SitemapPageNode {
  path: string;
  label: string;
}

// ── Helpers ──────────────────────────────────────────────────
export function getCreditCost(pages: number): number {
  if (pages <= 50) return 5;
  if (pages <= 100) return 10;
  if (pages <= 200) return 15;
  if (pages <= 350) return 25;
  return 40;
}

export function getScoreColor(score: number): string {
  if (score >= 160) return 'text-emerald-500';
  if (score >= 120) return 'text-amber-500';
  return 'text-red-500';
}

export function getScoreBg(score: number): string {
  if (score >= 160) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 120) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function generateSitemapXml(pages: CrawlPage[], domain: string): string {
  const urls = pages
    .filter(p => p.http_status === 200 && !(p.issues || []).includes('noindex'))
    .map(p => {
      const loc = p.url.startsWith('http') ? p.url : `https://${domain}${p.path}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <priority>${(p.seo_score || 0) >= 160 ? '1.0' : (p.seo_score || 0) >= 120 ? '0.8' : '0.5'}</priority>\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

// ── Hook ─────────────────────────────────────────────────────
export function useSiteCrawl(language: string, translations: Record<string, string>) {
  const { user, loading } = useAuth();
  const { balance: credits, isAgencyPro, planType } = useCredits();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const t = translations;

  const isUnlimited = isAgencyPro || isAdmin;
  const isAgencyPlus = isAdmin || planType === 'agency_premium';
  const maxSliderCap = isAgencyPlus ? 50 : 20;

  // ── Core state ──
  const [url, setUrl] = useState(() => {
    try {
      const paramUrl = searchParams.get('url');
      if (paramUrl) return paramUrl;
      return localStorage.getItem('crawl_last_url') || '';
    } catch { return ''; }
  });
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
  const [prediction, setPrediction] = useState<Record<string, unknown> | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [crawlBacklinks, setCrawlBacklinks] = useState<Record<string, unknown>[]>([]);
  const [isScanningBacklinks, setIsScanningBacklinks] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Pre-scan state
  const [indexedPagesCount, setIndexedPagesCount] = useState<number | null>(null);
  const [sitemapPagesCount, setSitemapPagesCount] = useState<number | null>(null);
  const [totalEstimatedPages, setTotalEstimatedPages] = useState<number | null>(null);
  const [isDetectingPages, setIsDetectingPages] = useState(false);

  // Sitemap filters
  const [sitemapTree, setSitemapTree] = useState<SitemapTreeNode[]>([]);
  const [sitemapPages, setSitemapPages] = useState<SitemapPageNode[]>([]);
  const [includeDir, setIncludeDir] = useState('');
  const [excludeDir, setExcludeDir] = useState('');
  const [includePage, setIncludePage] = useState('');
  const [excludePage, setExcludePage] = useState('');

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxDepth, setMaxDepth] = useState(0);
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

  // Upsell / limits
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isButtonShaking, setIsButtonShaking] = useState(false);
  const [crawlPagesThisMonth, setCrawlPagesThisMonth] = useState(0);
  const FAIR_USE_LIMIT = isAgencyPlus ? 50000 : 5000;

  const historySectionRef = useRef<HTMLDivElement | null>(null);
  const pollingCrawlIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const creditCost = isUnlimited ? 0 : getCreditCost(maxPages);

  // ── Effects ──

  // Delayed upsell
  useEffect(() => {
    if (isUnlimited) return;
    const timer = setTimeout(() => setShowUpsell(true), 2500);
    return () => clearTimeout(timer);
  }, [isUnlimited]);

  // Load past crawls
  useEffect(() => {
    if (!user) return;
    supabase
      .from('site_crawls')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setPastCrawls(data as unknown as CrawlResult[]);
      });
    supabase
      .from('profiles')
      .select('crawl_pages_this_month')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setCrawlPagesThisMonth((data as Record<string, number>).crawl_pages_this_month || 0);
      });
  }, [user, crawlResult?.id]);

  // Auto-load crawl from ?view=
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
        const crawl = data as unknown as CrawlResult & { error_message?: string };
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

  // Polling
  useEffect(() => {
    const shouldPoll = crawlResult && !viewingCrawlId && crawlResult.status !== 'completed' && crawlResult.status !== 'error' && crawlResult.status !== 'stopped';

    if (!shouldPoll) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollingCrawlIdRef.current = null;
      }
      return;
    }

    if (pollingCrawlIdRef.current === crawlResult.id) return;

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

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
          const r = data as unknown as CrawlResult & { error_message?: string };
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
            if (user && Array.isArray(sanitizedResult.ai_recommendations) && sanitizedResult.ai_recommendations.length > 0) {
              const crawlTasks = sanitizedResult.ai_recommendations.map((rec, i) => ({
                id: `crawl_${sanitizedResult.id}_${i}`,
                title: typeof rec === 'string' ? rec : ((rec as Record<string, string>)?.title || (rec as Record<string, string>)?.recommendation || (rec as Record<string, string>)?.text || `Recommandation ${i + 1}`),
                priority: ((typeof rec === 'object' && (rec as Record<string, string>)?.priority) || 'important') as 'critical' | 'important' | 'optional',
                category: (typeof rec === 'object' && (rec as Record<string, string>)?.category) || 'crawl',
                isCompleted: false,
              }));
              autoSaveActionPlan({
                userId: user.id,
                url: sanitizedResult.url || `https://${sanitizedResult.domain}`,
                title: `Crawl Multi-Pages — ${sanitizedResult.domain}`,
                auditType: 'crawl',
                tasks: crawlTasks,
              }).catch(() => {});
            }
          }
          if (sanitizedResult.status === 'error') {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            pollingCrawlIdRef.current = null;
            setIsLoading(false);
            setPhase('');
            toast.error(r.error_message || t.errorCrawl);
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

  // Pre-scan sitemap
  useEffect(() => {
    setIndexedPagesCount(null);
    setSitemapPagesCount(null);
    setTotalEstimatedPages(null);
    setSitemapTree([]);
    setSitemapPages([]);
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

        const [serpRes, sitemapRes] = await Promise.all([
          supabase.functions.invoke('fetch-serp-kpis', { body: { domain } }),
          supabase.functions.invoke('fetch-sitemap-tree', { body: { domain } }),
        ]);

        if (cancelled) return;

        const indexed = serpRes.data?.data?.indexed_pages as number | undefined;
        const sitemapTotal = sitemapRes.data?.totalUrls as number | undefined;

        if (indexed != null) setIndexedPagesCount(indexed);
        if (sitemapTotal != null) setSitemapPagesCount(sitemapTotal);

        const tree = sitemapRes.data?.tree as Array<{ path: string; label: string; count: number; children?: unknown[] }> | undefined;
        if (tree && tree.length > 0) {
          const dirs = tree
            .filter(n => n.path !== '/' && n.count > 1)
            .slice(0, 15)
            .map(n => ({ path: n.path, label: n.label, count: n.count }));
          setSitemapTree(dirs);

          const pagePatterns: SitemapPageNode[] = [];
          const seen = new Set<string>();
          for (const node of tree) {
            const nodeUrls = (node as Record<string, unknown>).urls;
            if (Array.isArray(nodeUrls)) {
              for (const u of nodeUrls.slice(0, 5)) {
                try {
                  const parsed = new URL(u as string);
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

        const total = Math.max(indexed || 0, sitemapTotal || 0);
        if (total > 0) {
          setTotalEstimatedPages(total);
          const capMax = (isAgencyPlus || isAdmin) ? total : Math.min(maxSliderCap, total);
          if (maxPages > capMax) setMaxPages(capMax);
        }
      } catch {
        // Silent — pre-scan is best-effort
      } finally {
        if (!cancelled) setIsDetectingPages(false);
      }
    }, 1200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [url]);

  // ── Derived computations ──
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
    (p.issues || []).forEach((issue: string) => { acc[issue] = (acc[issue] || 0) + 1; });
    return acc;
  }, {}), [pages]);

  const nearDuplicates = useMemo(() => pages.filter(p => (p.issues || []).includes('near_duplicate_content')), [pages]);
  const schemaErrorPages = useMemo(() => pages.filter(p => (p.issues || []).includes('schema_org_errors')), [pages]);
  const completedCrawls = useMemo(() => pastCrawls.filter(c => c.status === 'completed'), [pastCrawls]);

  // ── Actions ──
  async function loadPages(crawlId: string) {
    try {
      const [{ data, error }, { data: blData }] = await Promise.all([
        supabase
          .from('crawl_pages')
          .select('*')
          .eq('crawl_id', crawlId)
          .order('seo_score', { ascending: true }),
        supabase
          .from('crawl_page_backlinks' as 'crawl_pages')
          .select('*')
          .eq('crawl_id', crawlId)
          .order('referring_domains', { ascending: false }),
      ]);
      if (error) console.error('[loadPages] Error:', error);
      if (data) {
        const sanitized = data.map((p: Record<string, unknown>) => ({
          ...p,
          path: (p.path as string) || (p.url as string) || '',
          word_count: (p.word_count as number) ?? 0,
          images_without_alt: (p.images_without_alt as number) ?? 0,
          seo_score: (p.seo_score as number) ?? 0,
          issues: Array.isArray(p.issues) ? p.issues : [],
          schema_org_types: Array.isArray(p.schema_org_types) ? p.schema_org_types : [],
          schema_org_errors: Array.isArray(p.schema_org_errors) ? p.schema_org_errors : [],
          broken_links: Array.isArray(p.broken_links) ? p.broken_links : [],
          anchor_texts: Array.isArray(p.anchor_texts) ? p.anchor_texts : [],
          custom_extraction: (p.custom_extraction && typeof p.custom_extraction === 'object' && !Array.isArray(p.custom_extraction)) ? p.custom_extraction : {},
        }));
        setPages(sanitized as CrawlPage[]);
      }
      setCrawlBacklinks((blData || []) as Record<string, unknown>[]);
    } catch {
      // Silent
    }
  }

  const viewCrawl = useCallback(async (crawl: CrawlResult) => {
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
  }, [t.errorCrawl]);

  const resetViewedCrawl = useCallback(() => {
    setViewingCrawlId(null);
    setCrawlResult(null);
    setPages([]);
    setExpandedPage(null);
    setCrawlBacklinks([]);
  }, []);

  const addSelector = useCallback(() => {
    if (!newSelectorName.trim() || !newSelectorValue.trim()) return;
    setCustomSelectors(prev => [...prev, { name: newSelectorName.trim(), selector: newSelectorValue.trim(), type: 'css' }]);
    setNewSelectorName('');
    setNewSelectorValue('');
  }, [newSelectorName, newSelectorValue]);

  const removeSelector = useCallback((index: number) => {
    setCustomSelectors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/auth'); return; }
    try { localStorage.setItem('crawl_last_url', url); } catch {}

    if (isUnlimited && (crawlPagesThisMonth >= FAIR_USE_LIMIT || crawlPagesThisMonth + maxPages > FAIR_USE_LIMIT)) {
      setIsButtonShaking(true);
      setTimeout(() => { setIsButtonShaking(false); setShowLimitModal(true); }, 600);
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
        body: { url, maxPages, userId: user.id, maxDepth: maxDepth || 0, urlFilter: effectiveFilter || '', customSelectors },
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
          ...(crawl as unknown as CrawlResult),
          ai_recommendations: Array.isArray((crawl as Record<string, unknown>).ai_recommendations) ? (crawl as Record<string, unknown>).ai_recommendations as CrawlResult['ai_recommendations'] : [],
        };
        setCrawlResult(sanitized);
        setPastCrawls(prev => {
          const next = [sanitized, ...prev.filter(c => c.id !== sanitized.id)];
          return next.slice(0, 20);
        });
        setPhase(`${data.totalPages} ${t.auditQueued}`);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || t.errorCrawl);
      setIsLoading(false);
      setPhase('');
    }
  }, [user, url, maxPages, isUnlimited, credits, creditCost, crawlPagesThisMonth, FAIR_USE_LIMIT, urlFilter, includeDir, excludeDir, includePage, excludePage, maxDepth, customSelectors, navigate, t]);

  const handleStopCrawl = useCallback(async (crawlId?: string) => {
    const targetId = crawlId || crawlResult?.id;
    if (!targetId) return;
    try {
      await supabase
        .from('site_crawls')
        .update({ status: 'stopped', error_message: 'Stopped by user — cached data preserved' })
        .eq('id', targetId);

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollingCrawlIdRef.current = null;
      }

      if (!crawlId || crawlId === crawlResult?.id) {
        setCrawlResult(prev => prev ? { ...prev, status: 'stopped' } : prev);
        setIsLoading(false);
        setPhase('');
      }

      setPastCrawls(prev => prev.map(c => c.id === targetId ? { ...c, status: 'stopped' } : c));
      toast.success(t.crawlStopped);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error stopping crawl');
    }
  }, [crawlResult?.id, t.crawlStopped]);

  const handleSitemapExport = useCallback(async () => {
    if (pages.length === 0) return;
    const domain = crawlResult?.domain || '';
    const xml = generateSitemapXml(pages, domain);
    const blob = new Blob([xml], { type: 'application/xml' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const { getReportFilename } = await import('@/utils/reportFilename');
    a.download = getReportFilename(domain, 'crawl', 'xml');
    a.click();
    URL.revokeObjectURL(blobUrl);
    toast.success('Sitemap XML téléchargé');
  }, [pages, crawlResult?.domain]);

  const handleCompare = useCallback(async () => {
    if (!compareCrawlA || !compareCrawlB || compareCrawlA === compareCrawlB) return;
    setIsComparing(true);
    setComparisonResult(null);

    try {
      const [{ data: pagesA }, { data: pagesB }] = await Promise.all([
        supabase.from('crawl_pages').select('path, seo_score, url').eq('crawl_id', compareCrawlA),
        supabase.from('crawl_pages').select('path, seo_score, url').eq('crawl_id', compareCrawlB),
      ]);

      if (!pagesA || !pagesB) { toast.error('Impossible de charger les données'); return; }

      const mapA = new Map(pagesA.map((p: Record<string, unknown>) => [(p.path as string), (p.seo_score as number) || 0]));
      const mapB = new Map(pagesB.map((p: Record<string, unknown>) => [(p.path as string), (p.seo_score as number) || 0]));

      const newPages = pagesB.filter((p: Record<string, unknown>) => !mapA.has(p.path as string)).map((p: Record<string, unknown>) => p.path as string);
      const removedPages = pagesA.filter((p: Record<string, unknown>) => !mapB.has(p.path as string)).map((p: Record<string, unknown>) => p.path as string);

      const improved: ComparisonResult['improved'] = [];
      const degraded: ComparisonResult['degraded'] = [];

      for (const [path, scoreB] of mapB.entries()) {
        const scoreA = mapA.get(path);
        if (scoreA !== undefined) {
          if (scoreB > scoreA + 5) improved.push({ path, before: scoreA, after: scoreB });
          else if (scoreB < scoreA - 5) degraded.push({ path, before: scoreA, after: scoreB });
        }
      }

      const avgA = pagesA.length > 0 ? pagesA.reduce((s: number, p: Record<string, unknown>) => s + ((p.seo_score as number) || 0), 0) / pagesA.length : 0;
      const avgB = pagesB.length > 0 ? pagesB.reduce((s: number, p: Record<string, unknown>) => s + ((p.seo_score as number) || 0), 0) / pagesB.length : 0;

      setComparisonResult({
        newPages,
        removedPages,
        improved: improved.sort((a, b) => (b.after - b.before) - (a.after - a.before)),
        degraded: degraded.sort((a, b) => (a.after - a.before) - (b.after - b.before)),
        scoreChange: Math.round(avgB - avgA),
      });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erreur comparaison');
    } finally {
      setIsComparing(false);
    }
  }, [compareCrawlA, compareCrawlB]);

  const handleSubscribe = useCallback(async () => {
    if (!user) { navigate('/auth?returnTo=/site-crawl'); return; }
    setSubscribeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', {
        body: { action: 'subscription', returnUrl: window.location.href }
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank', 'noopener');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur');
    } finally {
      setSubscribeLoading(false);
    }
  }, [user, navigate]);

  return {
    // Auth/plan
    user, loading, adminLoading, isAdmin, isUnlimited, isAgencyPlus, credits, language,
    // Core state
    url, setUrl, maxPages, setMaxPages, maxSliderCap, isLoading, crawlResult, pages, progress, phase,
    showTopUp, setShowTopUp, expandedPage, setExpandedPage, sortBy, setSortBy,
    indexFilter, setIndexFilter, pastCrawls, viewingCrawlId, isLoadingPastCrawl,
    prediction, setPrediction, isPredicting, setIsPredicting,
    crawlBacklinks, isScanningBacklinks, setIsScanningBacklinks,
    isReportOpen, setIsReportOpen,
    // Pre-scan
    indexedPagesCount, sitemapPagesCount, totalEstimatedPages, isDetectingPages,
    // Sitemap filters
    sitemapTree, sitemapPages, includeDir, setIncludeDir, excludeDir, setExcludeDir,
    includePage, setIncludePage, excludePage, setExcludePage,
    // Advanced
    showAdvanced, setShowAdvanced, maxDepth, setMaxDepth, urlFilter, setUrlFilter,
    customSelectors, newSelectorName, setNewSelectorName, newSelectorValue, setNewSelectorValue,
    // Comparison
    showComparison, setShowComparison, compareCrawlA, setCompareCrawlA, compareCrawlB, setCompareCrawlB,
    comparisonResult, isComparing,
    // Upsell/limits
    subscribeLoading, showUpsell, showLimitModal, setShowLimitModal, isButtonShaking,
    crawlPagesThisMonth, FAIR_USE_LIMIT, creditCost,
    // Derived
    filteredPages, sortedPages, indexedCount, noindexCount, issueStats, nearDuplicates, schemaErrorPages, completedCrawls,
    // Refs
    historySectionRef,
    // Actions
    viewCrawl, resetViewedCrawl, addSelector, removeSelector, handleSubmit, handleStopCrawl,
    handleSitemapExport, handleCompare, handleSubscribe,
  };
}
