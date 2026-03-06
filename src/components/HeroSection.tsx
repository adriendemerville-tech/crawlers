import { useState, useEffect, useRef, memo, lazy, Suspense, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolTab } from './ToolTabs';
import { useLanguage } from '@/contexts/LanguageContext';
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
}

const animatedWords = ['ChatGPT', 'Gemini', 'Mistral', 'Google', 'Safari'];

function HeroSectionComponent({ onSubmit, isLoading, activeTab }: HeroSectionProps) {
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [suggestedUrl, setSuggestedUrl] = useState<string | null>(null);
  const [urlNotFound, setUrlNotFound] = useState(false);
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
    // Replace spaces with hyphens (common in brand names like "croix rouge" → "croix-rouge")
    withoutProtocol = withoutProtocol.replace(/\s+/g, '-');
    withoutProtocol = withoutProtocol.replace(/\.{2,}/g, '.');
    withoutProtocol = withoutProtocol.replace(/\.(\/)/, '$1').replace(/\.$/, '');
    return `https://${withoutProtocol}`;
  };

  // Generate typo correction candidates for a domain
  const generateTypoCandidates = (domain: string): string[] => {
    const candidates: string[] = [];
    const domainPart = domain.split('/')[0];
    const pathPart = domain.includes('/') ? domain.slice(domain.indexOf('/')) : '';
    const tlds = ['com', 'fr', 'org', 'net', 'io', 'co', 'eu', 'de', 'es', 'it', 'uk', 'be', 'ch'];

    // 1. TLD typo fixes
    const domainTypoFixes: Record<string, string> = {
      '.con': '.com', '.cmo': '.com', '.ocm': '.com', '.co,': '.com',
      '.fre': '.fr', '.f': '.fr', '.frr': '.fr',
      '.rog': '.org', '.ogr': '.org',
      '.nte': '.net', '.met': '.net',
      '.oi': '.io', '.gio': '.io',
    };
    for (const [typo, fix] of Object.entries(domainTypoFixes)) {
      if (domainPart.endsWith(typo)) {
        candidates.push(domainPart.replace(typo, fix) + pathPart);
      }
    }

    // 2. Missing dot before TLD (e.g. "googlecom" → "google.com")
    for (const ext of tlds) {
      const regex = new RegExp(`([a-z0-9])${ext}$`, 'i');
      if (!domainPart.includes('.') && regex.test(domainPart)) {
        candidates.push(domainPart.replace(regex, `$1.${ext}`) + pathPart);
      }
    }

    // 3. No TLD at all (e.g. "cnews" → "cnews.fr", "cnews.com")
    if (!domainPart.includes('.')) {
      for (const ext of ['fr', 'com', 'org', 'net', 'io']) {
        candidates.push(domainPart + '.' + ext + pathPart);
      }
    }

    // 4. Alternative TLDs (e.g. "cnews.com" → "cnews.fr", "cnews.org")
    if (domainPart.includes('.')) {
      const parts = domainPart.split('.');
      const name = parts.slice(0, -1).join('.');
      const currentTld = parts[parts.length - 1];
      const altTlds = ['fr', 'com', 'org', 'net', 'io', 'eu', 'co'].filter(t => t !== currentTld);
      for (const alt of altTlds) {
        candidates.push(name + '.' + alt + pathPart);
      }
    }

    // 5. Character-level substitutions on the name part (before TLD)
    const charSubs: Record<string, string[]> = {
      z: ['s'], s: ['z'], c: ['k'], k: ['c'], ph: ['f'], f: ['ph'],
      x: ['s', 'ks'], q: ['k'], w: ['v'], v: ['w'], y: ['i'], i: ['y'],
      ee: ['e'], oo: ['o'], ll: ['l'], ss: ['s'], tt: ['t'], nn: ['n'],
    };
    const namePart = domainPart.includes('.') ? domainPart.split('.').slice(0, -1).join('.') : domainPart;
    const tldPart = domainPart.includes('.') ? '.' + domainPart.split('.').pop() : '';
    const tldsToTry = tldPart ? [tldPart, ...['.fr', '.com'].filter(t => t !== tldPart)] : ['.fr', '.com'];

    for (const [from, toList] of Object.entries(charSubs)) {
      if (namePart.includes(from)) {
        for (const to of toList) {
          const fixed = namePart.replace(from, to);
          for (const t of tldsToTry) {
            candidates.push(fixed + t + pathPart);
          }
        }
      }
    }

    // 6. Remove each character one at a time (for extra chars like "amazonn")
    if (namePart.length > 3) {
      for (let i = 0; i < namePart.length; i++) {
        const fixed = namePart.slice(0, i) + namePart.slice(i + 1);
        if (fixed.length >= 3) {
          for (const t of tldsToTry) {
            candidates.push(fixed + t + pathPart);
          }
        }
      }
    }

    // 7. Swap adjacent characters
    if (namePart.length > 2) {
      for (let i = 0; i < namePart.length - 1; i++) {
        const swapped = namePart.slice(0, i) + namePart[i + 1] + namePart[i] + namePart.slice(i + 2);
        for (const t of tldsToTry) {
          candidates.push(swapped + t + pathPart);
        }
      }
    }

    return [...new Set(candidates)];
  };

  // Server-side URL validation via edge function
  const validateUrls = async (urls: string[], searchBrand?: string): Promise<{ results: Array<{ url: string; valid: boolean }>; brandResult?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-url', {
        body: { urls, searchBrand },
      });
      if (error || !data?.results) return { results: urls.map(u => ({ url: u, valid: false })) };
      return { results: data.results, brandResult: data.brandResult || undefined };
    } catch {
      return { results: urls.map(u => ({ url: u, valid: false })) };
    }
  };

  // Find valid URL: returns { validUrl, originalValid }
  const findValidUrl = async (normalizedUrl: string): Promise<{ validUrl: string | null; originalValid: boolean }> => {
    const withoutProtocol = normalizedUrl.replace(/^https?:\/\//, '');
    
    const candidates = generateTypoCandidates(withoutProtocol);
    const allUrls = [normalizedUrl, ...candidates.slice(0, 9).map(c => `https://${c}`)];
    const uniqueUrls = [...new Set(allUrls)];
    
    // Pass the brand name for Google search fallback
    const brandName = withoutProtocol.split('.')[0].split('/')[0];
    const { results, brandResult } = await validateUrls(uniqueUrls, brandName);
    
    const originalResult = results.find(r => r.url === normalizedUrl);
    if (originalResult?.valid) return { validUrl: normalizedUrl, originalValid: true };
    
    const validCandidate = results.find(r => r.valid && r.url !== normalizedUrl);
    if (validCandidate) return { validUrl: validCandidate.url, originalValid: false };
    
    // Fallback: use brand search result from Google
    if (brandResult) return { validUrl: brandResult, originalValid: false };
    
    return { validUrl: null, originalValid: false };
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setSuggestedUrl(null);
    setUrlNotFound(false);
  };

  const handleUrlBlur = () => {
    if (url.trim()) {
      const normalized = normalizeUrl(url);
      setUrl(normalized);
      localStorage.setItem('crawlers_last_url', normalized);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestedUrl) return;
    setUrl(suggestedUrl);
    localStorage.setItem('crawlers_last_url', suggestedUrl);
    setSuggestedUrl(null);
    onSubmit(suggestedUrl);
  };

  const dismissSuggestion = () => {
    setSuggestedUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    localStorage.setItem('crawlers_last_url', normalizedUrl);
    setSuggestedUrl(null);

    setIsValidating(true);
    try {
      const { validUrl, originalValid } = await findValidUrl(normalizedUrl);
      
      if (originalValid) {
        // Original URL works, proceed
        setIsValidating(false);
        onSubmit(normalizedUrl);
        return;
      }
      
      if (validUrl) {
        // Found a correction — ask the user
        setIsValidating(false);
        setSuggestedUrl(validUrl);
        return;
      }
      
      // No valid URL found at all
      setIsValidating(false);
      setUrlNotFound(true);
      setTimeout(() => setUrlNotFound(false), 5000);
    } catch {
      setIsValidating(false);
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
        </form>

        {/* URL suggestion banner */}
        {suggestedUrl && (
          <div className="mx-auto mt-3 max-w-3xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm text-foreground">
                {language === 'fr' ? 'Voulez-vous dire' : language === 'es' ? '¿Quiso decir' : 'Did you mean'}{' '}
                <button
                  onClick={acceptSuggestion}
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  {suggestedUrl.replace(/^https?:\/\//, '')}
                </button>
                {language === 'es' ? '?' : ' ?'}
              </p>
              <button
                onClick={dismissSuggestion}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* URL not found notification */}
        {urlNotFound && (
          <div className="mx-auto mt-4 max-w-xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-4 shadow-lg">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
              <p className="text-sm font-medium text-foreground text-center">
                {language === 'fr' ? 'Cette URL ne pointe vers aucune page existante' 
                  : language === 'es' ? 'Esta URL no apunta a ninguna página existente' 
                  : 'This URL does not point to any existing page'}
              </p>
              <button
                onClick={() => setUrlNotFound(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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
