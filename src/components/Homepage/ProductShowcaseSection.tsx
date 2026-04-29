import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import {
  BarChart3, Network, Code2, PenTool, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';

import consoleDashboard from '@/assets/screenshots/crawlers.fr_console-seo-monitoring-dashboard.webp';
import cocoonGraph from '@/assets/screenshots/crawlers.fr_cocon-semantique-3d-maillage-interne.webp';
import architectCode from '@/assets/screenshots/crawlers.fr_architecte-code-correctif-seo.webp';
import contentArchitectPreview from '@/assets/screenshots/content-architect-preview.webp';

const ProductShowcaseSection = memo(() => {
  const { language } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const slides = [
    {
      image: consoleDashboard,
      title: language === 'fr' ? 'Console de pilotage' : 'Control Console',
      desc: language === 'fr'
        ? 'Scores SEO, GEO, Performance et Visibilité IA en temps réel.'
        : 'SEO, GEO, Performance and AI Visibility scores in real-time.',
      icon: BarChart3,
      badgeColor: 'bg-primary/10 text-primary',
      link: '/app/console',
    },
    {
      image: cocoonGraph,
      title: language === 'fr' ? 'Cocon sémantique 3D' : '3D Semantic Cocoon',
      desc: language === 'fr'
        ? 'Architecture de contenu, maillage interne et clusters thématiques.'
        : 'Content architecture, internal linking and thematic clusters.',
      icon: Network,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      link: '/app/cocoon',
    },
    {
      image: architectCode,
      title: 'Code Architect',
      desc: language === 'fr'
        ? 'Script correctif sur-mesure : Schema.org, PageSpeed, anti-hallucination IA.'
        : 'Custom corrective script: Schema.org, PageSpeed, AI anti-hallucination.',
      icon: Code2,
      badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      link: '/audit-expert',
    },
    {
      image: contentArchitectPreview,
      title: 'Content Architect',
      desc: language === 'fr'
        ? 'Pages SEO complètes en quelques secondes, publiées sur votre CMS.'
        : 'Complete SEO pages in seconds, published to your CMS.',
      icon: PenTool,
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      link: '/content-architect',
    },
  ];

  const navigate = useCallback((dir: 1 | -1) => {
    setIsTransitioning((transitioning) => {
      if (transitioning) return transitioning;
      setDirection(dir);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCurrent((prev) => (prev + dir + slides.length) % slides.length);
        setIsTransitioning(false);
      }, 300);
      return true;
    });
  }, [slides.length]);

  useEffect(() => {
    const timer = setInterval(() => navigate(1), 6000);
    return () => clearInterval(timer);
  }, [navigate]);

  // Safety net: clear any lingering timeout on unmount only
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <section className="relative py-14 sm:py-20 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.03),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-violet-500/30 bg-violet-500/5 text-violet-500 px-3 py-1 text-xs font-semibold">
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {language === 'fr' ? 'Découvrir la plateforme' : 'Discover the platform'}
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display">
            {language === 'fr' ? 'Tout ce dont vous avez besoin,' : 'Everything you need,'}
            <br />
            <span className="text-violet-500 font-extrabold">
              {language === 'fr' ? 'au même endroit.' : 'in one place.'}
            </span>
          </h2>
        </div>

        {/* Carousel — CSS transitions only, no framer-motion */}
        <div className="relative flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors active:scale-95 z-10"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 overflow-hidden rounded-2xl bg-card/50 border border-border/30 p-4 sm:p-6">
            <div
              className="transition-all duration-300 ease-out"
              style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning
                  ? `translateX(${direction * 40}px)`
                  : 'translateX(0)',
              }}
            >
              <Link to={slide.link} className="block group cursor-pointer">
                <div className="grid gap-8 lg:grid-cols-2 items-center">
                  {/* Screenshot */}
                  <div className="relative transition-transform duration-500 ease-out group-hover:scale-[1.02]" style={{ perspective: '1200px' }}>
                    <div className={`absolute -inset-4 rounded-3xl bg-gradient-to-br ${slide.badgeColor} opacity-[0.07] blur-2xl group-hover:opacity-[0.12] transition-opacity duration-500`} />
                    <div className="relative rounded-2xl overflow-hidden border-2 border-border shadow-2xl shadow-black/10 dark:shadow-black/30 group-hover:border-primary/30 transition-colors duration-300 bg-muted/30">
                      <div className="bg-muted/80 dark:bg-muted/40 border-b border-border/50 px-4 py-2.5 flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                        </div>
                        <div className="flex-1 mx-8">
                          <div className="bg-background/60 rounded-md px-3 py-1 text-[10px] text-muted-foreground font-mono text-center truncate">
                            crawlers.fr
                          </div>
                        </div>
                      </div>
                      <img
                        src={slide.image}
                        alt={slide.title}
                        width={960}
                        height={600}
                        className="w-full h-auto block min-h-[200px] object-cover"
                        loading="eager"
                        decoding="async"
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="space-y-4">
                    <Badge className={`${slide.badgeColor} border-current/20 text-xs font-semibold px-3 py-1`}>
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      {slide.title}
                    </Badge>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-display leading-tight">
                      {slide.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                      {slide.desc}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:underline">
                      {language === 'fr' ? 'Découvrir' : 'Discover'} →
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <button
            onClick={() => navigate(1)}
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors active:scale-95 z-10"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
});
ProductShowcaseSection.displayName = 'ProductShowcaseSection';

export { ProductShowcaseSection };
