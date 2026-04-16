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
  Server, GitBranch, Workflow, Crosshair, AlertTriangle,
  Network, Fingerprint, Award, Swords
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { t3 } from '@/utils/i18n';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/* ── Anthracite palette tokens ── */
const A = {
  heading: 'text-[#2d2d2d] dark:text-neutral-100',
  body: 'text-[#4a4a4a] dark:text-neutral-300',
  muted: 'text-[#6b6b6b] dark:text-neutral-400',
  accent: 'text-[#3d3d3d] dark:text-neutral-200',
  badge: 'border-[#d1d1d1] dark:border-neutral-600 bg-[#f5f5f5] dark:bg-neutral-800 text-[#4a4a4a] dark:text-neutral-300',
  cardBg: 'bg-[#fafafa] dark:bg-neutral-900 border-[#e5e5e5] dark:border-neutral-700',
  iconBg: 'bg-[#ededed] dark:bg-neutral-800',
  iconColor: 'text-[#3d3d3d] dark:text-neutral-300',
  sectionAlt: 'bg-[#f7f7f7] dark:bg-neutral-900/50',
  ctaBg: 'bg-[#2d2d2d] dark:bg-neutral-800 hover:bg-[#1a1a1a] dark:hover:bg-neutral-700 text-white',
  ctaOutline: 'border-[#c4c4c4] dark:border-neutral-600 text-[#3d3d3d] dark:text-neutral-200 hover:bg-[#f0f0f0] dark:hover:bg-neutral-800',
  separator: 'border-[#e5e5e5] dark:border-neutral-700',
  highlight: 'text-[#5b21b6] dark:text-violet-400', // subtle violet for rare emphasis
};

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
        className={`text-3xl sm:text-4xl font-bold ${A.heading}`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {value}{suffix}
      </motion.div>
      <div className={`text-sm mt-1 ${A.muted}`}>{label}</div>
    </motion.div>
  );
}

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
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${A.ctaBg} font-bold text-sm shrink-0`}>
          {step}
        </div>
        {!isLast && <div className={`w-px flex-1 ${A.separator} mt-2`} style={{ borderLeftWidth: 1, borderLeftStyle: 'solid' }} />}
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${A.iconColor}`} />
          <h3 className={`font-semibold ${A.heading}`}>{title}</h3>
        </div>
        <p className={`text-sm leading-relaxed ${A.body}`}>{description}</p>
      </div>
    </motion.div>
  );
}

/* ── Editorial section component ── */
function EditorialBlock({ icon: Icon, title, children, index = 0 }: {
  icon: React.ElementType; title: string; children: React.ReactNode; index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="mb-10 last:mb-0"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${A.iconBg} shrink-0 mt-0.5`}>
          <Icon className={`h-4.5 w-4.5 ${A.iconColor}`} />
        </div>
        <h3 className={`text-lg sm:text-xl font-bold ${A.heading} leading-snug`}>{title}</h3>
      </div>
      <div className={`text-[15px] leading-[1.75] ${A.body} pl-12`}>
        {children}
      </div>
    </motion.div>
  );
}

export default function Methodologie() {
  const { language } = useLanguage();
  useCanonicalHreflang('/methodologie');

  const auditCategories = [
    { icon: Bot, title: t3(language, 'Crawlability IA', 'AI Crawlability', 'Crawlability IA'), points: ['robots.txt & User-Agent', 'llms.txt & ai-plugin.json', 'X-Robots-Tag HTTP', 'GPTBot, ClaudeBot, Bingbot'], count: 6 },
    { icon: Globe, title: t3(language, 'Score GEO', 'GEO Score', 'Score GEO'), points: ['JSON-LD & Open Graph', 'Hiérarchie H1-H6', 'Citabilité LLM', 'Fraîcheur des contenus'], count: 7 },
    { icon: Brain, title: t3(language, 'Visibilité LLM', 'LLM Visibility', 'Visibilidad LLM'), points: ['Citation multi-modèles', 'Sentiment IA', 'Part de voix', 'Hallucinations factuelles'], count: 6 },
    { icon: Gauge, title: t3(language, 'Core Web Vitals', 'Core Web Vitals', 'Core Web Vitals'), points: ['LCP, FCP, CLS, TTFB', 'Requêtes HTTP', 'DOM & ressources', 'Mobile responsive'], count: 8 },
    { icon: Radar, title: t3(language, 'Audit Expert SEO/GEO', 'Expert SEO/GEO', 'Auditoría Experta'), points: ['E-E-A-T complet', 'Paysage concurrentiel', 'Zero-Click risk', 'Intelligence de marché'], count: 8 },
    { icon: Search, title: t3(language, 'Mots-clés & Requêtes', 'Keywords & Queries', 'Palabras clave'), points: ['Positionnement SERP', 'Requêtes LLM ciblées', 'Intentions de recherche', 'Contenu prioritaire'], count: 5 },
    { icon: Code, title: t3(language, 'Code Correctif', 'Corrective Code', 'Código correctivo'), points: ['JSON-LD injection', 'Balises méta & OG', 'Alt images', 'SDK + kill switch'], count: 6 },
    { icon: Eye, title: t3(language, 'Résilience Contenu', 'Content Resilience', 'Resiliencia'), points: ['Dark Social Readiness', 'Quotability Index', 'Summary Resilience', 'Red Teaming'], count: 8 },
    { icon: TrendingUp, title: t3(language, 'Suivi & KPI', 'Tracking & KPI', 'Seguimiento'), points: ['Google Search Console', 'Historique & tendances', 'Export PDF', "Plan d'action"], count: 6 },
    { icon: Award, title: t3(language, 'Ranking SERP', 'SERP Ranking', 'Ranking SERP'), points: [t3(language, 'Top 3 / 10 / 50', 'Top 3 / 10 / 50', 'Top 3 / 10 / 50'), t3(language, 'ETV (Estimated Traffic Value)', 'ETV (Estimated Traffic Value)', 'ETV'), t3(language, 'Pages indexées & tendance', 'Indexed pages & trend', 'Páginas indexadas'), t3(language, 'Distribution des positions', 'Position distribution', 'Distribución de posiciones')], count: 5 },
    { icon: Swords, title: t3(language, 'Concurrence', 'Competition', 'Competencia'), points: [t3(language, 'Benchmark 3 concurrents', '3-competitor benchmark', 'Benchmark 3 competidores'), t3(language, 'Scores SEO, GEO & SERP croisés', 'Cross SEO, GEO & SERP scores', 'Scores SEO, GEO y SERP cruzados'), t3(language, 'Pression concurrentielle', 'Competitive pressure', 'Presión competitiva'), t3(language, 'Opportunités de dépassement', 'Overtaking opportunities', 'Oportunidades de superación')], count: 5 },
  ];

  const algorithms = [
    { name: 'TF-IDF Sémantique', description: 'Pertinence thématique et visualisation 3D du cocon', icon: Layers },
    { name: 'Score IAS', description: "Indice d'Alignement Stratégique — 23 variables croisées", icon: Target },
    { name: 'GEO Score', description: 'Visibilité dans les moteurs de réponse IA', icon: Globe },
    { name: 'Triangle Prédictif', description: 'Prédiction trafic corrélée GSC/GA4 — MAPE < 15%', icon: TrendingUp },
    { name: 'Part de Voix', description: '40% LLM + 35% SERP + 25% ETV', icon: BarChart3 },
    { name: 'Empreinte Lexicale', description: 'Signature sémantique unique par entité', icon: FileText },
    { name: 'PageRank Interne', description: 'Calcul du maillage et distribution de jus', icon: GitBranch },
  ];

  const pipelineSteps = [
    { icon: Search, title: 'Crawl & Collecte', description: "Crawl du site (jusqu'à 5 000 pages), extraction HTML, détection robots.txt, llms.txt, ai-plugin.json. Collecte simultanée des données SERP, GSC, GA4 et PageSpeed." },
    { icon: Database, title: 'Normalisation & Cache', description: 'Les données brutes sont normalisées, déduplicquées et mises en cache (TTL intelligent). Architecture multi-fallback sur toutes les APIs critiques.' },
    { icon: Cpu, title: 'Analyse Algorithmique', description: "7 algorithmes propriétaires s'exécutent en parallèle : TF-IDF, GEO Score, IAS, Part de Voix, Triangle Prédictif, Empreinte Lexicale, PageRank Interne." },
    { icon: Brain, title: 'Enrichissement LLM', description: 'Interrogation parallèle de ChatGPT, Gemini, Perplexity et Claude pour mesurer la visibilité, détecter les hallucinations et évaluer la citabilité.' },
    { icon: Code, title: 'Génération de Correctifs', description: 'Code correctif personnalisé (JSON-LD, balises méta, maillage) prêt à déployer via WordPress, GTM ou SDK sécurisé avec kill switch distant.' },
    { icon: BarChart3, title: 'Scoring & Rapport', description: "Score global sur 200 points, export PDF, plan d'action priorisé par impact et suivi dans le temps via la console de monitoring." },
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#f5f5f5] dark:from-neutral-900 via-background to-background" />
          <div className="relative mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm mb-6 ${A.badge}`}
            >
              <BookOpen className="h-4 w-4" />
              <span>{t3(language, 'Transparence & Rigueur', 'Transparency & Rigor', 'Transparencia y Rigor')}</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight ${A.heading}`}
            >
              {t3(language, 'Comment Crawlers.fr', 'How Crawlers.fr', 'Cómo Crawlers.fr')}{' '}
              <span className={A.highlight}>{t3(language, 'analyse votre site', 'analyzes your site', 'analiza su sitio')}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-10 ${A.body}`}
            >
              {t3(language,
                '7 algorithmes propriétaires, 9 catégories d\'analyse, architecture multi-fallback résiliente. Chaque score est calculé, jamais estimé.',
                '7 proprietary algorithms, 9 analysis categories, resilient multi-fallback architecture. Every score is computed, never estimated.',
                '7 algoritmos propietarios, 9 categorías de análisis, arquitectura multi-fallback resiliente. Cada puntuación es calculada, nunca estimada.'
              )}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
            >
              <Link to="/audit-expert" className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors bg-[#5b21b6] hover:bg-[#4c1d95] text-white">
                {t3(language, 'Tester sur mon site — Gratuit', 'Test on My Site — Free', 'Probar en mi sitio — Gratis')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/data-flow-diagram" className={`inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-colors ${A.ctaOutline}`}>
                {t3(language, 'Voir le Data Flow', 'View Data Flow', 'Ver el Data Flow')}
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
              <AnimatedStat value={totalPoints} suffix="+" label={t3(language, "Points d'audit", 'Audit points', 'Puntos de auditoría')} />
              <AnimatedStat value={7} label={t3(language, 'Algorithmes', 'Algorithms', 'Algoritmos')} />
              <AnimatedStat value={111} label="Edge Functions" />
              <AnimatedStat value={10} suffix="+" label={t3(language, 'Sources de données', 'Data sources', 'Fuentes de datos')} />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── SECTION ÉDITORIALE : Pourquoi la méthode fait tout ── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section className={`py-20 px-4 ${A.sectionAlt} border-y ${A.separator}`}>
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className={`text-2xl sm:text-3xl font-bold mb-4 ${A.heading}`}>
                {t3(language,
                  'Pourquoi la plupart des outils SEO-IA ne sont pas fiables',
                  'Why most AI-SEO tools are unreliable',
                  'Por qué la mayoría de herramientas SEO-IA no son fiables'
                )}
              </h2>
              <p className={`max-w-2xl mx-auto ${A.muted}`}>
                {t3(language,
                  'Pas un manifeste. Des faits techniques. Ce qui sépare l\'audit vérifiable de l\'estimation générative.',
                  'Not a manifesto. Technical facts. What separates verifiable audit from generative estimation.',
                  'No es un manifiesto. Hechos técnicos.'
                )}
              </p>
            </motion.div>

            <EditorialBlock icon={AlertTriangle} title="Un cerveau sans membres" index={0}>
              <p className="mb-4">
                La plupart des nouveaux outils SEO « IA-first » ne crawlent pas les sites. Ils s'appuient uniquement sur la réponse des LLMs, sans pouvoir mesurer la profondeur du crawl du modèle en question. <strong className={A.accent}>Crawlers crawle lui-même chaque page</strong> pour s'assurer concrètement que les audits n'oublient rien.
              </p>
              <p className="mb-4">
                L'IA ne fait pas tout. C'est une couche d'intelligence ultra sophistiquée. Mais un cerveau sans membres — sans jambes pour parcourir le web, sans mains pour saisir les données, sans doigts pour décortiquer le code et la data — c'est un cerveau hors sol, peu digne de confiance.
              </p>
              <p className={`italic ${A.muted}`}>
                Quel est véritablement le gain si, in fine, il faut autant de temps pour auditer la méthode que de temps gagné en audit et en recommandations ?
              </p>
            </EditorialBlock>

            <EditorialBlock icon={Crosshair} title="Les benchmarks sans logs ne détectent rien" index={1}>
              <p>
                Les benchmarks de visibilité qui ne croisent pas avec les logs serveur ne détectent pas vraiment les crawls des bots de ChatGPT, Gemini et de leurs concurrents. Ils essaient de les <em>déduire</em>. Crawlers analyse les logs réels pour identifier précisément quel bot a crawlé quelle page, à quelle fréquence, et avec quelle profondeur — pas une estimation statistique, une observation factuelle.
              </p>
            </EditorialBlock>

            <EditorialBlock icon={Network} title="Les données de Dieu le Père" index={2}>
              <p className="mb-4">
                La vraie différence de Crawlers, c'est qu'il va chercher les données de la source primaire : Google. Tout outil qui ne demande pas à se connecter à <strong className={A.accent}>GSC, GA4, GTM et Ads</strong> est un outil qui se prive des meilleures données en temps réel — celles des utilisateurs finaux, et de la conversion.
              </p>
              <p>
                Sans ces signaux, vous pilotez à l'aveugle. Les données tierces sont utiles en complément, jamais en substitution.
              </p>
            </EditorialBlock>

            <EditorialBlock icon={Fingerprint} title="Une armée de plusieurs légions" index={3}>
              <p className="mb-4">
                Claude Cowork est un surhomme. Crawlers est une armée de plusieurs légions. À bien y réfléchir, ceux qui confient leur SEO/GEO à un assistant IA généraliste gagnent de la vitesse sur les tâches, mais ils en perdent partout ailleurs. Surtout, <strong className={A.accent}>ils perdent énormément en précision</strong> : l'IA juge de l'IA qui juge de l'IA, mais n'interroge jamais les micro-données brutes — celles du code, celles des audiences, celles des utilisateurs.
              </p>
              <p className={`border-l-2 border-[#c4c4c4] dark:border-neutral-600 pl-4 ${A.muted} italic`}>
                À l'ère de l'explosion du contenu, la précision de la méthode et de la stratégie fait la différence entre les experts qui traitent du volume et ceux qui créent de la valeur pour leurs clients — en leur permettant de s'élever au-dessus de la mêlée.
              </p>
            </EditorialBlock>

            <EditorialBlock icon={AlertTriangle} title="29€/mois vs le stack Claude : le calcul est vite fait" index={4}>
              <p className="mb-4">
                Claude plafonne vos requêtes sans prévenir, Crawlers vous laisse libre de travailler. Claude nécessite de comprendre les automations, Crawlers a déjà géré toutes les intégrations pour vous. Claude Code génère du code générique truffé d'hallucinations, Crawlers génère du code correctif validé sur vos données réelles.
              </p>
              <p className="mb-4">
                Pour un freelance SEO, le calcul est simple : Claude Pro (20$/mois) + API Code (variable) + heures de prompting + heures de vérification d'hallucinations = un coût réel de <strong className={A.accent}>plusieurs centaines d'euros par mois</strong>. Crawlers Pro Agency : <strong className={A.accent}>29€/mois, tout inclus</strong>.
              </p>
              <p>
                <Link to="/comparatif-claude-vs-crawlers" className={`font-medium underline underline-offset-2 ${A.accent}`}>
                  → Voir le comparatif complet Claude vs Crawlers
                </Link>
              </p>
            </EditorialBlock>
          </div>
        </section>

        {/* ── Pipeline Visuel ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${A.heading}`}>
                {t3(language, "Pipeline d'analyse — De l'URL au score", 'Analysis Pipeline — From URL to Score', 'Pipeline de análisis — De la URL al score')}
              </h2>
              <p className={`max-w-xl mx-auto ${A.muted}`}>
                {t3(language,
                  'Chaque audit suit un pipeline en 6 étapes, conçu pour la fiabilité et la reproductibilité.',
                  'Each audit follows a 6-step pipeline, designed for reliability and reproducibility.',
                  'Cada auditoría sigue un pipeline de 6 pasos.'
                )}
              </p>
            </motion.div>
            {pipelineSteps.map((step, i) => (
              <PipelineStep key={step.title} icon={step.icon} title={step.title} description={step.description} step={i + 1} isLast={i === pipelineSteps.length - 1} />
            ))}
          </div>
        </section>

        {/* ── 9 Catégories ── */}
        <section className={`py-16 px-4 ${A.sectionAlt}`}>
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${A.heading}`}>
                {t3(language, "11 catégories, +70 points d'audit", '11 Categories, 70+ Audit Points', '11 categorías, +70 puntos de auditoría')}
              </h2>
              <p className={`max-w-2xl mx-auto ${A.muted}`}>
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
                  <Card className={`h-full ${A.cardBg} hover:shadow-md transition-all group`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${A.iconBg} transition-colors`}>
                            <cat.icon className={`h-4.5 w-4.5 ${A.iconColor}`} />
                          </div>
                          <span className={A.heading}>{cat.title}</span>
                        </div>
                        <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${A.badge}`}>
                          {cat.count} pts
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {cat.points.map((point, j) => (
                          <li key={j} className={`flex items-center gap-2 text-sm ${A.body}`}>
                            <CheckCircle2 className={`h-3.5 w-3.5 ${A.muted} shrink-0`} />
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
        <section className={`py-12 px-4 border-y ${A.separator}`}>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className={`text-xl sm:text-2xl font-bold mb-3 ${A.heading}`}>
              {t3(language, 'Voyez ce que révèle votre site', 'See What Your Site Reveals', 'Vea lo que revela su sitio')}
            </h2>
            <p className={`mb-6 ${A.muted}`}>
              {t3(language,
                'Lancez un audit gratuit en 30 secondes. Aucune carte bancaire requise.',
                'Launch a free audit in 30 seconds. No credit card required.',
                'Lance una auditoría gratuita en 30 segundos.'
              )}
            </p>
            <Link to="/audit-expert" className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${A.ctaBg}`}>
              {t3(language, 'Lancer mon audit gratuit', 'Launch My Free Audit', 'Lanzar mi auditoría gratuita')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 7 Algorithmes ── */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm mb-4 ${A.badge}`}>
                <Cpu className="h-4 w-4" />
                <span>{t3(language, 'Propriétaire', 'Proprietary', 'Propietario')}</span>
              </div>
              <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${A.heading}`}>
                {t3(language, '7 algorithmes propriétaires en production', '7 Proprietary Algorithms in Production', '7 algoritmos propietarios en producción')}
              </h2>
              <p className={`max-w-xl mx-auto ${A.muted}`}>
                {t3(language,
                  'Chaque algorithme est calibré sur des données réelles et mis à jour en continu.',
                  'Each algorithm is calibrated on real data and continuously updated.',
                  'Cada algoritmo está calibrado con datos reales.'
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
                  <Card className={`h-full ${A.cardBg} hover:shadow-md transition-all`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${A.iconBg} shrink-0`}>
                          <algo.icon className={`h-5 w-5 ${A.iconColor}`} />
                        </div>
                        <div>
                          <h3 className={`font-semibold mb-1 ${A.heading}`}>{algo.name}</h3>
                          <p className={`text-sm ${A.body}`}>{algo.description}</p>
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
        <section className={`py-16 px-4 ${A.sectionAlt}`}>
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${A.heading}`}>
                {t3(language, 'Architecture — Ce qui garantit la fiabilité', 'Architecture — What Guarantees Reliability', 'Arquitectura')}
              </h2>
            </motion.div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: RefreshCw, title: t3(language, 'Résilience', 'Resilience', 'Resiliencia'),
                  items: [
                    t3(language, 'Multi-fallback sur toutes les APIs critiques', 'Multi-fallback on all critical APIs', 'Multi-fallback en todas las APIs'),
                    t3(language, 'Circuit Breaker anti-cascade', 'Anti-cascade Circuit Breaker', 'Circuit Breaker anti-cascada'),
                    t3(language, 'Queue asynchrone avec progression temps réel', 'Async queue with real-time progress', 'Cola asíncrona con progreso en tiempo real'),
                    t3(language, 'Cache intelligent TTL', 'Intelligent TTL cache', 'Caché inteligente TTL'),
                  ]
                },
                {
                  icon: Lock, title: t3(language, 'Sécurité & RGPD', 'Security & GDPR', 'Seguridad y RGPD'),
                  items: [
                    t3(language, 'Hébergement européen, RGPD natif', 'European hosting, native GDPR', 'Alojamiento europeo'),
                    t3(language, 'Row-Level Security par utilisateur', 'User Row-Level Security', 'RLS por usuario'),
                    t3(language, 'Protection financière côté serveur', 'Server-side financial protection', 'Protección financiera'),
                    t3(language, 'Cloudflare Turnstile anti-bot', 'Cloudflare Turnstile anti-bot', 'Cloudflare Turnstile'),
                  ]
                },
                {
                  icon: Activity, title: t3(language, 'Intégrations', 'Integrations', 'Integraciones'),
                  items: [
                    t3(language, 'Google Search Console & GA4', 'Google Search Console & GA4', 'Google Search Console y GA4'),
                    t3(language, 'Google My Business & PageSpeed', 'Google My Business & PageSpeed', 'Google My Business y PageSpeed'),
                    t3(language, '4 moteurs LLM en parallèle', '4 parallel LLM engines', '4 motores LLM en paralelo'),
                    t3(language, 'DataForSEO (SERP & Backlinks)', 'DataForSEO (SERP & Backlinks)', 'DataForSEO (SERP y Backlinks)'),
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
                  <Card className={`h-full ${A.cardBg}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className={`flex items-center gap-2.5 text-base ${A.heading}`}>
                        <block.icon className={`h-5 w-5 ${A.iconColor}`} />
                        {block.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {block.items.map((item, j) => (
                          <li key={j} className={`flex items-start gap-2 text-sm ${A.body}`}>
                            <CheckCircle2 className={`h-3.5 w-3.5 ${A.muted} mt-0.5 shrink-0`} />
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

        {/* ── CTA Final ── */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#5b21b6] via-[#4c1d95] to-[#2e1065] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.3),transparent_60%)]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-[#fbbf24]">
                {t3(language, 'Testez cette méthodologie sur votre site', 'Test This Methodology on Your Site', 'Pruebe esta metodología en su sitio')}
              </h2>
              <p className="mb-8 max-w-lg mx-auto text-violet-200">
                {t3(language,
                  'Audit gratuit en 30 secondes. Aucune carte bancaire. Résultats immédiats.',
                  'Free audit in 30 seconds. No credit card. Immediate results.',
                  'Auditoría gratuita en 30 segundos.'
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/audit-expert" className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors bg-[#fbbf24] hover:bg-[#f59e0b] text-[#2e1065]">
                  {t3(language, 'Lancer mon audit gratuit', 'Launch My Free Audit', 'Lanzar mi auditoría gratuita')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/tarifs" className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/40 px-6 py-3 text-sm font-semibold transition-colors text-[#fbbf24] hover:bg-white/10">
                  {t3(language, 'Voir tous les tarifs', 'View All Pricing', 'Ver todos los precios')}
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section className={`py-8 px-4 ${A.sectionAlt} border-t ${A.separator}`}>
          <div className="mx-auto max-w-3xl text-center">
            <p className={`text-sm italic ${A.muted}`}>
              {t3(language,
                'Les algorithmes, pondérations et modes de calcul utilisés par Crawlers.fr sont propriétaires et ne sont pas divulgués. Cette page présente le périmètre d\'analyse, pas la méthodologie de scoring.',
                'The algorithms, weightings and calculation methods used by Crawlers.fr are proprietary and not disclosed.',
                'Los algoritmos, ponderaciones y métodos de cálculo son propietarios y no se divulgan.'
              )}
            </p>
            <p className={`text-xs mt-3 ${A.muted}`}>
              {t3(language, 'Dernière mise à jour : Avril 2026', 'Last updated: April 2026', 'Última actualización: Abril 2026')}
            </p>
          </div>
        </section>

        {/* ── Sources & Ressources ── */}
        <section className={`py-12 px-4 border-t ${A.separator}`}>
          <div className="mx-auto max-w-3xl">
            <h2 className={`text-xl font-bold mb-6 ${A.heading}`}>
              {t3(language, 'Sources & Ressources', 'Sources & Resources', 'Fuentes y Recursos')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: 'Google Search Central — Crawling & Indexing', url: 'https://developers.google.com/search/docs/crawling-indexing' },
                { title: 'Schema.org — Structured Data Reference', url: 'https://schema.org/docs/gs.html' },
                { title: 'Google — Core Web Vitals', url: 'https://web.dev/articles/vitals' },
                { title: 'W3C — Web Content Accessibility Guidelines', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' },
                { title: 'Anthropic — Claude Pricing', url: 'https://www.anthropic.com/pricing' },
                { title: 'Google — Search Quality Evaluator Guidelines (E-E-A-T)', url: 'https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf' },
              ].map(s => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${A.separator} hover:bg-[#f0f0f0] dark:hover:bg-neutral-800 transition-colors`}>
                  <BookOpen className={`h-4 w-4 ${A.muted} shrink-0 mt-0.5`} />
                  <span className={A.body}>{s.title}</span>
                </a>
              ))}
            </div>
            <div className="mt-8">
              <h3 className={`text-lg font-semibold mb-4 ${A.heading}`}>
                {t3(language, 'Pages associées', 'Related Pages', 'Páginas relacionadas')}
              </h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { to: '/audit-expert', label: 'Audit Expert SEO/GEO' },
                  { to: '/score-geo', label: 'Score GEO' },
                  { to: '/comparatif-claude-vs-crawlers', label: 'Claude vs Crawlers' },
                  { to: '/app/ranking-serp', label: 'Ranking SERP' },
                  { to: '/features', label: 'Features' },
                  { to: '/tarifs', label: 'Tarifs' },
                  { to: '/analyse-bots-ia', label: 'Analyse Bots IA' },
                  { to: '/blog', label: 'Blog' },
                  { to: '/data-flow-diagram', label: 'Data Flow' },
                ].map(l => (
                  <Link key={l.to} to={l.to} className={`text-sm px-3 py-1.5 rounded-full border ${A.badge} hover:bg-[#e8e8e8] dark:hover:bg-neutral-700 transition-colors`}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
