import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Check, X, ArrowRight, Brain, Bot, Zap, Database,
  BarChart3, Cpu, Network, Target, Layers, Lock,
  Activity, Server, GitBranch, Workflow, TrendingUp,
  Users, LineChart, Shield, Eye, Repeat, Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const SITE_URL = 'https://crawlers.fr';

/* ── Anthracite palette (shared with other comparatif pages) ── */
const A = {
  heading: 'text-[#2d2d2d] dark:text-neutral-100',
  body: 'text-[#4a4a4a] dark:text-neutral-300',
  muted: 'text-[#6b6b6b] dark:text-neutral-400',
  cardBg: 'bg-[#fafafa] dark:bg-neutral-900 border-[#e5e5e5] dark:border-neutral-700',
  iconBg: 'bg-[#ededed] dark:bg-neutral-800',
  iconColor: 'text-[#3d3d3d] dark:text-neutral-300',
  sectionAlt: 'bg-[#f7f7f7] dark:bg-neutral-900/50',
  ctaBg: 'bg-[#2d2d2d] dark:bg-neutral-800 hover:bg-[#1a1a1a] dark:hover:bg-neutral-700 text-white',
  separator: 'border-[#e5e5e5] dark:border-neutral-700',
  badge: 'border-[#d1d1d1] dark:border-neutral-600 bg-[#f5f5f5] dark:bg-neutral-800 text-[#4a4a4a] dark:text-neutral-300',
};

/* ── Structured data ── */
const articleSD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Crawlers vs Claude Agent vs OpenAI : pourquoi une plateforme SEO/GEO dédiée fait la différence",
  "description": "Comparatif détaillé entre les agents IA généralistes (Claude, ChatGPT) et Crawlers.fr, plateforme spécialisée SEO/GEO avec données croisées et mutualisées.",
  "author": { "@type": "Person", "name": "Adrien de Volontat", "url": `${SITE_URL}/a-propos` },
  "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": SITE_URL },
  "datePublished": "2026-04-10",
  "dateModified": "2026-04-10",
  "wordCount": 5000,
  "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/comparatif-plateforme-seo-ia` },
};

const breadcrumbSD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL },
    { "@type": "ListItem", "position": 2, "name": "Comparatifs" },
    { "@type": "ListItem", "position": 3, "name": "Plateforme vs Agents IA", "item": `${SITE_URL}/comparatif-plateforme-seo-ia` },
  ],
};

/* ── Three columns comparison ── */
interface TriRow {
  criterion: string;
  crawlers: string;
  claudeAgent: string;
  openai: string;
  crawlersOk: boolean;
  claudeOk: boolean;
  openaiOk: boolean;
}

const triComparison: TriRow[] = [
  {
    criterion: "Donnée de crawl réel",
    crawlers: "Crawl HTTP propriétaire, parsing DOM complet",
    claudeAgent: "Aucun crawl — déduit depuis le LLM",
    openai: "Browsing limité, pas de crawl technique",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Connexion GSC / GA4 / Ads",
    crawlers: "Native, données temps réel historisées",
    claudeAgent: "Nécessite MCP + setup manuel",
    openai: "Plugins limités, pas d'historisation",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Base de données partagée",
    crawlers: "147+ tables, données croisées entre utilisateurs",
    claudeAgent: "Contexte isolé par conversation",
    openai: "Mémoire limitée par session",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Algorithmes prédictifs",
    crawlers: "Prédiction trafic J+90, déclin, opportunités",
    claudeAgent: "Estimations sans données réelles",
    openai: "Suggestions génériques, pas de prédiction",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Audit GEO / Visibilité LLM",
    crawlers: "Score 0-100, 4+ LLMs testés en parallèle",
    claudeAgent: "Auto-évaluation biaisée",
    openai: "Pas d'audit GEO natif",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Analyse des logs serveur",
    crawlers: "40+ bots IA détectés, comparaison vs GSC",
    claudeAgent: "Impossible — pas d'accès logs",
    openai: "Impossible — pas d'accès logs",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Cocon sémantique",
    crawlers: "Visualisation 3D + déploiement CMS auto",
    claudeAgent: "Suggestions textuelles, copier-coller",
    openai: "Suggestions textuelles, copier-coller",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Déploiement vers CMS",
    crawlers: "Push one-click WordPress / Shopify",
    claudeAgent: "Copier-coller + validation manuelle",
    openai: "Copier-coller uniquement",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Rapports marque blanche",
    crawlers: "PDF brandé + lien partageable",
    claudeAgent: "Aucun rapport structuré",
    openai: "Export texte brut uniquement",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Mémoire inter-sessions",
    crawlers: "Historique complet, tendances, anomalies auto",
    claudeAgent: "Projets limités, contexte perdu",
    openai: "Mémoire optionnelle, fragmentée",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
  {
    criterion: "Tarif freelance/mois",
    crawlers: "29€ tout inclus",
    claudeAgent: "20$ Pro + API + temps de setup",
    openai: "20$ Plus + API + plugins",
    crawlersOk: true, claudeOk: false, openaiOk: false,
  },
];

/* ── Data flywheel advantages ── */
const flywheelPoints = [
  {
    icon: Database,
    title: "Base de données mutualisée",
    desc: "Chaque audit enrichit une base partagée : benchmarks sectoriels, patterns de crawl, référentiels de bots IA. Plus il y a d'utilisateurs, plus les diagnostics sont précis.",
  },
  {
    icon: GitBranch,
    title: "Croisement de données multi-sources",
    desc: "GSC + GA4 + logs serveur + crawl + GEO + backlinks. L'agent IA ne voit qu'un fragment ; Crawlers croise toutes les dimensions pour chaque page.",
  },
  {
    icon: TrendingUp,
    title: "Algorithmes prédictifs calibrés",
    desc: "La masse de données historisées (147+ tables) permet des prédictions de trafic J+90, de déclin, et d'opportunités que les LLMs seuls ne peuvent pas produire.",
  },
  {
    icon: Repeat,
    title: "Boucle diagnostic → prescription → exécution",
    desc: "Là où l'agent IA s'arrête au constat, Crawlers génère le code correctif, le déploie sur le CMS, puis mesure l'impact. Le cycle complet, automatisé.",
  },
  {
    icon: Shield,
    title: "Fiabilité vs hallucination",
    desc: "Chaque recommandation est adossée à une donnée réelle crawlée, pas à une inférence statistique. Zéro hallucination sur les diagnostics techniques.",
  },
  {
    icon: Users,
    title: "Intelligence collective",
    desc: "L'Observatoire GEO, les benchmarks sectoriels et les patterns de correction sont nourris par l'ensemble de la communauté d'utilisateurs.",
  },
];

/* ── FAQ ── */
const faqItems = [
  {
    q: "Pourquoi ne pas simplement utiliser Claude Code pour le SEO ?",
    a: "Claude Code est un excellent outil de développement, mais il ne dispose d'aucune donnée SEO réelle. Il déduit, estime et parfois hallucine. Crawlers crawle réellement vos pages, se connecte à vos données GSC/GA4, et croise ces informations avec les données de milliers d'autres sites pour des diagnostics fiables.",
  },
  {
    q: "OpenAI avec des plugins peut-il remplacer Crawlers ?",
    a: "Les plugins OpenAI offrent des connexions ponctuelles, mais aucune historisation ni croisement de données. Crawlers stocke chaque métrique dans le temps, détecte les anomalies automatiquement, et alimente des algorithmes prédictifs que les plugins ne peuvent pas reproduire.",
  },
  {
    q: "Qu'est-ce que le « croisement de données » apporte concrètement ?",
    a: "Exemple concret : Crawlers peut corréler une baisse de trafic GA4 avec un changement de crawl budget détecté dans les logs serveur, confirmé par une chute de position GSC, et proposer un correctif technique automatique. Un agent IA isolé ne peut pas connecter ces signaux.",
  },
  {
    q: "Crawlers utilise-t-il aussi l'IA ?",
    a: "Oui — Crawlers intègre 16+ modèles IA (Gemini, Claude, Mistral) mais les utilise sur des données réelles, pas en remplacement de données. L'IA est un accélérateur de traitement, pas la source de vérité.",
  },
  {
    q: "Puis-je utiliser Crawlers ET Claude ensemble ?",
    a: "Absolument. Crawlers expose un serveur MCP qui permet à Claude d'interroger vos données SEO réelles. C'est la combinaison optimale : l'intelligence de Claude + les données fiables de Crawlers.",
  },
];

const faqSD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a },
  })),
};

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function ComparatifPlateforme() {
  const { language } = useLanguage();
  useCanonicalHreflang('/comparatif-plateforme-seo-ia');

  return (
    <>
      <Helmet>
        <title>Crawlers vs Claude vs OpenAI — Plateforme SEO/GEO dédiée vs Agents IA</title>
        <meta name="description" content="Pourquoi une plateforme spécialisée SEO/GEO qui stocke et croise les données surpasse les agents IA généralistes comme Claude, ChatGPT ou Cowork pour le référencement." />
        <script type="application/ld+json">{JSON.stringify(articleSD)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSD)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSD)}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen pt-20">
        {/* ── Hero ── */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto max-w-5xl px-4 text-center space-y-6">
            <motion.div initial="hidden" animate="visible" variants={fadeUp}>
              <span className={`inline-flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${A.badge}`}>
                <Layers className="h-3.5 w-3.5" /> Comparatif 2026
              </span>
            </motion.div>

            <motion.h1
              initial="hidden" animate="visible" variants={fadeUp}
              className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight ${A.heading}`}
            >
              Plateforme SEO/GEO dédiée
              <br />
              <span className="text-primary">vs Agents IA généralistes</span>
            </motion.h1>

            <motion.p
              initial="hidden" animate="visible" variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: 0.1, duration: 0.5 } } }}
              className={`max-w-2xl mx-auto text-base sm:text-lg ${A.body}`}
            >
              Claude, ChatGPT, Cowork… Ces agents IA sont puissants, mais ils devinent là où Crawlers <strong>mesure</strong>.
              La différence ? <strong>147+ tables de données croisées</strong>, historisées et mutualisées entre tous les utilisateurs du segment SEO/GEO.
            </motion.p>

            <motion.div
              initial="hidden" animate="visible" variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: 0.2, duration: 0.5 } } }}
              className="flex flex-wrap justify-center gap-3 pt-2"
            >
              <Link to="/auth">
                <Button size="lg" className={`gap-2 font-semibold px-8 shadow-lg ${A.ctaBg}`}>
                  Essayer Crawlers gratuitement <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/comparatif-claude-vs-crawlers">
                <Button variant="outline" size="lg" className="gap-2">
                  Voir Claude vs Crawlers <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── The core thesis ── */}
        <section className={`py-16 md:py-20 ${A.sectionAlt}`}>
          <div className="container mx-auto max-w-4xl px-4 space-y-8">
            <div className="text-center space-y-3">
              <h2 className={`text-2xl sm:text-3xl font-bold ${A.heading}`}>
                Le problème des agents IA généralistes
              </h2>
              <p className={`max-w-2xl mx-auto ${A.body}`}>
                Un agent IA est un <strong>cerveau sans mémoire sectorielle</strong>. Il peut raisonner, mais il ne stocke pas, ne croise pas, et ne capitalise pas sur les données spécifiques au SEO/GEO.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Brain,
                  title: "L'agent IA généraliste",
                  points: ["Raisonne à partir de connaissances générales", "Contexte perdu entre les sessions", "Aucune donnée de crawl réel", "Hallucinations sur les métriques"],
                  color: "text-orange-500",
                },
                {
                  icon: Bot,
                  title: "L'agent + plugins/MCP",
                  points: ["Connexions ponctuelles possibles", "Pas d'historisation des données", "Setup complexe et fragile", "Données non croisées entre sources"],
                  color: "text-amber-500",
                },
                {
                  icon: Target,
                  title: "Crawlers — plateforme dédiée",
                  points: ["Données réelles crawlées et historisées", "Croisement multi-sources automatique", "Prédictions calibrées sur le segment", "Intelligence collective mutualisée"],
                  color: "text-emerald-500",
                },
              ].map((col, i) => (
                <Card key={i} className={`${A.cardBg} border`}>
                  <CardContent className="p-6 space-y-4">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${A.iconBg}`}>
                      <col.icon className={`h-5 w-5 ${col.color}`} />
                    </div>
                    <h3 className={`font-bold text-lg ${A.heading}`}>{col.title}</h3>
                    <ul className="space-y-2">
                      {col.points.map((p, j) => (
                        <li key={j} className={`flex items-start gap-2 text-sm ${A.body}`}>
                          {i === 2
                            ? <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            : <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                          }
                          {p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Triple comparison table ── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-6xl px-4 space-y-8">
            <div className="text-center space-y-3">
              <h2 className={`text-2xl sm:text-3xl font-bold ${A.heading}`}>
                Comparatif détaillé : 3 approches face à face
              </h2>
              <p className={`max-w-2xl mx-auto text-sm sm:text-base ${A.muted}`}>
                Crawlers.fr vs Claude Agent/Cowork vs ChatGPT/OpenAI — critère par critère.
              </p>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b-2 ${A.separator}`}>
                    <th className={`py-3 px-4 text-left font-bold ${A.heading}`}>Critère</th>
                    <th className={`py-3 px-4 text-left font-bold text-emerald-600 dark:text-emerald-400`}>
                      <span className="flex items-center gap-2"><Target className="h-4 w-4" /> Crawlers.fr</span>
                    </th>
                    <th className={`py-3 px-4 text-left font-bold ${A.muted}`}>
                      <span className="flex items-center gap-2"><Brain className="h-4 w-4" /> Claude Agent</span>
                    </th>
                    <th className={`py-3 px-4 text-left font-bold ${A.muted}`}>
                      <span className="flex items-center gap-2"><Bot className="h-4 w-4" /> OpenAI / ChatGPT</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {triComparison.map((row, i) => (
                    <tr key={i} className={`border-b ${A.separator} ${i % 2 === 0 ? '' : A.sectionAlt}`}>
                      <td className={`py-3 px-4 font-medium ${A.heading}`}>{row.criterion}</td>
                      <td className="py-3 px-4">
                        <span className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span className={`${A.body} font-medium`}>{row.crawlers}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                          <span className={A.muted}>{row.claudeAgent}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                          <span className={A.muted}>{row.openai}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-4">
              {triComparison.map((row, i) => (
                <Card key={i} className={`${A.cardBg} border`}>
                  <CardContent className="p-4 space-y-3">
                    <h3 className={`font-bold text-sm ${A.heading}`}>{row.criterion}</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Crawlers</span>
                          <p className={`text-sm ${A.body}`}>{row.crawlers}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <span className={`text-xs font-bold ${A.muted}`}>Claude</span>
                          <p className={`text-sm ${A.muted}`}>{row.claudeAgent}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <span className={`text-xs font-bold ${A.muted}`}>OpenAI</span>
                          <p className={`text-sm ${A.muted}`}>{row.openai}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── The data flywheel ── */}
        <section className={`py-16 md:py-20 ${A.sectionAlt}`}>
          <div className="container mx-auto max-w-5xl px-4 space-y-10">
            <div className="text-center space-y-3">
              <span className={`inline-flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${A.badge}`}>
                <Activity className="h-3.5 w-3.5" /> L'avantage structurel
              </span>
              <h2 className={`text-2xl sm:text-3xl font-bold ${A.heading}`}>
                Le volant d'inertie des données croisées
              </h2>
              <p className={`max-w-2xl mx-auto ${A.body}`}>
                Chaque utilisateur de Crawlers enrichit une base commune. Plus la communauté grandit, plus les diagnostics, les benchmarks et les prédictions deviennent précis.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {flywheelPoints.map((fp, i) => (
                <motion.div
                  key={i}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: i * 0.08, duration: 0.5 } } }}
                >
                  <Card className={`${A.cardBg} border h-full`}>
                    <CardContent className="p-6 space-y-3">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${A.iconBg}`}>
                        <fp.icon className={`h-5 w-5 ${A.iconColor}`} />
                      </div>
                      <h3 className={`font-bold ${A.heading}`}>{fp.title}</h3>
                      <p className={`text-sm ${A.body}`}>{fp.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Visual schema: data flow ── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-4xl px-4 space-y-8">
            <div className="text-center space-y-3">
              <h2 className={`text-2xl sm:text-3xl font-bold ${A.heading}`}>
                Agent IA isolé vs Plateforme connectée
              </h2>
              <p className={`max-w-xl mx-auto text-sm ${A.muted}`}>
                Visualisez la différence fondamentale d'architecture.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Agent IA */}
              <Card className={`${A.cardBg} border`}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-red-500" />
                    </div>
                    <h3 className={`font-bold ${A.heading}`}>Agent IA seul</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      "Prompt → Réponse → Oubli",
                      "Données = connaissances d'entraînement",
                      "Pas de connexion aux APIs SEO",
                      "Pas de mémoire entre sessions",
                      "Pas de benchmark sectoriel",
                      "Résultat : recommandations génériques",
                    ].map((line, j) => (
                      <div key={j} className={`flex items-center gap-2 ${A.muted}`}>
                        <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Crawlers */}
              <Card className="border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/5">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Network className="h-5 w-5 text-emerald-500" />
                    </div>
                    <h3 className={`font-bold ${A.heading}`}>Crawlers — Plateforme</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      "Crawl → Stockage → Croisement → Prédiction",
                      "Données = crawl réel + GSC + GA4 + logs",
                      "16+ intégrations natives (APIs SEO)",
                      "Historisation complète, tendances auto",
                      "Benchmarks nourris par la communauté",
                      "Résultat : prescriptions exécutables",
                    ].map((line, j) => (
                      <div key={j} className={`flex items-center gap-2 ${A.body}`}>
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ── Key quote ── */}
        <section className={`py-12 ${A.sectionAlt}`}>
          <div className="container mx-auto max-w-3xl px-4 text-center">
            <blockquote className={`text-xl sm:text-2xl font-semibold italic ${A.heading}`}>
              « L'IA généraliste devine le SEO.
              <br />
              Une plateforme dédiée le <span className="text-primary">mesure</span>, le <span className="text-primary">croise</span> et le <span className="text-primary">prédit</span>. »
            </blockquote>
            <p className={`mt-4 text-sm ${A.muted}`}>— Le principe fondateur de Crawlers.fr</p>
          </div>
        </section>

        {/* ── MCP bridge ── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-4xl px-4 space-y-6">
            <div className="text-center space-y-3">
              <h2 className={`text-2xl sm:text-3xl font-bold ${A.heading}`}>
                Et si vous voulez les deux ?
              </h2>
              <p className={`max-w-2xl mx-auto ${A.body}`}>
                Crawlers expose un <strong>serveur MCP</strong> qui permet à Claude, ChatGPT ou tout agent IA d'interroger vos données SEO réelles.
                L'intelligence de l'agent + la fiabilité des données Crawlers = la combinaison optimale.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border ${A.cardBg}`}>
                <Brain className={`h-8 w-8 ${A.muted}`} />
                <div>
                  <p className={`font-bold ${A.heading}`}>Agent IA</p>
                  <p className={`text-xs ${A.muted}`}>Raisonnement</p>
                </div>
              </div>

              <div className="flex items-center">
                <ArrowRight className={`h-6 w-6 ${A.muted} rotate-90 sm:rotate-0`} />
              </div>

              <div className="flex items-center gap-3 px-6 py-4 rounded-xl border border-primary/30 bg-primary/5">
                <Server className="h-8 w-8 text-primary" />
                <div>
                  <p className={`font-bold ${A.heading}`}>MCP Crawlers</p>
                  <p className="text-xs text-primary">Données réelles</p>
                </div>
              </div>

              <div className="flex items-center">
                <ArrowRight className={`h-6 w-6 ${A.muted} rotate-90 sm:rotate-0`} />
              </div>

              <div className="flex items-center gap-3 px-6 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <Zap className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className={`font-bold ${A.heading}`}>Résultat fiable</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">IA + données</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className={`py-16 md:py-20 ${A.sectionAlt}`}>
          <div className="container mx-auto max-w-3xl px-4 space-y-8">
            <h2 className={`text-2xl sm:text-3xl font-bold text-center ${A.heading}`}>
              Questions fréquentes
            </h2>
            <div className="space-y-4">
              {faqItems.map((f, i) => (
                <Card key={i} className={`${A.cardBg} border`}>
                  <CardContent className="p-6 space-y-2">
                    <h3 className={`font-bold ${A.heading}`}>{f.q}</h3>
                    <p className={`text-sm ${A.body}`}>{f.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-3xl px-4 text-center space-y-6">
            <h2 className={`text-2xl sm:text-3xl font-bold ${A.heading}`}>
              Prêt à passer de l'estimation à la mesure ?
            </h2>
            <p className={`${A.body}`}>
              Rejoignez les professionnels SEO qui utilisent une plateforme conçue pour leur métier — pas un chatbot généraliste.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className={`gap-2 font-semibold px-8 shadow-lg ${A.ctaBg}`}>
                  Commencer gratuitement <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/tarifs">
                <Button variant="outline" size="lg" className="gap-2">
                  Voir les tarifs
                </Button>
              </Link>
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
