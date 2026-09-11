import { memo } from 'react';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Première section de la home : manifeste épuré.
 * Porte le <h1> du site (entité + proposition de valeur explicite),
 * une inscription en CTA principal. Aucune animation, aucun bruit visuel.
 */
function ManifestoSectionComponent() {
  const { language } = useLanguage();

  const copy =
    language === 'es'
      ? {
          h1: 'Crawlers, la plataforma que mejora continuamente su visibilidad — SEO, GEO, IA',
          p: 'Auditamos su sitio como lo hacen Google y los motores de IA, priorizamos lo que realmente importa, y automatizamos la corrección. Un solo recorrido, resultados medidos.',
          cta: 'Crear una cuenta gratis',
          alt: 'Ver la plataforma',
          note: 'Sin tarjeta bancaria',
        }
      : language === 'en'
        ? {
            h1: 'Crawlers, the platform that continuously improves your visibility — SEO, GEO, AI',
            p: 'We audit your site the way Google and AI engines read it, rank what actually matters, and automate the fix. One pass, measured results.',
            cta: 'Create a free account',
            alt: 'See the platform',
            note: 'No credit card required',
          }
        : {
            h1: 'Crawlers, la plateforme qui améliore en continu votre visibilité — SEO, GEO, IA',
            p: "Nous auditons votre site comme le lisent Google et les moteurs d'IA, nous hiérarchisons ce qui compte vraiment, puis nous automatisons la correction. Un seul passage, des résultats mesurés.",
            cta: 'Créer un compte gratuit',
            alt: 'Découvrir la plateforme',
            note: 'Sans carte bancaire',
          };

  return (
    <section className="relative px-4 sm:px-6 pt-10 pb-8 sm:pt-16 sm:pb-12">
      <div className="mx-auto w-full max-w-3xl text-center">
        <h1 className="font-display font-extrabold text-foreground text-balance">
          {copy.h1}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-muted-foreground">
          {copy.p}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button variant="hero" size="lg">{copy.cta}</Button>
          </Link>
          <Link
            to="/audit-geo-seo"
            className="text-sm font-medium underline underline-offset-4 text-foreground"
          >
            {copy.alt} →
          </Link>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">{copy.note}</p>
      </div>
    </section>
  );
}

export const ManifestoSection = memo(ManifestoSectionComponent);
