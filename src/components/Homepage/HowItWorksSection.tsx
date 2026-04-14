import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, Zap, BarChart3, Code2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const translations = {
  fr: {
    badge: 'Comment ça marche',
    title: 'De l\'URL au correctif déployé en 4 étapes',
    subtitle: 'Crawlers.fr automatise l\'intégralité du cycle d\'audit SEO — du diagnostic au déploiement.',
    steps: [
      {
        icon: Search,
        title: 'Analysez votre site',
        desc: 'Entrez une URL. Nos crawlers analysent 200+ critères techniques : performance, SEO on-page, données structurées, accessibilité IA et signaux E-E-A-T.',
        detail: '30 secondes pour un diagnostic complet',
      },
      {
        icon: BarChart3,
        title: 'Recevez votre score',
        desc: 'Score SEO sur 200 points + Score GEO dédié. Chaque catégorie (Performance, Sécurité, Sémantique, IA) est détaillée avec une méthodologie transparente.',
        detail: '6 catégories, méthodologie ouverte',
      },
      {
        icon: Zap,
        title: 'Plan d\'action priorisé',
        desc: 'L\'IA génère un plan d\'action classé par impact : quick wins, optimisations moyennes et transformations structurelles. Chaque recommandation est actionnable.',
        detail: 'Priorisation automatique par ROI estimé',
      },
      {
        icon: Code2,
        title: 'Correctifs auto-déployables',
        desc: 'Pour chaque problème détecté, Crawlers génère le code correctif (balises, Schema.org, meta, redirections) déployable en un clic via votre CMS ou GTM.',
        detail: '7 CMS supportés + injection GTM',
      },
    ],
    cta: 'Essayer gratuitement',
  },
  en: {
    badge: 'How It Works',
    title: 'From URL to deployed fix in 4 steps',
    subtitle: 'Crawlers.fr automates the entire SEO audit cycle — from diagnosis to deployment.',
    steps: [
      {
        icon: Search,
        title: 'Analyze your site',
        desc: 'Enter a URL. Our crawlers analyze 200+ technical criteria: performance, on-page SEO, structured data, AI accessibility and E-E-A-T signals.',
        detail: '30 seconds for a full diagnostic',
      },
      {
        icon: BarChart3,
        title: 'Get your score',
        desc: 'SEO score out of 200 + dedicated GEO Score. Each category (Performance, Security, Semantics, AI) detailed with transparent methodology.',
        detail: '6 categories, open methodology',
      },
      {
        icon: Zap,
        title: 'Prioritized action plan',
        desc: 'AI generates an action plan ranked by impact: quick wins, medium optimizations and structural transformations. Every recommendation is actionable.',
        detail: 'Auto-prioritization by estimated ROI',
      },
      {
        icon: Code2,
        title: 'Auto-deployable fixes',
        desc: 'For each issue detected, Crawlers generates corrective code (tags, Schema.org, meta, redirects) deployable in one click via your CMS or GTM.',
        detail: '7 CMS supported + GTM injection',
      },
    ],
    cta: 'Try for free',
  },
  es: {
    badge: 'Cómo funciona',
    title: 'De la URL a la corrección desplegada en 4 pasos',
    subtitle: 'Crawlers.fr automatiza todo el ciclo de auditoría SEO — del diagnóstico al despliegue.',
    steps: [
      {
        icon: Search,
        title: 'Analice su sitio',
        desc: 'Ingrese una URL. Nuestros crawlers analizan 200+ criterios técnicos: rendimiento, SEO on-page, datos estructurados, accesibilidad IA y señales E-E-A-T.',
        detail: '30 segundos para un diagnóstico completo',
      },
      {
        icon: BarChart3,
        title: 'Reciba su score',
        desc: 'Score SEO sobre 200 puntos + Score GEO dedicado. Cada categoría detallada con metodología transparente.',
        detail: '6 categorías, metodología abierta',
      },
      {
        icon: Zap,
        title: 'Plan de acción priorizado',
        desc: 'La IA genera un plan de acción clasificado por impacto: quick wins, optimizaciones medias y transformaciones estructurales.',
        detail: 'Priorización automática por ROI estimado',
      },
      {
        icon: Code2,
        title: 'Correcciones auto-desplegables',
        desc: 'Para cada problema detectado, Crawlers genera el código correctivo desplegable en un clic vía su CMS o GTM.',
        detail: '7 CMS soportados + inyección GTM',
      },
    ],
    cta: 'Probar gratis',
  },
};

export const HowItWorksSection = memo(() => {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            {t.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {t.title}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{t.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.steps.map((step, i) => (
            <div key={i} className="relative rounded-2xl border border-border bg-card p-6 space-y-3 group hover:border-primary/30 transition-colors">
              {/* Step number */}
              <div className="absolute -top-3 -left-1 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md">
                {i + 1}
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              <p className="text-[11px] text-primary font-medium">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/audit-expert">
            <Button size="lg" className="gap-2">
              {t.cta} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
});

HowItWorksSection.displayName = 'HowItWorksSection';
