import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Shield, Zap, Gauge, Sparkles, Brain } from 'lucide-react';
import { ToolTab } from './ToolTabs';
import { useLanguage } from '@/contexts/LanguageContext';

interface HeroSectionProps {
  onSubmit: (url: string) => void;
  activeTab: ToolTab;
  isLoading: boolean;
}

const animatedWords = ['ChatGPT', 'Gemini', 'Mistral', 'Google', 'Safari'];

export function HeroSection({ onSubmit, isLoading, activeTab }: HeroSectionProps) {
  const [url, setUrl] = useState('');
  const { t, language } = useLanguage();
  const [wordIndex, setWordIndex] = useState(0);

  // Rotate words every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % animatedWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized) return '';
    
    const lowerInput = normalized.toLowerCase();
    
    if (!lowerInput.startsWith('http://') && !lowerInput.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    
    return normalized;
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
  };

  const handleUrlBlur = () => {
    if (url.trim()) {
      setUrl(normalizeUrl(url));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      const normalizedUrl = normalizeUrl(url);
      setUrl(normalizedUrl);
      onSubmit(normalizedUrl);
    }
  };

  const getIgnoreText = () => {
    switch (language) {
      case 'fr':
        return 'ignore-t-il';
      case 'es':
        return 'ignora';
      default:
        return 'ignoring';
    }
  };

  const getSiteText = () => {
    switch (language) {
      case 'fr':
        return 'votre site';
      case 'es':
        return 'su sitio';
      default:
        return 'your site';
    }
  };

  const getHeroContent = () => {
    switch (activeTab) {
      case 'crawlers':
        return {
          icon: <Shield className="h-4 w-4 text-primary" />,
          badge: t.hero.badge.crawlers,
          // Use animated headline for crawlers tab
          headline: null, // Will render custom animated headline
          useAnimatedHeadline: true,
          subheadline: t.hero.subheadline.crawlers,
          buttonText: t.hero.button.crawlers,
          loadingText: t.hero.button.loading.crawlers
        };
      case 'geo':
        return {
          icon: <Sparkles className="h-4 w-4 text-primary" />,
          badge: t.hero.badge.geo,
          headline: <>{t.hero.headline.geo}{' '}<span className="text-gradient">{t.hero.headline.geoHighlight}</span></>,
          useAnimatedHeadline: false,
          subheadline: t.hero.subheadline.geo,
          buttonText: t.hero.button.geo,
          loadingText: t.hero.button.loading.geo
        };
      case 'llm':
        return {
          icon: <Brain className="h-4 w-4 text-primary" />,
          badge: t.hero.badge.llm,
          headline: <>{t.hero.headline.llm}{' '}<span className="text-gradient">{t.hero.headline.llmHighlight}</span> ?</>,
          useAnimatedHeadline: false,
          subheadline: t.hero.subheadline.llm,
          buttonText: t.hero.button.llm,
          loadingText: t.hero.button.loading.llm
        };
      case 'pagespeed':
        return {
          icon: <Gauge className="h-4 w-4 text-primary" />,
          badge: t.hero.badge.pagespeed,
          headline: <>{t.hero.headline.pagespeed}{' '}<span className="text-gradient">{t.hero.headline.pagespeedHighlight}</span> ?</>,
          useAnimatedHeadline: false,
          subheadline: t.hero.subheadline.pagespeed,
          buttonText: t.hero.button.pagespeed,
          loadingText: t.hero.button.loading.pagespeed
        };
    }
  };

  const content = getHeroContent();

  // Animated headline for crawlers tab
  const renderAnimatedHeadline = () => (
    <h1 className="mb-10 text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl lg:text-6xl">
      <span className="inline-flex items-center justify-center gap-2 sm:gap-3 flex-wrap pb-1">
        {/* Animated word container - uses auto height to respect descenders */}
        <span
          className="relative inline-flex items-center justify-end overflow-visible"
          style={{ minWidth: '280px', width: '280px', height: 'auto', minHeight: '1.2em' }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={wordIndex}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="relative bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent whitespace-nowrap leading-tight"
            >
              {animatedWords[wordIndex]}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent lowercase leading-tight">
          {getIgnoreText()} {getSiteText()}
        </span>
        <span className="text-foreground">?</span>
      </span>
    </h1>
  );

  return (
    <section className="relative overflow-hidden px-4 py-6 sm:py-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">

        {/* H1 Headline - SEO optimized */}
        {content.useAnimatedHeadline ? (
          renderAnimatedHeadline()
        ) : (
          <h1 className="mb-10 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {content.headline}
          </h1>
        )}

        {/* H2 Subheadline - SEO optimized */}
        <h2 
          className="mx-auto mb-10 max-w-2xl text-lg font-normal text-muted-foreground sm:text-xl"
          dangerouslySetInnerHTML={{ __html: content.subheadline }}
        />

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="example.com"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                className="h-14 pl-12 pr-4 text-base"
                required
                aria-label="URL du site web"
              />
            </div>
            <Button 
              type="submit" 
              variant="hero" 
              size="lg" 
              disabled={isLoading}
              className="min-w-[140px]"
            >
              {isLoading ? (
                <>
                  <Zap className="h-5 w-5 animate-pulse" />
                  {content.loadingText}
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  {content.buttonText}
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {t.hero.trust.noSignup && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span>{t.hero.trust.noSignup}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span>{t.hero.trust.instant}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span>{t.hero.trust.free}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
