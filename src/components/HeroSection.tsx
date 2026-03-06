import { useState, useEffect, useRef, memo, lazy, Suspense, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolTab } from './ToolTabs';
import { useLanguage } from '@/contexts/LanguageContext';

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
}

const animatedWords = ['ChatGPT', 'Gemini', 'Mistral', 'Google', 'Safari'];

function HeroSectionComponent({ onSubmit, isLoading, activeTab }: HeroSectionProps) {
  const [url, setUrl] = useState('');
  const [suggestedUrl, setSuggestedUrl] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { t, language } = useLanguage();
  const [wordIndex, setWordIndex] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
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

  // Rotate words every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % animatedWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Basic normalization: add protocol and clean up, NO typo auto-correction
  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized) return '';
    normalized = normalized.replace(/^["'<]+|["'>]+$/g, '');
    let withoutProtocol = normalized.toLowerCase().replace(/^https?:\/\//, '');
    withoutProtocol = withoutProtocol.replace(/\.{2,}/g, '.');
    withoutProtocol = withoutProtocol.replace(/\.(\/)/, '$1').replace(/\.$/, '');
    return `https://${withoutProtocol}`;
  };

  // Generate typo correction candidates for a domain
  const generateTypoCandidates = (domain: string): string[] => {
    const domainTypoFixes: Record<string, string> = {
      '.con': '.com', '.cmo': '.com', '.ocm': '.com', '.co,': '.com',
      '.fre': '.fr', '.f': '.fr', '.frr': '.fr',
      '.rog': '.org', '.ogr': '.org',
      '.nte': '.net', '.met': '.net',
      '.oi': '.io', '.gio': '.io',
    };
    const candidates: string[] = [];
    for (const [typo, fix] of Object.entries(domainTypoFixes)) {
      if (domain.endsWith(typo) || domain.includes(typo + '/')) {
        candidates.push(domain.replace(typo, fix));
      }
    }
    const extPatterns = ['com', 'fr', 'org', 'net', 'io', 'co', 'eu', 'de', 'es', 'it', 'uk', 'be', 'ch'];
    for (const ext of extPatterns) {
      const regex = new RegExp(`([a-z0-9])${ext}(\\/|$)`, 'i');
      if (!domain.includes(`.${ext}`) && regex.test(domain)) {
        candidates.push(domain.replace(regex, `$1.${ext}$2`));
        break;
      }
    }
    const domainPart = domain.split('/')[0];
    if (!domainPart.includes('.')) {
      candidates.push(domain.replace(domainPart, domainPart + '.com'));
      candidates.push(domain.replace(domainPart, domainPart + '.fr'));
    }
    return [...new Set(candidates)];
  };

  // Check if a domain actually resolves
  const checkDomainExists = async (domainUrl: string): Promise<boolean> => {
    try {
      await fetch(domainUrl, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(4000) });
      return true;
    } catch {
      return false;
    }
  };

  // Validate URL and suggest correction if domain doesn't exist
  const validateAndSuggest = async (normalizedUrl: string): Promise<{ exists: boolean; suggestion: string | null }> => {
    const withoutProtocol = normalizedUrl.replace(/^https?:\/\//, '');
    
    // First check if the original domain exists
    const originalExists = await checkDomainExists(normalizedUrl);
    if (originalExists) return { exists: true, suggestion: null };
    
    // Domain doesn't exist, try to find a correction
    const candidates = generateTypoCandidates(withoutProtocol);
    for (const candidate of candidates) {
      const candidateUrl = `https://${candidate}`;
      const exists = await checkDomainExists(candidateUrl);
      if (exists) return { exists: false, suggestion: candidateUrl };
    }
    
    return { exists: false, suggestion: null };
  };

  const getUnreachableMessage = () => {
    switch (language) {
      case 'fr': return 'Cette URL ne semble mener vers aucune page accessible. Vérifiez l\'adresse et réessayez.';
      case 'es': return 'Esta URL no parece llevar a ninguna página accesible. Verifique la dirección e intente de nuevo.';
      default: return 'This URL doesn\'t seem to lead to any accessible page. Please check the address and try again.';
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setSuggestedUrl(null);
  };

  const handleUrlBlur = () => {
    if (url.trim()) {
      const normalized = normalizeUrl(url);
      setUrl(normalized);
      localStorage.setItem('crawlers_last_url', normalized);
    }
  };

  const handleAcceptSuggestion = () => {
    if (suggestedUrl) {
      setUrl(suggestedUrl);
      localStorage.setItem('crawlers_last_url', suggestedUrl);
      setSuggestedUrl(null);
      onSubmit(suggestedUrl);
    }
  };

  const handleRejectSuggestion = async () => {
    setSuggestedUrl(null);
    // The original URL was already checked and doesn't exist — block submission
    toast.error(getUnreachableMessage());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    localStorage.setItem('crawlers_last_url', normalizedUrl);

    setIsValidating(true);
    try {
      const { exists, suggestion } = await validateAndSuggest(normalizedUrl);
      
      if (suggestion) {
        // Domain doesn't exist but we found a correction
        setSuggestedUrl(suggestion);
        setIsValidating(false);
        return;
      }
      
      if (!exists) {
        // Domain doesn't exist and no correction found — block scan
        toast.error(getUnreachableMessage());
        setIsValidating(false);
        return;
      }
    } catch {
      // Network error during validation — block scan to be safe
      toast.error(getUnreachableMessage());
      setIsValidating(false);
      return;
    }
    setIsValidating(false);
    onSubmit(normalizedUrl);
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
      case 'geo':
        return {
          badge: t.hero.badge.geo,
          headline: <>{t.hero.headline.geo}{' '}<span className="text-gradient">{t.hero.headline.geoHighlight}</span></>,
          useAnimatedHeadline: false,
          subheadline: t.hero.subheadline.geo,
          buttonText: t.hero.button.geo,
          loadingText: t.hero.button.loading.geo
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
    <h1 className="mb-4 text-2xl font-extrabold tracking-tight leading-tight sm:text-5xl lg:text-6xl">
      <span className="inline-flex items-center justify-center gap-2 sm:gap-3 flex-wrap pb-1">
        {/* Animated word container - centered vertically on mobile */}
        <span
          className="hero-word-container relative inline-flex items-center justify-center sm:justify-end overflow-hidden"
          style={{ minWidth: '280px', width: '280px' }}
        >
          {isHydrated ? (
            <Suspense fallback={
              <span className="whitespace-nowrap leading-tight bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent">
                {animatedWords[wordIndex]}
              </span>
            }>
              <MotionSpan
                key={wordIndex}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="relative whitespace-nowrap leading-tight bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent"
              >
                {animatedWords[wordIndex]}
              </MotionSpan>
            </Suspense>
          ) : (
            <span className="whitespace-nowrap leading-tight bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent">
              {animatedWords[0]}
            </span>
          )}
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
          <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {content.headline}
          </h1>
        )}

        {/* H2 Tagline - SEO/GEO optimized */}
        <h2 className="mb-6 text-lg font-medium text-primary sm:mb-8 sm:text-2xl">
          Crawlers.AI expertise le référencement SEO et GEO de votre entreprise.
        </h2>

        {/* H3 Subheadline - SEO optimized */}
        <p 
          className="mx-auto mb-10 max-w-2xl text-base font-normal text-muted-foreground sm:text-xl"
          dangerouslySetInnerHTML={{ __html: content.subheadline }}
        />

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder=""
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                className="h-14 pl-4 pr-12 text-base"
                required
                aria-label="URL du site web"
              />
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Button 
              type="submit" 
              variant="hero" 
              size="lg" 
              disabled={isLoading || isValidating}
              className={cn(
                "h-14 min-w-[122px] transition-shadow duration-500",
                glowActive && "animate-cta-glow"
              )}
            >
              {isValidating ? (
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
                <>
                  <Zap className="h-5 w-5" />
                  {content.buttonText}
                </>
              )}
            </Button>
          </div>

          {/* URL correction suggestion */}
          {suggestedUrl && (
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {language === 'fr' ? 'Vouliez-vous dire' : language === 'es' ? '¿Quiso decir' : 'Did you mean'}{' '}
                <strong className="text-foreground">{suggestedUrl.replace('https://', '')}</strong>{language === 'es' ? '?' : ' ?'}
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="default" onClick={handleAcceptSuggestion}>
                  {language === 'fr' ? 'Oui' : language === 'es' ? 'Sí' : 'Yes'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleRejectSuggestion}>
                  {language === 'fr' ? 'Non, continuer' : language === 'es' ? 'No, continuar' : 'No, continue'}
                </Button>
              </div>
            </div>
          )}
        </form>

        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span>Dopé à l'IA</span>
          </div>
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

// Memoize to prevent unnecessary re-renders during tab switches
export const HeroSection = memo(HeroSectionComponent);
