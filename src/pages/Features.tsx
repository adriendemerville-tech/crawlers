import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Sparkles, Bug, Network, Brain, ShieldCheck, Gauge, PenLine,
  Share2, BarChart3, Radar, Globe, Target, ArrowRight, Layers,
  Search, Building2, FileSearch, Zap, Award, Swords
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

interface FeatureCard {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  color: string;
  badge?: string;
}

const i18n = {
  fr: {
    title: 'Toutes les fonctionnalités',
    subtitle: 'Un écosystème complet pour piloter et automatiser\nvotre SEO, votre GEO et votre visibilité IA.',
    metaTitle: 'Fonctionnalités — Crawlers.fr | SEO & GEO tout-en-un',
    metaDesc: 'Découvrez toutes les fonctionnalités de Crawlers.fr : audit SEO 168 critères, maillage Cocoon, Content Architect, Score GEO, E-E-A-T, Autopilot et plus.',
    cta: 'Découvrir',
    categories: {
      analysis: 'Analyse & Audit',
      optimization: 'Optimisation & Contenu',
      monitoring: 'Monitoring & Intelligence',
    },
  },
  en: {
    title: 'All Features',
    subtitle: 'A comprehensive ecosystem to manage and automate\nyour SEO, GEO and AI visibility.',
    metaTitle: 'Features — Crawlers.fr | All-in-one SEO & GEO',
    metaDesc: 'Discover all Crawlers.fr features: 168-criteria SEO audit, Cocoon internal linking, Content Architect, GEO Score, E-E-A-T, Autopilot and more.',
    cta: 'Explore',
    categories: {
      analysis: 'Analysis & Audit',
      optimization: 'Optimization & Content',
      monitoring: 'Monitoring & Intelligence',
    },
  },
  es: {
    title: 'Todas las funcionalidades',
    subtitle: 'Un ecosistema completo para gestionar y automatizar\nsu SEO, GEO y visibilidad IA.',
    metaTitle: 'Funcionalidades — Crawlers.fr | SEO & GEO todo-en-uno',
    metaDesc: 'Descubra todas las funcionalidades de Crawlers.fr: auditoría SEO 168 criterios, enlazado Cocoon, Content Architect, Score GEO, E-E-A-T, Autopilot y más.',
    cta: 'Explorar',
    categories: {
      analysis: 'Análisis y Auditoría',
      optimization: 'Optimización y Contenido',
      monitoring: 'Monitoreo e Inteligencia',
    },
  },
};

function getFeatures(lang: 'fr' | 'en' | 'es'): { category: string; items: FeatureCard[] }[] {
  const t = i18n[lang];
  return [
    {
      category: t.categories.analysis,
      items: [
        {
          icon: FileSearch,
          title: lang === 'fr' ? 'Audit Expert (168 critères)' : lang === 'es' ? 'Auditoría Experta (168 criterios)' : 'Expert Audit (168 criteria)',
          description: lang === 'fr' ? 'Diagnostic SEO & GEO approfondi avec plan d\'action et code correctif prêt à déployer.' : lang === 'es' ? 'Diagnóstico SEO & GEO completo con plan de acción y código correctivo.' : 'In-depth SEO & GEO diagnosis with action plan and corrective code ready to deploy.',
          href: '/audit-expert',
          color: 'from-blue-500 to-indigo-600',
        },
        {
          icon: ShieldCheck,
          title: 'E-E-A-T',
          description: lang === 'fr' ? 'Mesurez Expérience, Expertise, Autorité et Fiabilité — les 4 piliers de confiance Google.' : lang === 'es' ? 'Mida Experiencia, Pericia, Autoridad y Fiabilidad — los 4 pilares de confianza de Google.' : 'Measure Experience, Expertise, Authority & Trust — Google\'s 4 trust pillars.',
          href: '/eeat',
          color: 'from-amber-500 to-orange-600',
        },
        {
          icon: Bug,
          title: lang === 'fr' ? 'Crawl de site' : lang === 'es' ? 'Rastreo de sitio' : 'Site Crawl',
          description: lang === 'fr' ? 'Crawl technique complet : erreurs, redirections, profondeur, orphelines, robots.txt.' : lang === 'es' ? 'Rastreo técnico completo: errores, redirecciones, profundidad, huérfanas.' : 'Full technical crawl: errors, redirects, depth, orphan pages, robots.txt.',
          href: '/app/site-crawl',
          color: 'from-purple-500 to-violet-600',
        },
        {
          icon: Gauge,
          title: 'PageSpeed',
          description: lang === 'fr' ? 'Scores de performance Core Web Vitals, mobile et desktop, avec recommandations.' : lang === 'es' ? 'Puntuaciones de rendimiento Core Web Vitals, móvil y escritorio.' : 'Core Web Vitals performance scores, mobile & desktop, with recommendations.',
          href: '/pagespeed',
          color: 'from-green-500 to-emerald-600',
        },
        {
          icon: Layers,
          title: lang === 'fr' ? 'Matrice d\'audit' : lang === 'es' ? 'Matriz de auditoría' : 'Audit Matrix',
          description: lang === 'fr' ? 'Importez votre propre grille de critères et scorez automatiquement vos pages.' : lang === 'es' ? 'Importe su propia grilla de criterios y puntúe automáticamente.' : 'Import your own criteria grid and automatically score your pages.',
          href: '/matrice',
          color: 'from-slate-500 to-gray-600',
        },
        {
          icon: Search,
          title: lang === 'fr' ? 'Audit sémantique' : lang === 'es' ? 'Auditoría semántica' : 'Semantic Audit',
          description: lang === 'fr' ? 'Analyse sémantique approfondie et empreinte lexicale de vos contenus.' : lang === 'es' ? 'Análisis semántico profundo y huella léxica de sus contenidos.' : 'Deep semantic analysis and lexical footprint of your content.',
          href: '/audit-semantique',
          color: 'from-cyan-500 to-teal-600',
        },
      ],
    },
    {
      category: t.categories.optimization,
      items: [
        {
          icon: Network,
          title: 'Cocoon',
          description: lang === 'fr' ? 'Maillage interne intelligent : graphe 3D, clusters sémantiques, liens auto-générés.' : lang === 'es' ? 'Enlazado interno inteligente: grafo 3D, clusters semánticos, enlaces auto-generados.' : 'Intelligent internal linking: 3D graph, semantic clusters, auto-generated links.',
          href: '/features/cocoon',
          color: 'from-amber-400 to-yellow-500',
        },
        {
          icon: PenLine,
          title: 'Content Architect',
          description: lang === 'fr' ? 'Rédaction IA guidée par votre stratégie : Voice DNA, conformité E-E-A-T, déploiement CMS.' : lang === 'es' ? 'Redacción IA guiada por su estrategia: Voice DNA, conformidad E-E-A-T, despliegue CMS.' : 'AI-guided writing aligned with your strategy: Voice DNA, E-E-A-T compliance, CMS deploy.',
          href: '/content-architect',
          color: 'from-green-600 to-emerald-700',
        },
        {
          icon: Zap,
          title: 'Autopilot',
          description: lang === 'fr' ? 'Pilotage autonome SEO : Breathing Spiral, cycles diagnostics/prescription/déploiement.' : lang === 'es' ? 'Pilotaje autónomo SEO: Breathing Spiral, ciclos diagnóstico/prescripción/despliegue.' : 'Autonomous SEO management: Breathing Spiral, diagnostic/prescription/deployment cycles.',
          href: '/breathing-spiral',
          color: 'from-violet-500 to-purple-700',
        },
        {
          icon: Target,
          title: 'Conversion Optimizer',
          description: lang === 'fr' ? 'Diagnostic visuel LLM + données GA4 pour optimiser vos taux de conversion.' : lang === 'es' ? 'Diagnóstico visual LLM + datos GA4 para optimizar sus tasas de conversión.' : 'Visual LLM diagnosis + GA4 data to optimize your conversion rates.',
          href: '/conversion-optimizer',
          color: 'from-emerald-500 to-green-600',
        },
        {
          icon: Share2,
          title: 'Social Hub',
          description: lang === 'fr' ? 'Création de contenu social, calendrier éditorial et publication multi-plateformes.' : lang === 'es' ? 'Creación de contenido social, calendario editorial y publicación multi-plataforma.' : 'Social content creation, editorial calendar and multi-platform publishing.',
          href: '/app/social',
          color: 'from-emerald-400 to-teal-500',
          badge: 'Beta',
        },
      ],
    },
    {
      category: t.categories.monitoring,
      items: [
        {
          icon: Globe,
          title: 'Score GEO',
          description: lang === 'fr' ? 'Mesurez votre visibilité dans les moteurs de recherche génératifs (ChatGPT, Gemini…).' : lang === 'es' ? 'Mida su visibilidad en los motores de búsqueda generativos.' : 'Measure your visibility in generative search engines (ChatGPT, Gemini…).',
          href: '/score-geo',
          color: 'from-blue-400 to-cyan-500',
        },
        {
          icon: Brain,
          title: lang === 'fr' ? 'Visibilité LLM' : lang === 'es' ? 'Visibilidad LLM' : 'LLM Visibility',
          description: lang === 'fr' ? 'Testez si votre marque est citée par les LLM et analysez le sentiment associé.' : lang === 'es' ? 'Compruebe si su marca es citada por los LLM y analice el sentimiento asociado.' : 'Test if your brand is cited by LLMs and analyze the associated sentiment.',
          href: '/visibilite-llm',
          color: 'from-pink-500 to-rose-600',
        },
        {
          icon: Radar,
          title: lang === 'fr' ? 'Analyse Bots IA' : lang === 'es' ? 'Análisis de Bots IA' : 'AI Bot Analysis',
          description: lang === 'fr' ? 'Identifiez quels bots IA crawlent votre site et optimisez leur accès.' : lang === 'es' ? 'Identifique qué bots IA rastrean su sitio y optimice su acceso.' : 'Identify which AI bots crawl your site and optimize their access.',
          href: '/analyse-bots-ia',
          color: 'from-indigo-500 to-blue-600',
        },
        {
          icon: BarChart3,
          title: lang === 'fr' ? 'Observatoire' : lang === 'es' ? 'Observatorio' : 'Observatory',
          description: lang === 'fr' ? 'Veille sectorielle automatique : tendances, concurrents, évolutions algorithmiques.' : lang === 'es' ? 'Vigilancia sectorial automática: tendencias, competidores, evoluciones algorítmicas.' : 'Automated sector intelligence: trends, competitors, algorithm changes.',
          href: '/observatoire',
          color: 'from-orange-500 to-red-500',
        },
        {
          icon: Award,
          title: lang === 'fr' ? 'Ranking SERP' : lang === 'es' ? 'Ranking SERP' : 'SERP Ranking',
          description: lang === 'fr' ? 'Suivez vos positions Google en temps réel : Top 3/10/50, ETV, pages indexées et distribution par tranche.' : lang === 'es' ? 'Siga sus posiciones en Google en tiempo real: Top 3/10/50, ETV, páginas indexadas y distribución.' : 'Track your Google rankings in real-time: Top 3/10/50, ETV, indexed pages and position distribution.',
          href: '/app/ranking-serp',
          color: 'from-yellow-500 to-amber-600',
        },
        {
          icon: Swords,
          title: lang === 'fr' ? 'Concurrence' : lang === 'es' ? 'Competencia' : 'Competition',
          description: lang === 'fr' ? 'Comparez vos scores SEO, GEO et SERP face à 3 concurrents et identifiez les opportunités.' : lang === 'es' ? 'Compare sus scores SEO, GEO y SERP frente a 3 competidores e identifique oportunidades.' : 'Compare your SEO, GEO & SERP scores against 3 competitors and spot opportunities.',
          href: '/app/console?tab=tracking',
          color: 'from-red-500 to-rose-600',
        },
        {
          icon: Building2,
          title: 'Pro Agency',
          description: lang === 'fr' ? 'Dashboard multi-clients, marque blanche, rapports personnalisés, gestion d\'équipe.' : lang === 'es' ? 'Dashboard multi-clientes, marca blanca, informes personalizados, gestión de equipo.' : 'Multi-client dashboard, white label, custom reports, team management.',
          href: '/pro-agency',
          color: 'from-violet-600 to-indigo-700',
        },
        {
          icon: Sparkles,
          title: 'Marina (B2B)',
          description: lang === 'fr' ? 'Audit de prospection B2B : scoring, analyse concurrentielle, rapports partageables.' : lang === 'es' ? 'Auditoría de prospección B2B: scoring, análisis competitivo, informes compartibles.' : 'B2B prospecting audit: scoring, competitive analysis, shareable reports.',
          href: '/marina',
          color: 'from-sky-500 to-blue-600',
        },
      ],
    },
  ];
}

export default function Features() {
  const { language } = useLanguage();
  const t = i18n[language];
  const featureGroups = getFeatures(language);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{t.metaTitle}</title>
        <meta name="description" content={t.metaDesc} />
        <link rel="canonical" href="https://crawlers.fr/features" />
      </Helmet>
      <Header />

      <main className="container mx-auto px-4 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-display">
            {t.title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto whitespace-pre-line">
            {t.subtitle}
          </p>
        </div>

        {/* Feature groups */}
        <div className="space-y-16">
          {featureGroups.map((group) => (
            <section key={group.category}>
              <h2 className="text-2xl font-bold mb-8 border-b border-border/50 pb-3 text-foreground">
                {group.category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.items.map((feature) => (
                  <Link
                    key={feature.title}
                    to={feature.href}
                    className="group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-6 hover:shadow-xl hover:border-border transition-all duration-300 hover:-translate-y-1 px-[20px] py-[10px]"
                  >
                    {feature.badge && (
                      <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                        {feature.badge}
                      </span>
                    )}
                    <div className={`inline-flex items-center justify-center w-11 h-11 bg-gradient-to-br ${feature.color} mb-4 rounded-md`}>
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Suspense fallback={<div className="h-48 bg-muted/10" />}>
        <Footer />
      </Suspense>
    </div>
  );
}
