import { memo } from 'react';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { CheckCircle2, LayoutDashboard, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { InlineAuthForm } from '@/components/ExpertAudit/InlineAuthForm';

/**
 * Hero de la home en deux colonnes sur desktop.
 * Gauche : H1 + proposition de valeur.
 * Droite : formulaire d'inscription (ou CTA tableau de bord si connecté).
 * Design épuré, sans animation, pour un LCP rapide et une conversion directe.
 */
function HomeHeroComponent() {
  const { language } = useLanguage();
  const { user } = useAuth();

  const copy =
    language === 'es'
      ? {
          badge: 'Auditoría SEO & GEO',
          h1: 'Crawlers, la plataforma que mejora continuamente su visibilidad — SEO, GEO, IA',
          subtitle:
            'Audite su sitio como lo hacen Google y los motores de IA, priorice lo que realmente importa y automatice la corrección. Un solo recorrido, resultados medidos.',
          benefits: ['Sin tarjeta bancaria', '20 créditos de prueba', 'Audit en 2 minutos', 'Plan de acción incluido'],
          note: 'Prueba gratuita · sin compromiso · cancelación inmediata',
          formTitle: 'Crear una cuenta gratis',
          formSubtitle: 'Acceda a su audit en 2 minutos.',
          welcomeTitle: 'Bienvenido',
          welcomeSubtitle: 'Acceda a su consola para gestionar sus audits.',
          dashboard: 'Mi consola',
        }
      : language === 'en'
        ? {
            badge: 'SEO & GEO Audit',
            h1: 'Crawlers, the platform that continuously improves your visibility — SEO, GEO, AI',
            subtitle:
              'Audit your site the way Google and AI engines read it, rank what actually matters, and automate the fix. One pass, measured results.',
            benefits: ['No credit card', '20 trial credits', 'Audit in 2 minutes', 'Action plan included'],
            note: 'Free trial · no commitment · instant cancellation',
            formTitle: 'Create a free account',
            formSubtitle: 'Access your audit in 2 minutes.',
            welcomeTitle: 'Welcome back',
            welcomeSubtitle: 'Access your console to manage your audits.',
            dashboard: 'My console',
          }
        : {
            badge: 'Audit SEO & GEO',
            h1: 'Crawlers, la plateforme qui améliore en continu votre visibilité — SEO, GEO, IA',
            subtitle:
              "Nous auditons votre site comme le lisent Google et les moteurs d'IA, nous hiérarchisons ce qui compte vraiment, puis nous automatisons la correction. Un seul passage, des résultats mesurés.",
            benefits: ['Sans carte bancaire', '20 crédits d\'essai', 'Audit en 2 minutes', 'Plan d\'action inclus'],
            note: 'Essai gratuit · sans engagement · annulation immédiate',
            formTitle: 'Créer un compte gratuit',
            formSubtitle: 'Accédez à votre audit en 2 minutes.',
            welcomeTitle: 'Bienvenue',
            welcomeSubtitle: 'Accédez à votre console pour gérer vos audits.',
            dashboard: 'Ma console',
          };

  return (
    <section className="relative pt-8 pb-10 sm:pt-10 sm:pb-14 lg:pt-12 lg:pb-16 px-4 sm:px-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[24rem] w-[24rem] rounded-full bg-brand-violet/5 blur-[80px]" />
        <div className="absolute -bottom-40 -right-40 h-[24rem] w-[24rem] rounded-full bg-brand-gold/5 blur-[80px]" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: text content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider mb-4">
              {copy.badge}
            </div>

            <h1 className="t-display font-extrabold font-display text-foreground text-balance mb-4">
              {copy.h1}
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-xl mx-auto lg:mx-0">
              {copy.subtitle}
            </p>

            <ul
              className="flex flex-wrap gap-3 justify-center lg:justify-start text-sm text-muted-foreground mb-4"
              role="list"
              aria-label="Avantages"
            >
              {copy.benefits.map((item, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand-gold shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="text-xs text-muted-foreground">{copy.note}</p>
          </div>

          {/* Right: auth card */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            {user ? (
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-brand-gold/10 flex items-center justify-center mx-auto mb-3">
                  <LayoutDashboard className="h-6 w-6 text-brand-gold" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{copy.welcomeTitle}</h3>
                <p className="text-sm text-muted-foreground mb-5">{copy.welcomeSubtitle}</p>
                <Link to="/app/console">
                  <Button variant="outline" size="lg" className="w-full gap-2">
                    {copy.dashboard}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur p-5 sm:p-6">
                <h3 className="text-center text-lg font-bold text-foreground mb-1">{copy.formTitle}</h3>
                <p className="text-center text-xs text-muted-foreground mb-4">{copy.formSubtitle}</p>
                <InlineAuthForm defaultMode="signup" showPersonaGate={false} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const HomeHero = memo(HomeHeroComponent);
