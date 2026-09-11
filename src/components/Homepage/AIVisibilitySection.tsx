import { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link, useNavigate } from '@/lib/router-compat';
import { TrustBadge } from '@/components/TrustBadge';
import { getAuditedDomainsCount } from '@/lib/auditedDomains.functions';

const HERO_WORD_CLASS =
  'whitespace-nowrap leading-tight font-display font-extrabold bg-gradient-to-tr from-foreground via-brand-violet via-50% via-brand-violet via-65% to-brand-gold bg-clip-text text-transparent text-center sm:text-right';

const animatedWords = ['ChatGPT', 'Gemini', 'Mistral', 'Google', 'Safari'];

/**
 * Section dédiée au test rapide de visibilité IA.
 * Séparée du hero pour garder une première section épurée (H1 + inscription),
 * tout en conservant l'outil de test URL qui convertit.
 */
function AIVisibilitySectionComponent() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [domainsCount, setDomainsCount] = useState<number | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    let cancelled = false;
    getAuditedDomainsCount()
      .then((res) => { if (!cancelled) setDomainsCount(res.count); })
      .catch(() => {});
    return () => { cancelled = true; };
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

  const getSubtitle = () => {
    switch (language) {
      case 'es':
        return 'La herramienta de rastreo SEO y GEO. Audite su sitio. Afine la estrategia. Automatice la solución.';
      case 'en':
        return 'The SEO & GEO crawl tool. Audit your site. Refine the strategy. Automate the solution.';
      default:
        return "L'outil de crawl SEO & GEO. Auditez votre site. Affinez la stratégie. Automatisez la solution.";
    }
  };

  return (
    <section className="relative flex min-h-0 sm:min-h-[40vh] items-center justify-center overflow-hidden px-4 sm:px-6 py-10 sm:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-60 -top-60 h-[28rem] w-[28rem] rounded-full bg-brand-violet/5 blur-[100px]" />
        <div className="absolute -bottom-60 -right-60 h-[28rem] w-[28rem] rounded-full bg-brand-violet/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl text-center">
        <p className="mb-3 t-meta font-semibold uppercase tracking-[0.2em] text-brand-gold">
          {language === 'fr'
            ? 'Outil de crawl SEO Google + GEO pour les IA · un seul audit'
            : language === 'es'
            ? 'Herramienta de rastreo SEO Google + GEO para las IA · una sola auditoría'
            : 'SEO crawl tool for Google + GEO for AI · one single audit'}
        </p>

        <h2 className="mb-4 t-display font-extrabold font-display text-center sm:whitespace-nowrap max-sm:text-2xl">
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
          <span className="font-display text-foreground lowercase leading-tight">
            {getIgnoreText()} {getSiteText()}
          </span>{' '}
          <span className="text-foreground">?</span>
        </h2>

        <p className="mb-8 t-h2 font-medium font-display text-foreground max-sm:hidden px-2 sm:px-0">
          {getSubtitle()}
        </p>

        <div className="hero-actions mt-2 mx-auto w-full" style={{ maxWidth: 'min(96%, 46rem)' }}>
          <p className="hero-domains hidden sm:block shrink-0 text-left text-[13px] leading-tight text-muted-foreground whitespace-nowrap" aria-live="polite">
            <span className="font-bold tabular-nums text-foreground">
              {`Déjà ${(1000 + Math.max(domainsCount ?? 0, 0)).toLocaleString('fr-FR')}${domainsCount === null ? '+' : ''}`}
            </span>{' '}
            sites audités
          </p>
          <TrustBadge layout="column" className="flex shrink-0 gap-0.5 py-0 justify-center max-sm:items-center [&_.text-sm]:text-[11px] [&_.text-sm]:whitespace-nowrap [&_.text-sm]:text-center sm:[&_.text-sm]:text-left" />
          <div className="hero-input-wrap min-w-0 relative">
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
              className="h-12 sm:h-14"
              aria-label="URL du site web"
            />
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <Link
            to={url.trim() ? `/audit-expert?url=${encodeURIComponent(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim())}&autolaunch=1` : '/audit-expert'}
            className="hero-cta w-full sm:w-auto shrink-0 min-w-0"
          >
            <Button
              variant="outline"
              size="lg"
              className="h-12 sm:h-14 gap-1 rounded-xl border-brand-gold dark:border-brand-gold border-2 px-3 text-sm w-full justify-center"
            >
              <div className="flex flex-col items-center leading-tight min-w-0">
                <span className="font-bold text-brand-gold text-sm sm:text-base truncate">
                  {language === 'fr' ? 'Audit Expert' : language === 'es' ? 'Auditoría Experta' : 'Expert Audit'}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground truncate">
                  {language === 'fr' ? '20 crédits offerts' : language === 'es' ? '20 créditos gratis' : '20 free credits'}
                </span>
              </div>
            </Button>
          </Link>
        </div>

        <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link to="/auth" className="text-sm font-medium underline underline-offset-4 transition-colors text-foreground">
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

export const AIVisibilitySection = memo(AIVisibilitySectionComponent);
