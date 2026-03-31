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
    <section className="relative overflow-hidden px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Animated headline */}
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight leading-[1.1] sm:text-5xl lg:text-6xl font-display text-center">
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
        <h2 className="mb-4 text-lg font-medium font-display text-primary sm:mb-6 sm:text-2xl">
          {language === 'es'
            ? 'Audite su sitio. Afine la estrategia. Automatice la solución.'
            : language === 'en'
              ? 'Audit your site. Refine the strategy. Automate the solution.'
              : 'Auditez votre site. Affinez la stratégie. Automatisez la solution.'}
        </h2>

        {/* Description */}
        <p className="hidden sm:block mx-auto mb-8 max-w-2xl text-base sm:text-lg text-muted-foreground font-medium">
          {language === 'es'
            ? 'La única plataforma europea que cubre SEO clásico, GEO (Generative Engine Optimization) y SEO local en una sola herramienta.'
            : language === 'en'
              ? 'The only European platform covering classic SEO, GEO (Generative Engine Optimization) and local SEO in a single tool.'
              : "La seule plateforme européenne qui couvre le SEO classique, le GEO (Generative Engine Optimization) et le SEO local dans un seul outil."}
        </p>

        {/* URL input + CTA Audit Expert */}
        <div className="mt-6 mx-auto w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3" style={{ maxWidth: 'min(85%, 40rem)' }}>
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
              className="h-14 pl-4 pr-12 text-base placeholder:text-xs placeholder:font-light placeholder:text-muted-foreground/50"
              aria-label="URL du site web"
            />
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Link to={url.trim() ? `/audit-expert?url=${encodeURIComponent(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim())}` : '/audit-expert'}>
            <Button
              variant="outline"
              size="lg"
              className="h-14 gap-2 border-amber-400 border-2 px-8 text-base shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-amber-400/10 whitespace-nowrap"
            >
              
              <div className="flex flex-col items-start leading-tight">
                <span className="font-bold text-amber-400">
                  {language === 'fr' ? 'Audit Expert' : language === 'es' ? 'Auditoría Experta' : 'Expert Audit'}
                </span>
                <span className="text-xs font-normal text-muted-foreground">SEO-GEO. 5 min</span>
              </div>
            </Button>
          </Link>
        </div>

        {/* Audit Expert info */}
        <p className="mt-4 text-sm sm:text-base md:text-lg font-semibold text-foreground max-w-2xl mx-auto text-center">
          {language === 'es' ? '168 criterios SEO/GEO verificados, cruzados y contextualizados.' : language === 'en' ? '168 SEO/GEO criteria verified, cross-referenced and contextualized.' : '168 critères SEO/GEO vérifiés, croisés et contextualisés.'}
        </p>
      </div>
    </section>
  );
}

export const HeroSection = memo(HeroSectionComponent);
