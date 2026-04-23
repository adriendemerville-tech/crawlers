import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import microwaveDing from '@/assets/sounds/microwave-ding.mp3';
import { autoSaveActionPlan } from '@/utils/autoSaveActionPlan';
import { crawlI18n } from '@/components/SiteCrawl/crawlI18n';
import type { CrawlPage, CrawlResult, CustomSelector, ComparisonResult } from '@/components/SiteCrawl/types';
import { getCreditCost } from '@/components/SiteCrawl/types';

export function useCrawlEngine() {
  const { user, loading } = useAuth();
  const { balance: credits, isAgencyPro, planType } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const t = crawlI18n[language];

  const isUnlimited = isAgencyPro || isAdmin;
  const isAgencyPlus = isAdmin || planType === 'agency_premium';
  const isPaidPlan = isAgencyPro || isAgencyPlus;
  const maxSliderCap = isAgencyPlus ? 50 : isAgencyPro ? 30 : 20;

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
  const [prediction, setPrediction] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [crawlBacklinks, setCrawlBacklinks] = useState<any[]>([]);
  const [isScanningBacklinks, setIsScanningBacklinks] = useState(false);
  const [indexationMap, setIndexationMap] = useState<Record<string, { verdict: string; coverage_state: string | null }>>({});
  const [indexedPagesCount, setIndexedPagesCount] = useState<number | null>(null);
  const [sitemapPagesCount, setSitemapPagesCount] = useState<number | null>(null);
  const [totalEstimatedPages, setTotalEstimatedPages] = useState<number | null>(null);
  const [isDetectingPages, setIsDetectingPages] = useState(false);
  const [detectionDone, setDetectionDone] = useState(false);
  const [preScanDone, setPreScanDone] = useState(false);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Sitemap directory & page selectors
  const [sitemapTree, setSitemapTree] = useState<Array<{ path: string; label: string; count: number }>>([]);
  const [sitemapPages, setSitemapPages] = useState<Array<{ path: string; label: string }>>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const [includeDir, setIncludeDir] = useState<string>('');
  const [excludeDir, setExcludeDir] = useState<string>('');
  const [includePage, setIncludePage] = useState<string>('');
  const [excludePage, setExcludePage] = useState<string>('');

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
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isButtonShaking, setIsButtonShaking] = useState(false);
  const [crawlPagesThisMonth, setCrawlPagesThisMonth] = useState(0);
  const FAIR_USE_LIMIT = isAgencyPlus ? 50000 : 5000;
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const creditCost = isUnlimited ? 0 : getCreditCost(maxPages);

  // ── Delayed upsell reveal ──
  useEffect(() => {
    if (isUnlimited) return;
    const timer = setTimeout(() => setShowUpsell(true), 2500);
    return () => clearTimeout(timer);
  }, [isUnlimited]);

  // ── Load past crawls ──
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
    supabase
      .from('profiles')
      .select('crawl_pages_this_month')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setCrawlPagesThisMonth(data.crawl_pages_this_month || 0);
      });
  }, [user, crawlResult?.id]);

  // ── Auto-load crawl from ?view= ──
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

  // ── Auto-start from Felix ──
  const felixAutoStartRef = useRef(false);
  useEffect(() => {
    if (felixAutoStartRef.current) return;
    const fromFelix = searchParams.get('from') === 'felix';
    const autostart = searchParams.get('autostart') === 'true';
    const paramUrl = searchParams.get('url');
    if (fromFelix && autostart && paramUrl && user && !loading) {
      felixAutoStartRef.current = true;
      setUrl(paramUrl);
      navigate('/app/site-crawl', { replace: true });
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handleSubmit(fakeEvent);
      }, 500);
    }
  }, [searchParams, user, loading]);

  // ── Polling ──
  const pollingCrawlIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          if (sanitizedResult.total_pages > 0) {
            setProgress(Math.round((sanitizedResult.crawled_pages / sanitizedResult.total_pages) * 100));
            // Sync totalEstimatedPages with backend's actual total (Pass 2 may discover more)
            setTotalEstimatedPages(prev => {
              const backendTotal = sanitizedResult.total_pages;
              return (!prev || backendTotal > prev) ? backendTotal : prev;
            });
          }
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
              const crawlTasks = sanitizedResult.ai_recommendations.map((rec: any, i: number) => ({
                id: `crawl_${sanitizedResult.id}_${i}`,
                title: typeof rec === 'string' ? rec : (rec?.title || rec?.recommendation || rec?.text || `Recommandation ${i + 1}`),
                priority: (typeof rec === 'object' && rec?.priority) || 'important' as const,
                category: (typeof rec === 'object' && rec?.category) || 'crawl',
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

  // ── Pre-scan: detect pages on URL change ──
  useEffect(() => {
    setIndexedPagesCount(null);
    setSitemapPagesCount(null);
    setTotalEstimatedPages(null);
    setDetectionDone(false);
    setPreScanDone(false);
    setDiscoveredUrls([]);
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

        const [serpRes, sitemapRes] = await Promise.all([
          supabase.functions.invoke('fetch-serp-kpis', { body: { domain } }),
          supabase.functions.invoke('fetch-sitemap-tree', { body: { domain } }),
        ]);

        if (cancelled) return;

        const indexed = serpRes.data?.data?.indexed_pages as number | undefined;
        const sitemapTotal = sitemapRes.data?.totalUrls as number | undefined;

        if (indexed != null) setIndexedPagesCount(indexed);
        if (sitemapTotal != null) setSitemapPagesCount(sitemapTotal);

        const tree = sitemapRes.data?.tree as Array<{ path: string; label: string; count: number; children?: any[] }> | undefined;
        if (tree && tree.length > 0) {
          const dirs = tree
            .filter(n => n.path !== '/' && n.count > 1)
            .slice(0, 15)
            .map(n => ({ path: n.path, label: n.label, count: n.count }));
          setSitemapTree(dirs);

          const pagePatterns: Array<{ path: string; label: string }> = [];
          const seen = new Set<string>();
          for (const node of tree) {
            const nodeUrls = (node as any).urls;
            if (Array.isArray(nodeUrls)) {
              for (const u of nodeUrls.slice(0, 5)) {
                try {
                  const parsed = new URL(u);
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

        const total = sitemapTotal && sitemapTotal > 0 ? sitemapTotal : (indexed || 0);
        if (total > 0) {
          setTotalEstimatedPages(total);
          const capMax = (isAgencyPlus || isAdmin) ? total : Math.min(maxSliderCap, total);
          if (maxPages > capMax) {
            setMaxPages(capMax);
          }
        }

        // Phase 0 complete: unlock slider + launch button
        if (!cancelled) setPreScanDone(true);
      } catch {
        // Silent
      } finally {
        if (!cancelled) setIsDetectingPages(false);
      }
    }, 1200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [url]);

  // ── Computed values ──
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

  // ── Handlers ──
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
      if (error) console.error('[loadPages] Error:', error);
      if (data) {
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

        const pageUrls = sanitized.map((p: any) => p.url).filter(Boolean);
        if (pageUrls.length > 0) {
          const { data: idxData } = await supabase
            .from('indexation_checks')
            .select('page_url, verdict, coverage_state')
            .in('page_url', pageUrls.slice(0, 500));
          if (idxData?.length) {
            const map: Record<string, { verdict: string; coverage_state: string | null }> = {};
            for (const row of idxData) {
              map[row.page_url] = { verdict: row.verdict, coverage_state: row.coverage_state };
            }
            setIndexationMap(map);
          }
        }
      }
      setCrawlBacklinks(blData || []);
    } catch {
      // Silent
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

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate('/auth'); return; }
    try { localStorage.setItem('crawl_last_url', url); } catch {}

    setIsDetectingPages(true);
    setDetectionDone(false);
    setDiscoveredUrls([]);

    try {
      const { data, error } = await supabase.functions.invoke('crawl-site', {
        body: { url, userId: user.id, mode: 'detect' },
      });

      if (error) throw error;
      if (!data.success) {
        toast.error(data.error || 'Erreur de détection');
        return;
      }

      const detectedUrls: string[] = data.urls || [];
      setDiscoveredUrls(detectedUrls);
      setTotalEstimatedPages(data.totalDiscovered || detectedUrls.length);
      setSitemapPagesCount(data.sources?.sitemap || null);
      setIndexedPagesCount(data.sources?.gscIndexed || null);

      if (data.directories?.length > 0) {
        setSitemapTree(data.directories.slice(0, 15));
      }

      const total = detectedUrls.length;
      if (total > 0) {
        // Max slider = nombre de pages détectées (admin/agency+ illimité, autres bornés au cap plan)
        const cap = (isAdmin || isAgencyPlus) ? total : Math.min(total, maxSliderCap);
        setMaxPages(cap);
      }

      setDetectionDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de détection');
    } finally {
      setIsDetectingPages(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate('/auth'); return; }
    try { localStorage.setItem('crawl_last_url', url); } catch {}
    
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

    // Archive current crawl into past crawls before resetting
    if (crawlResult && crawlResult.id && crawlResult.status === 'completed') {
      setPastCrawls(prev => {
        if (prev.some(c => c.id === crawlResult.id)) return prev;
        return [crawlResult, ...prev].slice(0, 20);
      });
    }

    setIsLoading(true);
    setPhase(t.mapping);
    setProgress(0);
    setPages([]);
    setCrawlResult(null);
    setViewingCrawlId(null);

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
    } catch (err: any) {
      toast.error(err.message || t.errorCrawl);
      setIsLoading(false);
      setPhase('');
    }
  }

  async function handleStopCrawl(crawlId?: string) {
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
    } catch (err: any) {
      toast.error(err.message || 'Error stopping crawl');
    }
  }

  async function handleSitemapExport() {
    if (pages.length === 0) return;
    const { generateSitemapXml } = await import('@/components/SiteCrawl/types');
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
  }

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

  async function handleScanBacklinks() {
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
  }

  async function handleSubscribe() {
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
  }

  async function handleCleanPastCrawls() {
    if (!user) return;
    const finishedCrawls = pastCrawls.filter(c => c.status !== 'running' && c.status !== 'pending');
    const latestByDomain = new Map<string, string>();
    for (const c of finishedCrawls) {
      if (!latestByDomain.has(c.domain)) {
        latestByDomain.set(c.domain, c.id);
      }
    }
    const idsToDelete = finishedCrawls
      .filter(c => latestByDomain.get(c.domain) !== c.id)
      .map(c => c.id);

    if (idsToDelete.length > 0) {
      await supabase
        .from('site_crawls')
        .delete()
        .in('id', idsToDelete);
    }

    const kept = pastCrawls.filter(c => (c.status === 'running' || c.status === 'pending') || latestByDomain.get(c.domain) === c.id);
    setPastCrawls(kept);
    setViewingCrawlId(null);
  }

  async function handleDeleteCrawl(crawlId: string) {
    await supabase.from('site_crawls').delete().eq('id', crawlId);
    setPastCrawls(prev => prev.filter(x => x.id !== crawlId));
    if (viewingCrawlId === crawlId) {
      setViewingCrawlId(null);
      setPages([]);
    }
    toast.success(language === 'fr' ? 'Crawl supprimé' : 'Crawl deleted');
  }

  return {
    // Auth & config
    user, loading, adminLoading, language, t, isAdmin,
    isUnlimited, isAgencyPro, isAgencyPlus, isPaidPlan, maxSliderCap,
    credits, creditCost,

    // Core state
    url, setUrl,
    maxPages, setMaxPages,
    isLoading, crawlResult, pages, setPages,
    showTopUp, setShowTopUp,
    progress, phase,
    expandedPage, setExpandedPage,
    sortBy, setSortBy,
    indexFilter, setIndexFilter,
    pastCrawls, setPastCrawls,
    viewingCrawlId,
    isLoadingPastCrawl,
    prediction, setPrediction,
    isPredicting, setIsPredicting,
    crawlBacklinks,
    isScanningBacklinks,
    indexationMap,
    indexedPagesCount,
    sitemapPagesCount,
    totalEstimatedPages,
    isDetectingPages,
    detectionDone,
    preScanDone,
    discoveredUrls,
    isReportOpen, setIsReportOpen,

    // Sitemap filters
    sitemapTree, sitemapPages,
    selectedDirectory, setSelectedDirectory,
    includeDir, setIncludeDir,
    excludeDir, setExcludeDir,
    includePage, setIncludePage,
    excludePage, setExcludePage,

    // Advanced
    showAdvanced, setShowAdvanced,
    maxDepth, setMaxDepth,
    urlFilter, setUrlFilter,
    customSelectors, newSelectorName, setNewSelectorName,
    newSelectorValue, setNewSelectorValue,

    // Comparison
    showComparison, setShowComparison,
    compareCrawlA, setCompareCrawlA,
    compareCrawlB, setCompareCrawlB,
    comparisonResult, isComparing,

    // Upsell / limits
    subscribeLoading, showUpsell, showLimitModal, setShowLimitModal,
    isButtonShaking, crawlPagesThisMonth, FAIR_USE_LIMIT,

    // Computed
    filteredPages, sortedPages,
    indexedCount, noindexCount,
    issueStats, nearDuplicates, schemaErrorPages, completedCrawls,

    // Refs
    historySectionRef,

    // Handlers
    handleDetect, handleSubmit, handleStopCrawl,
    handleSitemapExport, handleCompare,
    handleScanBacklinks, handleSubscribe,
    handleCleanPastCrawls, handleDeleteCrawl,
    viewCrawl, resetViewedCrawl,
    addSelector, removeSelector,
  };
}
