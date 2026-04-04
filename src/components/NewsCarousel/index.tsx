import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NewsCard } from './NewsCard';
import { NewsCardSkeleton } from './NewsCardSkeleton';
import { NewsArticle, WhitelistState } from '@/types/news';
import {
  fetchArticles,
  refreshArticles,
  getWhitelistFromStorage,
  saveWhitelistToStorage,
} from '@/data/mockNewsData';
import { useLanguage } from '@/contexts/LanguageContext';

// Lazy load framer-motion to prevent layout thrashing on initial load
const MotionDiv = lazy(() =>
  import('framer-motion').then(mod => ({
    default: mod.motion.div
  }))
);
const AnimatePresenceLazy = lazy(() =>
  import('framer-motion').then(mod => ({
    default: mod.AnimatePresence
  }))
);

const AUTO_SCROLL_INTERVAL = 30000; // 30 seconds
const CARD_WIDTH_MOBILE = 256; // 240px card + 16px gap
const CARD_WIDTH_DESKTOP = 356; // 340px card + 16px gap

type CategoryFilter = 'ALL' | 'SEO' | 'LLM' | 'GEO';

const categoryColors: Record<CategoryFilter, string> = {
  ALL: 'bg-primary hover:bg-primary/90',
  SEO: 'bg-emerald-500 hover:bg-emerald-600',
  LLM: 'bg-violet-500 hover:bg-violet-600',
  GEO: 'bg-amber-500 hover:bg-amber-600',
};

export function NewsCarousel() {
  const { t, language } = useLanguage();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [whitelist, setWhitelist] = useState<WhitelistState>(getWhitelistFromStorage);
  const [newSourceDiscovered, setNewSourceDiscovered] = useState<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search to avoid too many API calls
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const loadArticles = useCallback(async (search = '', category = '') => {
    setIsLoading(true);
    try {
      const categoryParam = category === 'ALL' ? '' : category;
      const data = await fetchArticles(whitelist, false, language, search, categoryParam);
      setArticles(data);
      setFilteredArticles(data);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [whitelist, language]);

  // Initial load
  useEffect(() => {
    loadArticles(debouncedSearch, categoryFilter);
  }, [debouncedSearch, categoryFilter, language]);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500); // 500ms debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Articles are now filtered server-side, just update filteredArticles when articles change
  useEffect(() => {
    setFilteredArticles(articles);
  }, [articles]);

  // Auto-scroll functionality - deferred to prevent layout thrashing
  useEffect(() => {
    // Use requestIdleCallback to defer scroll measurements
    const startAutoScroll = () => {
      autoScrollRef.current = setInterval(() => {
        if (scrollContainerRef.current && filteredArticles.length > 0) {
          // Use requestAnimationFrame to batch DOM reads/writes
          requestAnimationFrame(() => {
            const container = scrollContainerRef.current;
            if (!container) return;
            
            // Read phase - batch all reads together
            const scrollLeft = container.scrollLeft;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;
            const maxScroll = scrollWidth - clientWidth;
            
            // Write phase - after reads complete
            requestAnimationFrame(() => {
              if (!container) return;
              if (scrollLeft >= maxScroll - 10) {
                container.scrollTo({ left: 0, behavior: 'smooth' });
              } else {
                container.scrollBy({ left: window.innerWidth < 640 ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP, behavior: 'smooth' });
              }
            });
          });
        }
      }, AUTO_SCROLL_INTERVAL);
    };

    // Defer auto-scroll start to after initial render
    const timeoutId = setTimeout(startAutoScroll, 1000);

    return () => {
      clearTimeout(timeoutId);
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
    };
  }, [filteredArticles.length]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Force refresh - appel API réel avec les paramètres actuels
      const categoryParam = categoryFilter === 'ALL' ? '' : categoryFilter;
      const data = await refreshArticles(whitelist, language, debouncedSearch, categoryParam);
      setArticles(data);
      setFilteredArticles(data);
      
      // Mettre à jour la whitelist avec les nouvelles sources découvertes
      const currentWhitelist = getWhitelistFromStorage();
      if (currentWhitelist.sources.length > whitelist.sources.length) {
        const newSourceNames = currentWhitelist.sources
          .filter(s => !whitelist.sources.some(ws => ws.name === s.name))
          .map(s => s.name);
        
        if (newSourceNames.length > 0) {
          setNewSourceDiscovered(newSourceNames[0]);
          setTimeout(() => setNewSourceDiscovered(null), 5000);
        }
        
        setWhitelist(currentWhitelist);
      }
      
      // Mettre à jour les trust scores
      const updatedSources = currentWhitelist.sources.map(source => ({
        ...source,
        trustScore: Math.min(source.trustScore + 1, 100),
        lastCrawled: new Date().toISOString(),
      }));
      
      const updatedWhitelist: WhitelistState = {
        sources: updatedSources,
        lastUpdated: new Date().toISOString(),
      };
      setWhitelist(updatedWhitelist);
      saveWhitelistToStorage(updatedWhitelist);
      
    } catch (error) {
      console.error('Error refreshing articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCardWidth = () => window.innerWidth < 640 ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP;

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -getCardWidth(), behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
  };

  const handleCategoryClick = (category: CategoryFilter) => {
    setCategoryFilter(category);
  };

  const getCategoryCount = (category: 'SEO' | 'LLM' | 'GEO') => {
    return articles.filter(a => a.category === category).length;
  };

  return (
    <section className="py-6 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">
              {language === 'fr' ? 'Veille SEO, LLM et GEO : actualités et tendances du référencement IA' : language === 'es' ? 'Vigilancia SEO, LLM y GEO: noticias y tendencias del posicionamiento IA' : 'SEO, LLM & GEO watch: AI search news and trends'}
            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder=""
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 w-full sm:w-60"
              />
            </div>
            
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t.news?.refresh || 'Actualiser'}
            </Button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={categoryFilter === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleCategoryClick('ALL')}
            className={categoryFilter === 'ALL' ? categoryColors.ALL : ''}
          >
            {language === 'fr' ? 'Tous' : language === 'es' ? 'Todos' : 'All'} ({articles.length})
          </Button>
          <Button
            variant={categoryFilter === 'SEO' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleCategoryClick('SEO')}
            className={categoryFilter === 'SEO' ? `${categoryColors.SEO} text-white border-0` : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'}
          >
            SEO ({getCategoryCount('SEO')})
          </Button>
          <Button
            variant={categoryFilter === 'LLM' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleCategoryClick('LLM')}
            className={categoryFilter === 'LLM' ? `${categoryColors.LLM} text-white border-0` : 'border-violet-500 text-violet-600 hover:bg-violet-50'}
          >
            LLM ({getCategoryCount('LLM')})
          </Button>
          <Button
            variant={categoryFilter === 'GEO' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleCategoryClick('GEO')}
            className={categoryFilter === 'GEO' ? `${categoryColors.GEO} text-white border-0` : 'border-amber-500 text-amber-600 hover:bg-amber-50'}
          >
            GEO ({getCategoryCount('GEO')})
          </Button>
        </div>

        {/* New source notification - with CSS containment to prevent layout thrashing */}
        {newSourceDiscovered && (
          <Suspense fallback={null}>
            <AnimatePresenceLazy>
              <MotionDiv
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2"
                style={{ contain: 'layout style' }}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {t.news?.newSource || 'Nouvelle source découverte :'} {newSourceDiscovered}
                </span>
              </MotionDiv>
            </AnimatePresenceLazy>
          </Suspense>
        )}

        {/* Carousel */}
        <div className="relative group">
          {/* Navigation buttons - Desktop only */}
          <Button
            variant="secondary"
            size="icon"
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity shadow-lg -translate-x-4"
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity shadow-lg translate-x-4"
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Scrollable container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              contain: 'paint layout',
              willChange: 'scroll-position'
            }}
          >
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 5 }).map((_, index) => (
                <NewsCardSkeleton key={index} />
              ))
            ) : filteredArticles.length > 0 ? (
              // Article cards - limit to 15
              filteredArticles.slice(0, 15).map((article, index) => (
                <NewsCard key={article.id} article={article} index={index} />
              ))
            ) : (
              // Empty state
              <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
                <p>{t.news?.noResults || 'Aucun article trouvé'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Source info */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          {t.news?.sourcesCount?.replace('{count}', whitelist.sources.length.toString()) || 
            `${whitelist.sources.length} sources surveillées`} • {t.news?.lastUpdate || 'Dernière mise à jour'}: {new Date(whitelist.lastUpdated).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
        </div>
      </div>
    </section>
  );
}
