import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NewsCard } from './NewsCard';
import { NewsCardSkeleton } from './NewsCardSkeleton';
import { NewsArticle, WhitelistState } from '@/types/news';
import {
  fetchArticles,
  getWhitelistFromStorage,
  saveWhitelistToStorage,
  discoverNewSource,
} from '@/data/mockNewsData';
import { useLanguage } from '@/contexts/LanguageContext';

const AUTO_SCROLL_INTERVAL = 30000; // 30 seconds
const CARD_WIDTH = 356; // 340px card + 16px gap

export function NewsCarousel() {
  const { t } = useLanguage();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [whitelist, setWhitelist] = useState<WhitelistState>(getWhitelistFromStorage);
  const [newSourceDiscovered, setNewSourceDiscovered] = useState<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchArticles(whitelist);
      setArticles(data);
      setFilteredArticles(data);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [whitelist]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Filter articles based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredArticles(articles);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = articles.filter(
      article =>
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query) ||
        article.source.name.toLowerCase().includes(query)
    );
    setFilteredArticles(filtered);
  }, [searchQuery, articles]);

  // Auto-scroll functionality
  useEffect(() => {
    const startAutoScroll = () => {
      autoScrollRef.current = setInterval(() => {
        if (scrollContainerRef.current && filteredArticles.length > 0) {
          const container = scrollContainerRef.current;
          const maxScroll = container.scrollWidth - container.clientWidth;
          
          if (container.scrollLeft >= maxScroll - 10) {
            // Reset to beginning with smooth animation
            container.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            // Scroll to next card
            container.scrollBy({ left: CARD_WIDTH, behavior: 'smooth' });
          }
        }
      }, AUTO_SCROLL_INTERVAL);
    };

    startAutoScroll();

    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
    };
  }, [filteredArticles.length]);

  const handleRefresh = async () => {
    // Check for new source discovery
    const newSource = discoverNewSource();
    if (newSource) {
      const existingSource = whitelist.sources.find(s => s.name === newSource.name);
      if (!existingSource) {
        const updatedWhitelist: WhitelistState = {
          sources: [...whitelist.sources, newSource],
          lastUpdated: new Date().toISOString(),
        };
        setWhitelist(updatedWhitelist);
        saveWhitelistToStorage(updatedWhitelist);
        setNewSourceDiscovered(newSource.name);
        
        // Hide notification after 5 seconds
        setTimeout(() => setNewSourceDiscovered(null), 5000);
      }
    }

    // Increase trust score for relevant sources
    const updatedSources = whitelist.sources.map(source => ({
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

    await loadArticles();
  };

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -CARD_WIDTH, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: CARD_WIDTH, behavior: 'smooth' });
  };

  return (
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">
              {t.news?.title || 'Veille SEO / LLM / GEO'}
            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t.news?.searchPlaceholder || 'Rechercher...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
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

        {/* New source notification */}
        <AnimatePresence>
          {newSourceDiscovered && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {t.news?.newSource || 'Nouvelle source découverte :'} {newSourceDiscovered}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Carousel */}
        <div className="relative group">
          {/* Navigation buttons - Desktop only */}
          <Button
            variant="secondary"
            size="icon"
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity shadow-lg -translate-x-4"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity shadow-lg translate-x-4"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Scrollable container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 5 }).map((_, index) => (
                <NewsCardSkeleton key={index} />
              ))
            ) : filteredArticles.length > 0 ? (
              // Article cards
              filteredArticles.map((article, index) => (
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
            `${whitelist.sources.length} sources surveillées`} • {t.news?.lastUpdate || 'Dernière mise à jour'}: {new Date(whitelist.lastUpdated).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </section>
  );
}
