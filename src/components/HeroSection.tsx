import { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSearch, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link, useNavigate } from '@/lib/router-compat';
import { TrustBadge } from '@/components/TrustBadge';

// L'animation du mot du titre est en CSS pur : framer-motion coûtait 39 KiB
// transférés sur le chemin critique du LCP pour un simple fondu montant.
const HERO_WORD_CLASS =
  'whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-[#0545a8] via-[#6a00ff] via-50% via-[#8a2bff] via-65% to-[#f5a800] bg-clip-text text-transparent text-center sm:text-right';


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
    <section className="relative flex min-h-[40vh] sm:min-h-[48vh] items-center justify-center overflow-hidden px-4 sm:px-6 pt-2">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-60 -top-60 h-[28rem] w-[28rem] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -bottom-60 -right-60 h-[28rem] w-[28rem] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl text-center">
        {/* Sur-titre SEO + GEO */}
        <p className="mb-3 t-meta font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
          {language === 'fr'
            ? 'Outil de crawl SEO Google + GEO pour les IA · un seul audit'
            : language === 'es'
            ? 'Herramienta de rastreo SEO Google + GEO para las IA · una sola auditoría'
            : 'SEO crawl tool for Google + GEO for AI · one single audit'}
        </p>
        {/* Animated headline */}
        <h1 className="mb-6 t-display font-extrabold font-display text-center sm:whitespace-nowrap">
          <span
            className="hero-word-container relative inline-flex items-center justify-center sm:justify-end overflow-hidden align-baseline"
            style={{ minWidth: '3.9em', paddingBottom: '0.15em', marginBottom: '-0.15em', marginRight: '0.08em' }}
          >
            {isHydrated ? (
              <span key={wordIndex} className={`relative w-full hero-word-enter ${HERO_WORD_CLASS}`}>
                {animatedWords[wordIndex]}
              </span>
            ) : (
              <span className={HERO_WORD_CLASS}>{animatedWords[0]}</span>
            )}
          </span>{' '}
          <span className="font-display bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent lowercase leading-tight">
            {getIgnoreText()} {getSiteText()}
          </span>
          {' '}
          <span className="text-foreground">?</span>
        </h1>

        {/* Tagline */}
        <h2 className="mb-10 t-h2 font-medium font-display text-foreground sm:mb-12 px-2 sm:px-0">
          {language === 'es'
            ? 'La herramienta de rastreo SEO y GEO. Audite su sitio. Afine la estrategia. Automatice la solución.'
            : language === 'en'
              ? 'The SEO & GEO crawl tool. Audit your site. Refine the strategy. Automate the solution.'
              : 'L\'outil de crawl SEO & GEO. Auditez votre site. Affinez la stratégie. Automatisez la solution.'}
        </h2>


        {/* URL input + CTA Audit Expert + note — tout sur une seule ligne */}
        <div className="mt-2 mx-auto w-full flex flex-nowrap items-center gap-2 sm:gap-3" style={{ maxWidth: 'min(96%, 46rem)' }}>
          <TrustBadge layout="column" className="hidden sm:flex sm:shrink-0 gap-0.5 py-0 [&_.text-sm]:text-[11px] [&_.text-sm]:whitespace-nowrap [&>div[role=img]]:justify-start [&_.text-sm]:text-left" />
          <div className="flex-1 basis-0 min-w-0 relative rounded-xl p-[2px] bg-gradient-to-b from-gray-300 via-gray-200 to-gray-400 dark:p-0 dark:bg-transparent">
            <Input
              type="text"
              placeholder="url : crawlers.fr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) {
                  const target = url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim();
                  navigate(`/audit-expert?url=${encodeURIComponent(target)}&autolaunch=1`);
                }
              }}
              className="h-12 sm:h-14 rounded-[10px] dark:rounded-xl pl-3 pr-10 text-base border-0 dark:border-2 dark:border-white placeholder:text-sm placeholder:font-light placeholder:text-muted-foreground/50 bg-gradient-to-b from-muted/60 to-muted/30 dark:from-white/[0.04] dark:to-white/[0.02] backdrop-blur-sm"
              aria-label="URL du site web"
            />
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Link to={url.trim() ? `/audit-expert?url=${encodeURIComponent(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim())}&autolaunch=1` : '/audit-expert'} className="shrink-0 basis-0 min-w-0 flex-[1.2]">
            <Button
              variant="outline"
              size="lg"
              className="h-12 sm:h-14 gap-1 rounded-xl border-amber-500 dark:border-amber-400 border-2 px-3 text-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-amber-400/10 bg-gradient-to-b from-muted/80 to-muted/40 dark:from-white/[0.06] dark:to-white/[0.03] backdrop-blur-sm w-full justify-center"
            >
              <div className="flex flex-col items-center leading-tight min-w-0">
                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm sm:text-base truncate">
                  {language === 'fr' ? 'Audit Expert' : language === 'es' ? 'Auditoría Experta' : 'Expert Audit'}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground truncate">
                  {language === 'fr' ? '20 crédits offerts' : language === 'es' ? '20 créditos gratis' : '20 free credits'}
                </span>
              </div>
            </Button>
          </Link>
        </div>

        {/* Secondary CTAs */}
        <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link to="/auth" className="text-sm font-medium underline underline-offset-4 transition-colors text-foreground dark:text-primary-foreground">
            {language === 'fr' ? 'Créer un compte gratuit →' : language === 'es' ? 'Crear una cuenta gratis →' : 'Create a free account →'}
          </Link>
          <span className="text-[13px] text-muted-foreground">
            {language === 'fr' ? 'Essai gratuit, sans carte bancaire' : language === 'es' ? 'Prueba gratis, sin tarjeta bancaria' : 'Free trial, no credit card'}
          </span>
        </div>
      </div>
    </section>
  );
}

export const HeroSection = memo(HeroSectionComponent);
