import { useState, useEffect, useRef, memo, lazy, Suspense, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, Bot, Brain, Gauge, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolTab } from './ToolTabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUrlValidation, normalizeUrl } from '@/hooks/useUrlValidation';
import { UrlValidationBanner } from '@/components/UrlValidationBanner';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Lazy load framer-motion - only needed after hydration for animations
const MotionSpan = lazy(() => 
  import('framer-motion').then(mod => ({
    default: memo(({ children, ...props }: any) => <mod.motion.span {...props}>{children}</mod.motion.span>)
  }))
);

interface HeroSectionProps {
  onSubmit: (url: string) => void;
  activeTab: ToolTab;
  isLoading: boolean;
  onTabChange: (tab: ToolTab) => void;
  currentUrl?: string;
}

const animatedWords = ['ChatGPT', 'Gemini', 'Mistral', 'Google', 'Safari'];

function HeroSectionComponent({ onSubmit, isLoading, activeTab, onTabChange, currentUrl }: HeroSectionProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState(() => searchParams.get('url') || '');
  const { t, language } = useLanguage();
  const validation = useUrlValidation(language);
  const [wordIndex, setWordIndex] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [hideLeadmagnet, setHideLeadmagnet] = useState(false);
  const prevTabRef = useRef(activeTab);

  // Trigger glow on tab change
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setGlowActive(true);
      const timer = setTimeout(() => setGlowActive(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Mark as hydrated after first render for animations
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Fetch hide_home_leadmagnet config
  useEffect(() => {
    supabase
      .from('system_config')
      .select('value')
      .eq('key', 'hide_home_leadmagnet')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value === true) setHideLeadmagnet(true);
      });
  }, []);

  // Rotate words every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % animatedWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    validation.resetValidation();
  };

  const handleUrlBlur = () => {
    if (url.trim()) {
      const normalized = normalizeUrl(url);
      setUrl(normalized);
      localStorage.setItem('crawlers_last_url', normalized);
    }
  };

  const handleAcceptSuggestion = () => {
    if (!validation.suggestedUrl) return;
    const accepted = validation.suggestedUrl;
    setUrl(accepted);
    localStorage.setItem('crawlers_last_url', accepted);
    validation.acceptSuggestion(accepted, onSubmit);
  };

  const handleIgnoreSuggestion = () => {
    validation.dismissSuggestion();
    validation.showNotFound();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const normalized = normalizeUrl(url);
    setUrl(normalized);
    localStorage.setItem('crawlers_last_url', normalized);

    await validation.validateAndCorrect(url, (validUrl) => {
      setUrl(validUrl);
      localStorage.setItem('crawlers_last_url', validUrl);
      onSubmit(validUrl);
    });
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

  // Optimized content getter - avoid icon imports in critical path
  const getHeroContent = () => {
    switch (activeTab) {
      case 'crawlers':
        return {
          badge: t.hero.badge.crawlers,
          useAnimatedHeadline: true,
          subheadline: t.hero.subheadline.crawlers,
          buttonText: t.hero.button.crawlers,
          loadingText: t.hero.button.loading.crawlers
        };
      case 'llm':
        return {
          badge: t.hero.badge.llm,
          headline: <>{t.hero.headline.llm}{' '}<span className="text-gradient">{t.hero.headline.llmHighlight}</span> ?</>,
          useAnimatedHeadline: false,
          subheadline: t.hero.subheadline.llm,
          buttonText: t.hero.button.llm,
          loadingText: t.hero.button.loading.llm
        };
      case 'pagespeed':
        return {
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

  // Animated headline for crawlers tab - with SSR-safe fallback
  const renderAnimatedHeadline = () => (
    <h1 className="mb-4 text-2xl font-extrabold tracking-tight leading-tight sm:text-5xl lg:text-6xl font-display">
      <span className="block text-center pb-1">
        {/* Animated word container */}
        <span
          className="hero-word-container relative inline-flex items-center justify-center overflow-hidden align-bottom"
          style={{ minWidth: '140px', width: 'auto' }}
        >
          {isHydrated ? (
            <Suspense fallback={
              <span className="whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent">
                {animatedWords[wordIndex]}
              </span>
            }>
              <MotionSpan
                key={wordIndex}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="relative whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent"
              >
                {animatedWords[wordIndex]}
              </MotionSpan>
            </Suspense>
          ) : (
            <span className="whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent">
              {animatedWords[0]}
            </span>
          )}
        </span>
        {' '}
        <span className="font-display bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent lowercase leading-tight">
          {getIgnoreText()} {getSiteText()}
        </span>
        {' '}
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
          <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            {content.headline}
          </h1>
        )}

        {/* H2 Tagline - SEO/GEO optimized */}
        <h2 className="mb-4 text-lg font-medium font-display text-primary sm:mb-6 sm:text-2xl">
          {language === 'es'
            ? <>Audite su sitio. Afine la estrategia. Implemente el <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-[0.85em]">código</code>.</>
            : language === 'en'
              ? <>Audit your site. Refine the strategy. Implement the <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-[0.85em]">code</code>.</>
              : <>Auditez votre site. Affinez la stratégie. Implémentez le <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-[0.85em]">code</code>.</>}
        </h2>

        {/* Promise line */}
        <p className="mx-auto mb-6 max-w-2xl text-base sm:text-lg text-muted-foreground font-medium">
          {language === 'es'
            ? 'La única plataforma europea que cubre SEO clásico, SEO generativo y SEO local en una sola herramienta.'
            : language === 'en'
              ? 'The only European platform covering classic SEO, generative SEO and local SEO in a single tool.'
              : "La seule plateforme européenne qui couvre le SEO classique, le SEO génératif et le SEO local dans un seul outil."}
        </p>

        {/* H3 Subheadline - SEO optimized */}
        <h3 
          className="mx-auto mb-10 max-w-2xl text-base font-normal text-muted-foreground sm:text-xl"
          dangerouslySetInnerHTML={{ __html: content.subheadline }}
        />

        {/* Search Form with inline tab bar */}
        <div className="mx-auto w-full text-left" style={{ maxWidth: 'min(85%, 48rem)' }}>
        <form onSubmit={hideLeadmagnet ? (e) => {
          e.preventDefault();
          if (!url.trim()) return;
          const normalized = normalizeUrl(url);
          navigate(`/audit-expert?url=${encodeURIComponent(normalized)}`);
        } : handleSubmit}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              {/* Tab bar — hidden when leadmagnet mode */}
              {!hideLeadmagnet && (
              <div className="mb-2 flex overflow-x-auto scrollbar-hide rounded-lg border border-border bg-card p-1 -mx-1 sm:mx-0">
                {([
                  { key: 'crawlers' as ToolTab, icon: Bot, label: t.tabs.crawlers },
                  { key: 'llm' as ToolTab, icon: Brain, label: t.tabs.llm },
                  { key: 'pagespeed' as ToolTab, icon: Gauge, label: t.tabs.pagespeed },
                ]).map(({ key, icon: Icon, label }, index) => (
                  <div key={key} className="flex shrink-0 flex-1 items-center min-w-0">
                    {index > 0 && <div className="h-5 w-px bg-border shrink-0" />}
                    <button
                      type="button"
                      data-tour={`tab-${key}`}
                      onClick={() => onTabChange(key)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1 sm:gap-1.5 rounded-md py-2 px-1.5 sm:px-3 text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                        activeTab === key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      aria-current={activeTab === key ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="hidden xs:inline sm:inline">{label}</span>
                    </button>
                  </div>
                ))}
              </div>
              )}
              <div className="relative">
                <Input
                  type="text"
                  placeholder="url : crawlers.fr"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onBlur={handleUrlBlur}
                  className="h-14 pl-4 pr-12 text-base placeholder:text-xs placeholder:font-light placeholder:text-muted-foreground/50"
                  required
                  aria-label="URL du site web"
                />
                <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            {hideLeadmagnet ? (
              <div className="relative shrink-0 self-end">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-14 min-w-[200px] bg-transparent border-2 border-amber-500 text-amber-500 hover:bg-amber-500/10 font-bold text-base shadow-lg shadow-amber-500/25"
                  style={{ paddingLeft: 24, paddingRight: 24 }}
                >
                  <FileSearch className="h-5 w-5 mr-2" />
                  {language === 'fr' ? 'Démarrer Audit Expert' : language === 'es' ? 'Iniciar Auditoría Experta' : 'Start Expert Audit'}
                </Button>
                <span className="absolute left-0 right-0 text-[11px] text-muted-foreground mt-1.5 text-center">
                  {language === 'fr' ? '9 minutes max' : language === 'es' ? '9 minutos máx' : '9 minutes max'}
                </span>
              </div>
            ) : (
              <Button 
                type="submit" 
                variant="hero" 
                size="lg" 
                disabled={isLoading || validation.isValidating}
                className={cn(
                  "h-14 min-w-[122px] transition-shadow duration-500",
                  glowActive && "animate-cta-glow"
                )}
                style={{ paddingLeft: 20, paddingRight: 20 }}
              >
                {validation.isValidating ? (
                  <>
                    <Zap className="h-5 w-5 animate-pulse" />
                    {language === 'fr' ? 'Vérification…' : language === 'es' ? 'Verificando…' : 'Checking…'}
                  </>
                ) : isLoading ? (
                  <>
                    <Zap className="h-5 w-5 animate-pulse" />
                    {content.loadingText}
                  </>
                ) : (
                  content.buttonText
                )}
              </Button>
            )}
        </div>
        </form>
        </div>

        <UrlValidationBanner
          suggestedUrl={validation.suggestedUrl}
          urlNotFound={validation.urlNotFound}
          suggestionPrefix={validation.getSuggestionPrefix()}
          notFoundMessage={validation.getNotFoundMessage()}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={validation.dismissSuggestion}
          onDismissNotFound={validation.dismissNotFound}
          onIgnoreSuggestion={handleIgnoreSuggestion}
        />


        {/* "Plus de 168 critères" */}
        <p className="mt-6 text-sm sm:text-base md:text-lg font-semibold text-foreground max-w-2xl mx-auto text-center">
          {language === 'es' ? 'Audit Expert: 168 criterios SEO/GEO verificados, cruzados y contextualizados.' : language === 'en' ? 'Expert Audit: 168 SEO/GEO criteria verified, cross-referenced and contextualized.' : 'Audit Expert : 168 critères SEO/GEO vérifiés, croisés et contextualisés.'}
        </p>

        {/* Expert Audit + Compared Audit Buttons — hidden in leadmagnet mode */}
        {!hideLeadmagnet && (
        <div className="mt-4 flex justify-center gap-3" data-tour="audit-expert">
          <Link to={currentUrl ? `/audit-expert?url=${encodeURIComponent(currentUrl)}` : '/audit-expert'}>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border-amber-400 border-2 px-6 py-3 text-base shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            >
              <FileSearch className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground">
                {language === 'fr' ? 'Audit Expert' : language === 'es' ? 'Auditoría Experta' : 'Expert Audit'}
              </span>
            </Button>
          </Link>
        </div>
        )}
      </div>
    </section>
  );
}

// Memoize to prevent unnecessary re-renders during tab switches
export const HeroSection = memo(HeroSectionComponent);
