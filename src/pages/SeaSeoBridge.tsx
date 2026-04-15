import { memo, Suspense, lazy } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, TrendingUp, Search, BarChart3, Brain, Target,
  Zap, DollarSign, Layers, CheckCircle2, ChevronRight,
  LineChart, Sparkles, Shield, ArrowDown,
  Lightbulb, PieChart, Crosshair, Rocket
} from 'lucide-react';
import { motion } from 'framer-motion';

const SeaBridgeScene = lazy(() => import('@/components/SeaBridge/SeaBridgeScene'));
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

/* ── Violet palette ── */
const V = {
  accent: 'text-violet-400',
  accentBg: 'bg-violet-500/10',
  border: 'border-violet-500/20',
  gradient: 'from-violet-600 to-violet-400',
  gradientBg: 'from-violet-950/30 via-violet-900/10 to-background',
  cardHover: 'hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/5',
  btn: 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/25',
  btnOutline: 'border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:border-violet-400/60',
};

const SeaSeoBridgePage = memo(() => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Crawlers SEA → SEO Bridge',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://crawlers.fr/sea-seo-bridge',
    description: 'Module d\'analyse croisée SEA/SEO propulsé par l\'IA. Identifiez les mots-clés payants convertibles en trafic organique et optimisez votre budget publicitaire grâce à l\'intelligence artificielle.',
    offers: {
      '@type': 'Offer',
      price: '29',
      priceCurrency: 'EUR',
      description: 'Inclus dans l\'abonnement Pro Agency (sans engagement)',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      'Croisement Google Ads × Google Search Console',
      'Détection de gaps SEO sur mots-clés rentables',
      'Calcul d\'économies SEA mensuelles potentielles',
      'Injection automatique dans le Workbench Cocoon',
      'Analyse GA4 des pages qui convertissent',
      'Scoring d\'opportunités par potentiel ROI',
    ],
    creator: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Qu\'est-ce que le SEA → SEO Bridge ?',
        acceptedAnswer: { '@type': 'Answer', text: 'Le SEA → SEO Bridge est un module d\'analyse croisée qui identifie les mots-clés achetés en Google Ads qui pourraient être capturés organiquement. En croisant les données de campagnes payantes, les positions Search Console et les gaps détectés par Cocoon, il révèle les opportunités de réduction de budget publicitaire tout en augmentant le trafic organique.' },
      },
      {
        '@type': 'Question',
        name: 'Comment l\'IA intervient-elle dans le croisement SEA/SEO ?',
        acceptedAnswer: { '@type': 'Answer', text: 'L\'intelligence artificielle analyse les corrélations entre trois sources de données : les performances des campagnes Google Ads (CPC, ROAS, conversions), les positions organiques GSC, et les content gaps identifiés par le moteur Cocoon. L\'IA calcule un score d\'opportunité pondéré et priorise les mots-clés par potentiel d\'économie mensuelle.' },
      },
      {
        '@type': 'Question',
        name: 'Quels sont les prérequis pour utiliser le module ?',
        acceptedAnswer: { '@type': 'Answer', text: 'Le module nécessite trois prérequis : un audit technique complété, un audit stratégique complété, et au moins une session Cocoon active sur le site concerné. Ces analyses alimentent le croisement de données. Il faut également connecter Google Ads et Google Search Console via l\'onglet API de la Console.' },
      },
      {
        '@type': 'Question',
        name: 'Peut-on automatiser l\'exploitation des opportunités détectées ?',
        acceptedAnswer: { '@type': 'Answer', text: 'Oui. Les opportunités détectées peuvent être injectées directement dans le Workbench de Parménion (l\'agent stratégique de Crawlers). Elles sont automatiquement catégorisées en content gaps, quick wins ou risques de cannibalisation, et peuvent être transformées en contenus via Content Architect.' },
      },
      {
        '@type': 'Question',
        name: 'Combien peut-on économiser avec le SEA → SEO Bridge ?',
        acceptedAnswer: { '@type': 'Answer', text: 'Les économies dépendent du budget SEA existant et du nombre de mots-clés capturables organiquement. En moyenne, les utilisateurs identifient entre 15% et 40% de leur budget Google Ads comme potentiellement récupérable via un positionnement SEO ciblé. Le module calcule les économies mensuelles potentielles en temps réel.' },
      },
      {
        '@type': 'Question',
        name: 'Le module est-il inclus dans l\'abonnement Pro Agency ?',
        acceptedAnswer: { '@type': 'Answer', text: 'Oui, le SEA → SEO Bridge est inclus sans surcoût dans les abonnements Pro Agency (29€/mois) et Pro Agency+ (79€/mois), sans engagement. Il est accessible depuis l\'onglet "SEA→SEO" de la Console.' },
      },
    ],
  };

  const opportunities = [
    {
      icon: <Target className="h-6 w-6" />,
      title: 'Mots-clés sans couverture organique',
      type: 'no_organic',
      desc: 'Identifiez les mots-clés que vous achetez en Google Ads mais sur lesquels vous n\'avez aucune position organique. Ce sont vos plus grandes opportunités de réduction de CPC.',
      action: 'Créer du contenu SEO ciblé pour capturer ce trafic gratuitement.',
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: 'Positions organiques faibles',
      type: 'low_organic',
      desc: 'Les mots-clés où vous payez en SEA alors que vous êtes déjà positionné entre la 11ᵉ et la 30ᵉ position organique. Un effort SEO modéré suffirait à atteindre le top 10.',
      action: 'Optimiser les pages existantes et renforcer le maillage interne via Cocoon.',
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: 'Potentiel élevé (ROAS × Volume)',
      type: 'high_potential',
      desc: 'Les mots-clés avec un ROAS élevé en SEA et un volume de recherche important. Le positionnement organique sur ces requêtes générerait un ROI exceptionnel.',
      action: 'Prioriser dans le Workbench et créer un cluster de contenu dédié.',
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Risques de cannibalisation',
      type: 'cannibalization',
      desc: 'Quand vos annonces SEA et vos pages SEO ciblent les mêmes requêtes, elles entrent en compétition. Le module détecte ces conflits pour optimiser l\'allocation budget.',
      action: 'Rationaliser la stratégie : stopper le SEA là où le SEO performe déjà.',
    },
  ];

  const dataSources = [
    {
      icon: <DollarSign className="h-5 w-5" />,
      name: 'Google Ads',
      data: ['Mots-clés achetés & CPC', 'Budget mensuel par campagne', 'ROAS & taux de conversion', 'Impressions & CTR'],
    },
    {
      icon: <Search className="h-5 w-5" />,
      name: 'Search Console',
      data: ['Positions organiques réelles', 'Impressions & clics organiques', 'CTR par mot-clé', 'Pages indexées'],
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      name: 'Google Analytics 4',
      data: ['Pages qui convertissent', 'Parcours utilisateur', 'Taux d\'engagement', 'Revenue par landing page'],
    },
    {
      icon: <Brain className="h-5 w-5" />,
      name: 'Cocoon (IA Stratégique)',
      data: ['Content gaps détectés', 'Clusters thématiques', 'Quick wins identifiés', 'Score de cannibalisation'],
    },
  ];

  return (
    <>
      <Helmet>
        <title>SEA → SEO Bridge — Croisement Google Ads & SEO par l'IA | Crawlers.fr</title>
        <meta name="description" content="Identifiez les mots-clés payants convertibles en trafic organique. L'IA croise Google Ads, Search Console, GA4 et Cocoon pour révéler les opportunités SEO cachées dans vos campagnes SEA." />
        <link rel="canonical" href="https://crawlers.fr/sea-seo-bridge" />
        <meta property="og:title" content="SEA → SEO Bridge — Croisement Google Ads & SEO par l'IA" />
        <meta property="og:description" content="Module d'analyse croisée qui identifie les mots-clés payants convertibles en trafic organique grâce à l'intelligence artificielle." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/sea-seo-bridge" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background font-display">
        {/* ═══ NAV ═══ */}
        <nav className="sticky top-0 z-50 border-b border-violet-500/10 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link to="/" className="text-lg font-bold text-foreground">Crawlers<span className="text-violet-400">.fr</span></Link>
            <div className="flex items-center gap-3">
              <Link to="/tarifs"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-violet-400 rounded-md">Tarifs</Button></Link>
              <Link to="/auth"><Button size="sm" className={`gap-1.5 rounded-md ${V.btn}`}>Commencer <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
            </div>
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section className={`relative overflow-hidden border-b border-violet-500/10 bg-gradient-to-b ${V.gradientBg} py-20 lg:py-28`}>
          {/* Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(139,92,246,0.15),transparent_60%)]" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.div variants={fadeUp}>
                <Badge className={`mb-6 gap-1.5 rounded-md border ${V.border} ${V.accentBg} px-4 py-1.5 text-xs font-semibold ${V.accent}`}>
                  <Zap className="h-3 w-3" /> Module Pro Agency
                </Badge>
              </motion.div>

              <motion.h1 variants={fadeUp} className="mb-6 text-4xl font-extrabold tracking-tight text-foreground lg:text-6xl xl:text-7xl">
                SEA → SEO Bridge
                <span className={`mt-3 block bg-gradient-to-r ${V.gradient} bg-clip-text text-transparent`}>
                  L'IA qui transforme vos dépenses publicitaires en trafic organique
                </span>
              </motion.h1>

              <motion.div variants={fadeUp} className="mx-auto mb-10 max-w-3xl">
                <p className="text-lg leading-relaxed text-muted-foreground">
                  Chez Crawlers.fr, notre approche du <strong className="text-foreground">SEA → SEO Bridge</strong> exploite l'intelligence artificielle pour croiser en temps réel vos données <strong className="text-foreground">Google Ads</strong>, <strong className="text-foreground">Search Console</strong>, <strong className="text-foreground">GA4</strong> et le moteur stratégique <strong className="text-foreground">Cocoon</strong>. Le résultat : une cartographie précise des mots-clés payants que vous pourriez capturer organiquement — et les économies mensuelles associées.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className={`gap-2 rounded-md text-base ${V.btn}`}>
                    <Rocket className="h-4 w-4" /> Activer le module
                  </Button>
                </Link>
                <a href="#visualisation">
                  <Button variant="outline" size="lg" className={`gap-2 rounded-md text-base ${V.btnOutline}`}>
                    Voir en 3D <ArrowDown className="h-4 w-4" />
                  </Button>
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══ 3D VISUALIZATION ═══ */}
        <section id="visualisation" className="border-b border-violet-500/10 bg-gradient-to-b from-violet-950/20 to-background py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
              <motion.div variants={fadeUp}>
                <Badge className={`mb-4 rounded-md border ${V.border} ${V.accentBg} px-3 py-1 text-xs font-semibold ${V.accent}`}>
                  <Brain className="h-3 w-3 mr-1" /> Visualisation
                </Badge>
                <h2 className="text-3xl font-extrabold text-foreground lg:text-4xl">
                  L'IA au cœur de l'écosystème Google
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                  L'introduction de l'intelligence artificielle dans Google Ads et GA4 crée de nouvelles passerelles entre le SEA et le SEO. Crawlers exploite ces connexions pour révéler des opportunités invisibles.
                </p>
              </motion.div>
            </motion.div>

            <div className="grid gap-6 lg:grid-cols-2">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className={`overflow-hidden border ${V.border} ${V.cardHover} transition-all`}>
                  <CardContent className="p-0">
                    <div className="h-[320px] w-full">
                      <Suspense fallback={<div className="flex h-full items-center justify-center bg-violet-950/20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>}>
                        <SeaBridgeScene scene="google-ads" />
                      </Suspense>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-foreground">Google Ads × IA</h3>
                      <p className="mt-1 text-sm text-muted-foreground">L'IA analyse les performances des campagnes payantes et détecte les mots-clés capturables organiquement.</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className={`overflow-hidden border ${V.border} ${V.cardHover} transition-all`}>
                  <CardContent className="p-0">
                    <div className="h-[320px] w-full">
                      <Suspense fallback={<div className="flex h-full items-center justify-center bg-violet-950/20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>}>
                        <SeaBridgeScene scene="ga4" />
                      </Suspense>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-foreground">GA4 × IA</h3>
                      <p className="mt-1 text-sm text-muted-foreground">L'IA croise les conversions GA4 avec les positions organiques pour prioriser les contenus à fort potentiel ROI.</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══ RÉSUMÉ (TL;DR) ═══ */}
        <section className="border-b border-violet-500/10 py-12">
          <div className="mx-auto max-w-5xl px-4">
            <Card className={`border ${V.border} bg-gradient-to-r from-violet-500/5 to-transparent shadow-lg shadow-violet-500/5`}>
              <CardContent className="p-6 lg:p-8">
                <div className="mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-violet-400" />
                  <h2 className="text-lg font-bold text-foreground">En résumé</h2>
                </div>
                <p className="mb-5 leading-relaxed text-muted-foreground">
                  Le <strong className="text-foreground">SEA → SEO Bridge</strong> analyse automatiquement le croisement entre vos campagnes Google Ads et votre visibilité organique. Il détecte 4 types d'opportunités — mots-clés sans couverture SEO, positions faibles améliorables, potentiels ROI élevés et risques de cannibalisation — et les injecte dans le Workbench pour une action immédiate.
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { icon: <Search className="h-4 w-4" />, label: '4 sources de données', sub: 'Ads + GSC + GA4 + Cocoon' },
                    { icon: <Target className="h-4 w-4" />, label: '4 types d\'opportunités', sub: 'Détection automatique' },
                    { icon: <DollarSign className="h-4 w-4" />, label: '15-40% d\'économies', sub: 'Budget SEA récupérable' },
                    { icon: <Zap className="h-4 w-4" />, label: 'Injection 1-clic', sub: 'Vers le Workbench' },
                  ].map((s, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-md border ${V.border} bg-violet-500/5 p-3`}>
                      <span className="mt-0.5 text-violet-400">{s.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ═══ CONTEXTE : POURQUOI L'IA CHANGE LA DONNE ═══ */}
        <section className="border-b border-violet-500/10 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
              <motion.div variants={fadeUp}>
                <Badge className={`mb-4 rounded-md border ${V.border} ${V.accentBg} px-3 py-1 text-xs font-semibold ${V.accent}`}>Contexte</Badge>
                <h2 className="text-3xl font-extrabold text-foreground lg:text-4xl">Pourquoi l'IA rend ce croisement possible</h2>
                <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                  Jusqu'à récemment, croiser les données SEA et SEO restait un travail manuel fastidieux réservé aux grandes agences. L'intelligence artificielle change la donne en permettant une analyse à grande échelle, avec un scoring prédictif que l'humain ne peut pas reproduire.
                </p>
              </motion.div>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: <Brain className="h-8 w-8" />, title: 'Analyse croisée multi-sources', desc: 'L\'IA traite simultanément les données de 4 plateformes Google et du moteur Cocoon pour identifier des corrélations invisibles à l\'œil humain.' },
                { icon: <LineChart className="h-8 w-8" />, title: 'Scoring prédictif', desc: 'Chaque opportunité reçoit un score pondéré basé sur le CPC, le volume, la position actuelle et le potentiel de conversion — permettant une priorisation data-driven.' },
                { icon: <Crosshair className="h-8 w-8" />, title: 'De l\'analyse à l\'action', desc: 'Les opportunités sont automatiquement catégorisées et injectables dans le Workbench pour être transformées en contenus SEO via Content Architect.' },
              ].map((item, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <Card className={`h-full border ${V.border} ${V.cardHover} transition-all`}>
                    <CardContent className="p-6">
                      <div className="mb-4 text-violet-400">{item.icon}</div>
                      <h3 className="mb-2 text-lg font-bold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SOURCES DE DONNÉES ═══ */}
        <section className="border-b border-violet-500/10 bg-gradient-to-b from-violet-950/10 to-background py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <Badge className={`mb-4 rounded-md border ${V.border} ${V.accentBg} px-3 py-1 text-xs font-semibold ${V.accent}`}>Architecture</Badge>
              <h2 className="text-3xl font-extrabold text-foreground lg:text-4xl">4 sources, 1 analyse unifiée</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dataSources.map((src, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <Card className={`h-full border ${V.border} ${V.cardHover} transition-all`}>
                    <CardContent className="p-5">
                      <div className={`mb-3 inline-flex rounded-md p-2.5 ${V.accentBg}`}>
                        <span className="text-violet-400">{src.icon}</span>
                      </div>
                      <h3 className="mb-3 font-bold text-foreground">{src.name}</h3>
                      <ul className="space-y-1.5">
                        {src.data.map((d, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-500/60" />
                            {d}
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

        {/* ═══ OPPORTUNITÉS ═══ */}
        <section id="opportunites" className="border-b border-violet-500/10 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <Badge className={`mb-4 rounded-md border ${V.border} ${V.accentBg} px-3 py-1 text-xs font-semibold ${V.accent}`}>Détection</Badge>
              <h2 className="text-3xl font-extrabold text-foreground lg:text-4xl">4 types d'opportunités détectées</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {opportunities.map((opp, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <Card className={`h-full border ${V.border} ${V.cardHover} transition-all`}>
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className={`rounded-md p-2 ${V.accentBg} text-violet-400`}>{opp.icon}</div>
                        <div>
                          <h3 className="font-bold text-foreground">{opp.title}</h3>
                          <Badge className={`mt-1 rounded-sm border ${V.border} ${V.accentBg} text-[10px] ${V.accent}`}>{opp.type}</Badge>
                        </div>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">{opp.desc}</p>
                      <div className={`rounded-md border ${V.border} bg-violet-500/5 p-3`}>
                        <p className="flex items-start gap-1.5 text-xs font-semibold text-violet-400">
                          <Zap className="mt-0.5 h-3 w-3 shrink-0" />
                          Action : {opp.action}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ WORKFLOW ═══ */}
        <section className="border-b border-violet-500/10 bg-gradient-to-b from-violet-950/10 to-background py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <Badge className={`mb-4 rounded-md border ${V.border} ${V.accentBg} px-3 py-1 text-xs font-semibold ${V.accent}`}>Workflow</Badge>
              <h2 className="text-3xl font-extrabold text-foreground lg:text-4xl">De l'analyse à l'action en 3 étapes</h2>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {[
                { step: '01', icon: <Layers className="h-6 w-6" />, title: 'Prérequis', desc: 'Connectez Google Ads et Search Console depuis l\'onglet API. Lancez un audit technique, un audit stratégique et une session Cocoon sur le site cible.' },
                { step: '02', icon: <PieChart className="h-6 w-6" />, title: 'Analyse croisée', desc: 'Le module croise automatiquement vos mots-clés SEA avec les positions organiques et les content gaps Cocoon. Un dashboard interactif affiche les opportunités classées par potentiel.' },
                { step: '03', icon: <Rocket className="h-6 w-6" />, title: 'Injection & Action', desc: 'Sélectionnez les opportunités pertinentes et injectez-les en 1 clic dans le Workbench. Parménion les priorise et Content Architect peut générer les contenus ciblés.' },
              ].map((s, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <Card className={`h-full border ${V.border} ${V.cardHover} transition-all`}>
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-600/25">{s.step}</span>
                        <span className="text-violet-400">{s.icon}</span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-foreground">{s.title}</h3>
                      <p className="text-sm text-muted-foreground">{s.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="border-b border-violet-500/10 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <h2 className="mb-4 text-3xl font-extrabold text-foreground lg:text-4xl">
                  Arrêtez de payer pour du trafic que le SEO peut capturer
                </h2>
                <p className="mb-8 text-lg text-muted-foreground">
                  Le SEA → SEO Bridge est inclus dans les abonnements Pro Agency (29€/mois) et Pro Agency+ (79€/mois), sans engagement.
                </p>
              </motion.div>
              <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className={`gap-2 rounded-md text-base ${V.btn}`}>
                    <Rocket className="h-4 w-4" /> Commencer maintenant
                  </Button>
                </Link>
                <Link to="/tarifs">
                  <Button variant="outline" size="lg" className={`gap-2 rounded-md text-base ${V.btnOutline}`}>
                    Voir les forfaits <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <p className="mt-4 text-xs text-muted-foreground">Sans engagement · Annulation à tout moment · Support inclus</p>
            </motion.div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="border-b border-violet-500/10 bg-gradient-to-b from-violet-950/10 to-background py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4">
            <div className="text-center mb-12">
              <Badge className={`mb-4 rounded-md border ${V.border} ${V.accentBg} px-3 py-1 text-xs font-semibold ${V.accent}`}>FAQ</Badge>
              <h2 className="text-3xl font-extrabold text-foreground">Questions fréquentes</h2>
            </div>

            <div className="space-y-4">
              {faqJsonLd.mainEntity.map((faq, i) => (
                <Card key={i} className={`border ${V.border} ${V.cardHover} transition-all`}>
                  <CardContent className="p-5">
                    <h3 className="mb-2 font-bold text-foreground">{faq.name}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{faq.acceptedAnswer.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="py-8 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Crawlers.fr — Plateforme d'audit SEO & GEO propulsée par l'IA
          </p>
        </footer>
      </div>
    </>
  );
});

SeaSeoBridgePage.displayName = 'SeaSeoBridgePage';

export default SeaSeoBridgePage;
