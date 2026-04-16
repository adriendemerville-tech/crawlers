import { useState, useEffect, memo, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSearch, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';

// Lazy load framer-motion - only needed after hydration for animations
const MotionSpan = lazy(() => 
  import('framer-motion').then(mod => ({
    default: memo(({ children, ...props }: any) => <mod.motion.span {...props}>{children}</mod.motion.span>)
  }))
);

const animatedWords = ['ChatGPT', 'Gemini', 'Mistral', 'Google', 'Safari'];

function HeroSectionComponent() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % animatedWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const getIgnoreText = () => {
    switch (language) {
      case 'fr': return 'ignore-t-il';
      case 'es': return 'ignora';
      default: return 'ignoring';
    }
  };

  const getSiteText = () => {
    switch (language) {
      case 'fr': return 'votre site';
      case 'es': return 'su sitio';
      default: return 'your site';
    }
  };

  return (
    <section className="relative flex min-h-[70vh] sm:min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-60 -top-60 h-[28rem] w-[28rem] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -bottom-60 -right-60 h-[28rem] w-[28rem] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl text-center">
        {/* Animated headline */}
        <h1 className="mb-6 text-xl font-extrabold tracking-tight leading-[1.15] sm:text-5xl lg:text-[4rem] xl:text-7xl font-display text-center sm:whitespace-nowrap">
          <span
            className="hero-word-container relative inline-flex items-center justify-center sm:justify-end overflow-hidden align-baseline"
            style={{ minWidth: '4.5em', paddingBottom: '0.15em', marginBottom: '-0.15em' }}
          >
            {isHydrated ? (
              <Suspense fallback={
                <span className="whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent text-center sm:text-right">
                  {animatedWords[wordIndex]}
                </span>
              }>
                <MotionSpan
                  key={wordIndex}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="relative whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent text-center sm:text-right w-full"
                >
                  {animatedWords[wordIndex]}
                </MotionSpan>
              </Suspense>
            ) : (
              <span className="whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent text-center sm:text-right">
                {animatedWords[0]}
              </span>
            )}
          </span>{' '}
          <span className="font-display bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent lowercase leading-tight">
            {getIgnoreText()} {getSiteText()}
          </span>
          {' '}
          <span className="text-foreground">?</span>
        </h1>

        {/* Tagline */}
        <h2 className="mb-10 text-base font-medium font-display text-foreground sm:mb-12 sm:text-3xl leading-relaxed px-2 sm:px-0">
          {language === 'es'
            ? 'Audite su sitio. Afine la estrategia. Automatice la solución.'
            : language === 'en'
              ? 'Audit your site. Refine the strategy. Automate the solution.'
              : 'Auditez votre site. Affinez la stratégie. Automatisez la solution.'}
        </h2>

        {/* URL input + CTA Audit Expert */}
        <div className="mt-2 mx-auto w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-4" style={{ maxWidth: 'min(90%, 44rem)' }}>
          <span className="hidden sm:inline-flex shrink-0 items-center text-sm font-semibold text-amber-400 uppercase tracking-wide">Étape 1</span>
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="url : crawlers.fr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) {
                  navigate(`/audit-expert?url=${encodeURIComponent(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim())}`);
                }
              }}
              className="h-12 sm:h-16 rounded-xl pl-4 pr-12 text-base sm:text-lg placeholder:text-sm placeholder:font-light placeholder:text-muted-foreground/50"
              aria-label="URL du site web"
            />
            <Search className="absolute right-5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Link to={url.trim() ? `/audit-expert?url=${encodeURIComponent(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim())}` : '/audit-expert'}>
            <Button
              variant="outline"
              size="lg"
              className="h-12 sm:h-16 gap-2 rounded-xl border-amber-400 border-2 px-6 sm:px-10 text-base shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-amber-400/10 whitespace-nowrap w-full sm:w-auto"
            >
              <div className="flex flex-col items-start leading-tight">
                <span className="font-bold text-amber-400 text-lg">
                  {language === 'fr' ? 'Audit Expert' : language === 'es' ? 'Auditoría Experta' : 'Expert Audit'}
                </span>
                <span className="text-xs font-normal text-muted-foreground">SEO-GEO. OFFERT</span>
              </div>
            </Button>
          </Link>
        </div>

        {/* Secondary CTAs */}
        <div className="mt-6 sm:mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link to="/auth" className="text-sm font-medium underline underline-offset-4 transition-colors text-foreground dark:text-primary-foreground">
            {language === 'fr' ? 'Créer un compte gratuit →' : language === 'es' ? 'Crear una cuenta gratis →' : 'Create a free account →'}
          </Link>
        </div>
      </div>
    </section>
  );
}

export const HeroSection = memo(HeroSectionComponent);
