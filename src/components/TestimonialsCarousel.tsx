import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const testimonials = [
  {
    quote: {
      fr: "J'ai découvert des erreurs techniques que mon ancien prestataire n'avait jamais vues. En 3 semaines, mon trafic organique a repris.",
      en: "I discovered technical issues my previous agency had never spotted. Within 3 weeks, my organic traffic recovered.",
      es: "Descubrí errores técnicos que mi antigua agencia nunca había detectado. En 3 semanas, mi tráfico orgánico se recuperó.",
    },
    firstName: 'Sophie',
    job: { fr: 'Gérante e-commerce', en: 'E-commerce Manager', es: 'Gerente e-commerce' },
    city: 'Lyon',
    stars: 5,
  },
  {
    quote: {
      fr: "Le cocon sémantique a transformé l'architecture de mon site. Mes pages se positionnent enfin sur les requêtes qui comptent.",
      en: "The semantic cocoon transformed my site architecture. My pages finally rank on the queries that matter.",
      es: "El capullo semántico transformó la arquitectura de mi sitio. Mis páginas finalmente se posicionan en las consultas que importan.",
    },
    firstName: 'Maxime',
    job: { fr: 'Consultant SEO freelance', en: 'Freelance SEO Consultant', es: 'Consultor SEO freelance' },
    city: 'Bordeaux',
    stars: 4,
  },
];

export function TestimonialsCarousel() {
  const { language } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const navigate = useCallback((dir: 1 | -1) => {
    setDirection(dir);
    setCurrent((prev) => (prev + dir + testimonials.length) % testimonials.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => navigate(1), 7000);
    return () => clearInterval(timer);
  }, [navigate]);

  const t = testimonials[current];
  const lang = (language || 'fr') as 'fr' | 'en' | 'es';

  return (
    <section className="py-16 md:py-20 bg-muted/20 border-y border-border/40">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="relative flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors active:scale-95"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 overflow-hidden min-h-[180px] flex items-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.blockquote
                key={current}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: direction * -40, filter: 'blur(4px)' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full text-center"
              >
                <div className="flex items-center justify-center gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < t.stars
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>

                <p className="text-base md:text-lg leading-relaxed text-foreground font-medium italic">
                  « {t.quote[lang] || t.quote.fr} »
                </p>

                <footer className="mt-5 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{t.firstName}</span>
                  <span className="mx-1.5">·</span>
                  <span>{t.job[lang] || t.job.fr}</span>
                  <span className="mx-1.5">·</span>
                  <span>{t.city}</span>
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </div>

          <button
            onClick={() => navigate(1)}
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors active:scale-95"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-5">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40'
              }`}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}