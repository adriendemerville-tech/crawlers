import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, Globe, Brain, Gauge, Radar, Shield, FileText,
  Search, Code, BarChart3, Target, Zap, Eye, Link2,
  ListChecks, TrendingUp, BookOpen, ArrowRight, CheckCircle2,
  Layers, Database, Lock, RefreshCw, Activity, Cpu,
  Server, GitBranch, Workflow
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { t3 } from '@/utils/i18n';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

// Animated counter component
function AnimatedStat({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-3xl sm:text-4xl font-bold text-primary"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {value}{suffix}
      </motion.div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
}

// Pipeline step component
function PipelineStep({ icon: Icon, title, description, step, isLast = false }: {
  icon: React.ElementType; title: string; description: string; step: number; isLast?: boolean;
}) {
  return (
    <motion.div
      className="relative flex gap-4"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: step * 0.1 }}
    >
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
          {step}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-2" />}
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export default function Methodologie() {
  const { language } = useLanguage();
  useCanonicalHreflang('/methodologie');

  const auditCategories = [
    {
      icon: Bot, color: 'text-blue-500',
      title: t3(language, 'Crawlability IA', 'AI Crawlability', 'Crawlability IA'),
      points: ['robots.txt & User-Agent', 'llms.txt & ai-plugin.json', 'X-Robots-Tag HTTP', 'GPTBot, ClaudeBot, Bingbot'],
      count: 6
    },
    {
      icon: Globe, color: 'text-emerald-500',
      title: t3(language, 'Score GEO', 'GEO Score', 'Score GEO'),
      points: ['JSON-LD & Open Graph', 'Hiérarchie H1-H6', 'Citabilité LLM', 'Fraîcheur des contenus'],
      count: 7
    },
    {
      icon: Brain, color: 'text-violet-500',
      title: t3(language, 'Visibilité LLM', 'LLM Visibility', 'Visibilidad LLM'),
      points: ['Citation multi-modèles', 'Sentiment IA', 'Part de voix', 'Hallucinations factuelles'],
      count: 6
    },
    {
      icon: Gauge, color: 'text-orange-500',
      title: t3(language, 'Core Web Vitals', 'Core Web Vitals', 'Core Web Vitals'),
      points: ['LCP, FCP, CLS, TTFB', 'Requêtes HTTP', 'DOM & ressources', 'Mobile responsive'],
      count: 8
    },
    {
      icon: Radar, color: 'text-rose-500',
      title: t3(language, 'Audit Expert SEO/GEO', 'Expert SEO/GEO', 'Auditoría Experta'),
      points: ['E-E-A-T complet', 'Paysage concurrentiel', 'Zero-Click risk', 'Intelligence de marché'],
      count: 8
    },
    {
      icon: Search, color: 'text-cyan-500',
      title: t3(language, 'Mots-clés & Requêtes', 'Keywords & Queries', 'Palabras clave'),
      points: ['Positionnement SERP', 'Requêtes LLM ciblées', 'Intentions de recherche', 'Contenu prioritaire'],
      count: 5
    },
    {
      icon: Code, color: 'text-amber-500',
      title: t3(language, 'Code Correctif', 'Corrective Code', 'Código correctivo'),
      points: ['JSON-LD injection', 'Balises méta & OG', 'Alt images', 'SDK + kill switch'],
      count: 6
    },
    {
      icon: Eye, color: 'text-pink-500',
      title: t3(language, 'Résilience Contenu', 'Content Resilience', 'Resiliencia'),
      points: ['Dark Social Readiness', 'Quotability Index', 'Summary Resilience', 'Red Teaming'],
      count: 8
    },
    {
      icon: TrendingUp, color: 'text-teal-500',
      title: t3(language, 'Suivi & KPI', 'Tracking & KPI', 'Seguimiento'),
      points: ['Google Search Console', 'Historique & tendances', 'Export PDF', 'Plan d\'action'],
      count: 6
    },
  ];

  const algorithms = [
    { name: 'TF-IDF Sémantique', description: 'Pertinence thématique et visualisation 3D du cocon', icon: Layers },
    { name: 'Score IAS', description: 'Indice d\'Alignement Stratégique — 23 variables croisées', icon: Target },
    { name: 'GEO Score', description: 'Visibilité dans les moteurs de réponse IA', icon: Globe },
    { name: 'Triangle Prédictif', description: 'Prédiction trafic corrélée GSC/GA4 — MAPE < 15%', icon: TrendingUp },
    { name: 'Part de Voix', description: '40% LLM + 35% SERP + 25% ETV', icon: BarChart3 },
    { name: 'Empreinte Lexicale', description: 'Signature sémantique unique par entité', icon: FileText },
    { name: 'PageRank Interne', description: 'Calcul du maillage et distribution de jus', icon: GitBranch },
  ];

  const pipelineSteps = [
    { icon: Search, title: 'Crawl & Collecte', description: 'Crawl du site (jusqu\'à 5 000 pages), extraction HTML, détection robots.txt, llms.txt, ai-plugin.json. Collecte simultanée des données SERP, GSC, GA4 et PageSpeed.' },
    { icon: Database, title: 'Normalisation & Cache', description: 'Les données brutes sont normalisées, déduplicquées et mises en cache (TTL intelligent). Architecture multi-fallback sur toutes les APIs critiques.' },
    { icon: Cpu, title: 'Analyse Algorithmique', description: '7 algorithmes propriétaires s\'exécutent en parallèle : TF-IDF, GEO Score, IAS, Part de Voix, Triangle Prédictif, Empreinte Lexicale, PageRank Interne.' },
    { icon: Brain, title: 'Enrichissement LLM', description: 'Interrogation parallèle de ChatGPT, Gemini, Perplexity et Claude pour mesurer la visibilité, détecter les hallucinations et évaluer la citabilité.' },
    { icon: Code, title: 'Génération de Correctifs', description: 'Code correctif personnalisé (JSON-LD, balises méta, maillage) prêt à déployer via WordPress, GTM ou SDK sécurisé avec kill switch distant.' },
    { icon: BarChart3, title: 'Scoring & Rapport', description: 'Score global sur 200 points, export PDF, plan d\'action priorisé par impact et suivi dans le temps via la console de monitoring.' },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Méthodologie d'audit SEO & GEO — Crawlers.fr",
    "description": "Plus de 150 points d'audit SEO, GEO et IA analysés par Crawlers.fr : 7 algorithmes propriétaires, architecture multi-fallback, 111 Edge Functions.",
    "url": "https://crawlers.fr/methodologie",
    "isPartOf": { "@type": "WebSite", "name": "Crawlers AI", "url": "https://crawlers.fr" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
        { "@type": "ListItem", "position": 2, "name": "Méthodologie", "item": "https://crawlers.fr/methodologie" }
      ]
    }
  };

  const totalPoints = auditCategories.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      <Helmet>
        <title>Méthodologie d'audit SEO & GEO — 7 algorithmes | Crawlers.fr</title>
        <meta name="description" content="Méthodologie Crawlers.fr — 7 algorithmes propriétaires, 150+ points d'audit, architecture multi-fallback, RGPD natif. Comment nous calculons vos scores SEO et GEO." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/methodologie" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/methodologie" />
        <meta property="og:title" content="Méthodologie d'audit SEO & GEO — 7 algorithmes | Crawlers.fr" />
        <meta property="og:description" content="7 algorithmes propriétaires, 150+ points d'audit, architecture multi-fallback. Comment Crawlers.fr calcule vos scores SEO et GEO." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Méthodologie d'audit SEO & GEO — 7 algorithmes | Crawlers.fr" />
        <meta name="twitter:description" content="7 algorithmes propriétaires, 150+ points d'audit, architecture multi-fallback." />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background pt-20">

        {/* ── Hero ── */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/2 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6"
            >
              <BookOpen className="h-4 w-4" />
              <span>{t3(language, 'Transparence & Rigueur', 'Transparency & Rigor', 'Transparencia y Rigor')}</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight"
            >
              {t3(language, 'Comment Crawlers.fr', 'How Crawlers.fr', 'Cómo Crawlers.fr')}{' '}
              <span className="text-primary">{t3(language, 'analyse votre site', 'analyzes your site', 'analiza su sitio')}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-10"
            >
              {t3(language,
                '7 algorithmes propriétaires, 9 catégories d\'analyse, architecture multi-fallback résiliente. Chaque score est calculé, jamais estimé.',
                '7 proprietary algorithms, 9 analysis categories, resilient multi-fallback architecture. Every score is computed, never estimated.',
                '7 algoritmos propietarios, 9 categorías de análisis, arquitectura multi-fallback resiliente. Cada puntuación es calculada, nunca estimada.'
              )}
            </motion.p>

            {/* Hero CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
            >
              <Button asChild size="xl" variant="hero">
                <Link to="/audit-expert">
                  {t3(language, 'Tester sur mon site — Gratuit', 'Test on My Site — Free', 'Probar en mi sitio — Gratis')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/data-flow-diagram">
                  {t3(language, 'Voir le Data Flow', 'View Data Flow', 'Ver el Data Flow')}
                </Link>
              </Button>
            </motion.div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
              <AnimatedStat value={totalPoints} suffix="+" label={t3(language, 'Points d\'audit', 'Audit points', 'Puntos de auditoría')} />
              <AnimatedStat value={7} label={t3(language, 'Algorithmes', 'Algorithms', 'Algoritmos')} />
              <AnimatedStat value={111} label="Edge Functions" />
              <AnimatedStat value={10} suffix="+" label={t3(language, 'Sources de données', 'Data sources', 'Fuentes de datos')} />
            </div>
          </div>
        </section>

        {/* ── Pipeline Visuel ── */}
        <section className="py-16 px-4 bg-muted/20">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {t3(language, 'Pipeline d\'analyse — De l\'URL au score', 'Analysis Pipeline — From URL to Score', 'Pipeline de análisis — De la URL al score')}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {t3(language,
                  'Chaque audit suit un pipeline en 6 étapes, conçu pour la fiabilité et la reproductibilité.',
                  'Each audit follows a 6-step pipeline, designed for reliability and reproducibility.',
                  'Cada auditoría sigue un pipeline de 6 pasos, diseñado para fiabilidad y reproducibilidad.'
                )}
              </p>
            </motion.div>
            {pipelineSteps.map((step, i) => (
              <PipelineStep
                key={step.title}
                icon={step.icon}
                title={step.title}
                description={step.description}
                step={i + 1}
                isLast={i === pipelineSteps.length - 1}
              />
            ))}
          </div>
        </section>

        {/* ── 9 Catégories ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {t3(language, '9 catégories, +60 points d\'audit', '9 Categories, 60+ Audit Points', '9 categorías, +60 puntos de auditoría')}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t3(language,
                  'Signaux techniques classiques croisés avec les indicateurs de l\'ère générative.',
                  'Classic technical signals cross-referenced with generative era indicators.',
                  'Señales técnicas clásicas cruzadas con indicadores de la era generativa.'
                )}
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {auditCategories.map((cat, i) => (
                <motion.div
                  key={cat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full border-border/50 hover:border-primary/30 transition-all hover:shadow-lg group">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                            <cat.icon className="h-4.5 w-4.5 text-primary" />
                          </div>
                          <span>{cat.title}</span>
                        </div>
                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {cat.count} pts
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {cat.points.map((point, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA intermédiaire ── */}
        <section className="py-12 px-4 bg-primary/5 border-y border-primary/10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
              {t3(language, 'Voyez ce que révèle votre site', 'See What Your Site Reveals', 'Vea lo que revela su sitio')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t3(language,
                'Lancez un audit gratuit en 30 secondes. Aucune carte bancaire requise.',
                'Launch a free audit in 30 seconds. No credit card required.',
                'Lance una auditoría gratuita en 30 segundos. Sin tarjeta de crédito.'
              )}
            </p>
            <Button asChild size="lg" variant="hero">
              <Link to="/audit-expert">
                {t3(language, 'Lancer mon audit gratuit', 'Launch My Free Audit', 'Lanzar mi auditoría gratuita')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── 7 Algorithmes propriétaires ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-4">
                <Cpu className="h-4 w-4" />
                <span>{t3(language, 'Propriétaire', 'Proprietary', 'Propietario')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {t3(language, '7 algorithmes propriétaires en production', '7 Proprietary Algorithms in Production', '7 algoritmos propietarios en producción')}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {t3(language,
                  'Chaque algorithme est calibré sur des données réelles et mis à jour en continu.',
                  'Each algorithm is calibrated on real data and continuously updated.',
                  'Cada algoritmo está calibrado con datos reales y se actualiza continuamente.'
                )}
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {algorithms.map((algo, i) => (
                <motion.div
                  key={algo.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className="h-full border-border/50 bg-gradient-to-br from-card to-muted/20 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <algo.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{algo.name}</h3>
                          <p className="text-sm text-muted-foreground">{algo.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Architecture technique ── */}
        <section className="py-16 px-4 bg-muted/20">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {t3(language, 'Architecture — Ce qui garantit la fiabilité', 'Architecture — What Guarantees Reliability', 'Arquitectura — Lo que garantiza la fiabilidad')}
              </h2>
            </motion.div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: RefreshCw, title: t3(language, 'Résilience', 'Resilience', 'Resiliencia'),
                  items: [
                    t3(language, 'Multi-fallback sur toutes les APIs critiques', 'Multi-fallback on all critical APIs', 'Multi-fallback en todas las APIs críticas'),
                    t3(language, 'Circuit Breaker anti-cascade', 'Anti-cascade Circuit Breaker', 'Circuit Breaker anti-cascada'),
                    t3(language, 'Queue asynchrone avec progression temps réel', 'Async queue with real-time progress', 'Cola asíncrona con progreso en tiempo real'),
                    t3(language, 'Cache intelligent TTL', 'Intelligent TTL cache', 'Caché inteligente TTL'),
                  ]
                },
                {
                  icon: Lock, title: t3(language, 'Sécurité & RGPD', 'Security & GDPR', 'Seguridad y RGPD'),
                  items: [
                    t3(language, 'Hébergement européen, RGPD natif', 'European hosting, native GDPR', 'Alojamiento europeo, RGPD nativo'),
                    t3(language, 'Row-Level Security par utilisateur', 'User Row-Level Security', 'Row-Level Security por usuario'),
                    t3(language, 'Protection financière côté serveur', 'Server-side financial protection', 'Protección financiera del lado del servidor'),
                    t3(language, 'Cloudflare Turnstile anti-bot', 'Cloudflare Turnstile anti-bot', 'Cloudflare Turnstile anti-bot'),
                  ]
                },
                {
                  icon: Activity, title: t3(language, 'Intégrations', 'Integrations', 'Integraciones'),
                  items: [
                    t3(language, 'Google Search Console & GA4', 'Google Search Console & GA4', 'Google Search Console y GA4'),
                    t3(language, 'Google My Business & PageSpeed', 'Google My Business & PageSpeed', 'Google My Business y PageSpeed'),
                    t3(language, '4 moteurs LLM en parallèle', '4 parallel LLM engines', '4 motores LLM en paralelo'),
                    t3(language, 'Stripe (abonnements + crédits)', 'Stripe (subscriptions + credits)', 'Stripe (suscripciones + créditos)'),
                  ]
                },
              ].map((block, i) => (
                <motion.div
                  key={block.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="h-full border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <block.icon className="h-5 w-5 text-primary" />
                        {block.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {block.items.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tarification résumée ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {t3(language, 'Tarification simple', 'Simple Pricing', 'Precios simples')}
              </h2>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { plan: 'Freemium', price: t3(language, 'Gratuit', 'Free', 'Gratis'), features: ['Score GEO & Bots IA', 'Visibilité LLM', 'PageSpeed'], highlight: false },
                { plan: 'Pro Agency', price: '59€/mois', features: ['Audits illimités', 'Crawl 5 000 pages', 'Cocon sémantique 3D', 'Tracking & monitoring'], highlight: true },
                { plan: t3(language, 'Crédits', 'Credits', 'Créditos'), price: t3(language, 'À l\'unité', 'Pay-per-use', 'Por uso'), features: ['Audit comparé', 'Crawl ponctuel', 'Matrice d\'audit'], highlight: false },
              ].map((p, i) => (
                <motion.div
                  key={p.plan}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className={`h-full ${p.highlight ? 'border-primary/40 bg-primary/5 shadow-lg' : 'border-border/50'}`}>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-foreground mb-1">{p.plan}</h3>
                      <div className="text-2xl font-bold text-primary mb-4">{p.price}</div>
                      <ul className="space-y-2">
                        {p.features.map((f, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4 italic">
              {t3(language,
                '* Offre de lancement garantie à vie pour les 100 premiers abonnés.',
                '* Launch offer guaranteed for life for the first 100 subscribers.',
                '* Oferta de lanzamiento garantizada de por vida para los primeros 100 suscriptores.'
              )}
            </p>
          </div>
        </section>

        {/* ── CTA Final ── */}
        <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background border-t border-primary/10">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                {t3(language, 'Testez cette méthodologie sur votre site', 'Test This Methodology on Your Site', 'Pruebe esta metodología en su sitio')}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                {t3(language,
                  'Audit gratuit en 30 secondes. Aucune carte bancaire. Résultats immédiats.',
                  'Free audit in 30 seconds. No credit card. Immediate results.',
                  'Auditoría gratuita en 30 segundos. Sin tarjeta. Resultados inmediatos.'
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="xl" variant="hero">
                  <Link to="/audit-expert">
                    {t3(language, 'Lancer mon audit gratuit', 'Launch My Free Audit', 'Lanzar mi auditoría gratuita')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/tarifs">
                    {t3(language, 'Voir tous les tarifs', 'View All Pricing', 'Ver todos los precios')}
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section className="py-8 px-4 bg-muted/20 border-t border-border">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm text-muted-foreground italic">
              {t3(language,
                'Les algorithmes, pondérations et modes de calcul utilisés par Crawlers.fr sont propriétaires et ne sont pas divulgués. Cette page présente le périmètre d\'analyse, pas la méthodologie de scoring.',
                'The algorithms, weightings and calculation methods used by Crawlers.fr are proprietary and not disclosed. This page presents the analysis scope, not the scoring methodology.',
                'Los algoritmos, ponderaciones y métodos de cálculo utilizados por Crawlers.fr son propietarios y no se divulgan.'
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              {t3(language, 'Dernière mise à jour : Mars 2026', 'Last updated: March 2026', 'Última actualización: Marzo 2026')}
            </p>
          </div>
        </section>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
