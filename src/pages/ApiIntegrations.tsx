import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import {
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

  Shield, Lock, Unplug, ArrowRight, BarChart3, Globe, Terminal,
  Search, TrendingUp, Brain, Network, ShoppingCart, FileText,
  Zap, Eye, Database, CheckCircle2, XCircle, RefreshCw
} from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

interface ApiCard {
  id: string;
  name: string;
  icon: React.ReactNode;
  purpose: string;
  dataUsage: string[];
  interactsWith: string[];
  disconnectable: boolean;
  authMethod: string;
  color: string;
}

const apis: ApiCard[] = [
  {
    id: 'gsc',
    name: 'Google Search Console',
    icon: <Search className="w-6 h-6" />,
    purpose: 'Import automatique des données de recherche Google : clics, impressions, CTR, positions moyennes par requête et par page.',
    dataUsage: [
      'Métriques agrégées et anonymisées pour les prédictions de trafic',
      'Calcul de l\'Indice d\'Alignement Stratégique (IAS)',
      'Détection d\'anomalies SEO (chute de positions, perte de clics)',
      'Corrélation avec les snapshots d\'audit pour mesurer l\'impact ROI',
    ],
    interactsWith: ['Audit Stratégique IA', 'IAS', 'Prédictions de trafic', 'Anomaly Detection', 'Autopilote Parménion'],
    disconnectable: true,
    authMethod: 'OAuth 2.0 Google',
    color: 'text-blue-500',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    icon: <BarChart3 className="w-6 h-6" />,
    purpose: 'Synchronisation des métriques d\'audience : visiteurs uniques, sessions, pages vues, taux de rebond, durée moyenne.',
    dataUsage: [
      'Historisation hebdomadaire anonymisée dans ga4_history_log',
      'Enrichissement des prédictions de ROI post-audit',
      'Corrélation audience/conversions avec les actions SEO déployées',
      'Baseline T0 pour mesurer l\'impact à T+30, T+60, T+90',
    ],
    interactsWith: ['Prédictions ROI', 'Impact Snapshots', 'Anomaly Detection', 'Finances Dashboard'],
    disconnectable: true,
    authMethod: 'OAuth 2.0 Google',
    color: 'text-orange-500',
  },
  {
    id: 'gmb',
    name: 'Google My Business',
    icon: <Globe className="w-6 h-6" />,
    purpose: 'Gestion multi-fiches Google Business Profile : statistiques, posts, avis, photos, optimisation locale.',
    dataUsage: [
      'Métriques locales (recherches, vues, actions) pour le SEO local',
      'Suggestions d\'optimisation de fiche alimentées par IA',
      'Benchmark local anonymisé par secteur et géolocalisation',
    ],
    interactsWith: ['GMB Dashboard', 'Audit GEO', 'Benchmark Local', 'Content Architect'],
    disconnectable: true,
    authMethod: 'OAuth 2.0 Google',
    color: 'text-green-500',
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    icon: <TrendingUp className="w-6 h-6" />,
    purpose: 'Import des campagnes publicitaires et mots-clés payants pour alimenter le bridge SEA↔SEO. Seules des opérations de consultation sont effectuées.',
    dataUsage: [
      'Mots-clés SEA à fort ROI identifiés pour une stratégie SEO organique',
      'Budget publicitaire corrélé au trafic organique potentiel',
      'Métriques de coût par clic pour estimer l\'économie SEO',
      'Scope OAuth : adwords (seul scope disponible — Google ne propose pas d\'alternative restreinte)',
      'Restriction logicielle : seules des opérations de consultation (reports, métriques) sont appelées',
      'Rétention : mots-clés conservés 90 jours max, tokens supprimés à la déconnexion',
      'Révocation : déconnexion en 1 clic depuis Console → SEA→SEO ou API Externes',
    ],
    interactsWith: ['SEA→SEO Bridge', 'Audit Stratégique IA', 'Quick Wins'],
    disconnectable: true,
    authMethod: 'OAuth 2.0 Google (flux dédié)',
    color: 'text-yellow-500',
  },
  {
    id: 'matomo',
    name: 'Matomo',
    icon: <Eye className="w-6 h-6" />,
    purpose: 'Alternative à GA4 pour les sites auto-hébergés : import des visiteurs, sessions, pages vues, taux de rebond.',
    dataUsage: [
      'Synchronisation hebdomadaire (9 semaines) pour la détection d\'anomalies',
      'Métriques d\'audience utilisées pour les prédictions de trafic',
      'Chaque connexion utilise son propre token — aucun secret global',
    ],
    interactsWith: ['Anomaly Detection', 'Prédictions de trafic', 'Impact Snapshots'],
    disconnectable: true,
    authMethod: 'Token API Matomo (token_auth)',
    color: 'text-indigo-500',
  },
  {
    id: 'cms',
    name: 'CMS — Connexion API REST',
    icon: <Network className="w-6 h-6" />,
    purpose: 'Connexion directe à votre CMS pour déployer les correctifs SEO, le maillage interne et les redirections sans quitter Crawlers.',
    dataUsage: [
      'Lecture de la structure du site (pages, articles, taxonomie)',
      'Écriture de code correctif (meta, JSON-LD, robots.txt, llms.txt)',
      'Déploiement du maillage interne Cocoon via le CMS Bridge',
      'Aucune donnée personnelle collectée — uniquement la structure SEO',
    ],
    interactsWith: ['Code Architect', 'Cocoon Auto-Linking', 'Autopilote Parménion', 'Content Architect'],
    disconnectable: true,
    authMethod: 'API REST (Lien Magique / Application Password)',
    color: 'text-cyan-500',
  },
  {
    id: 'rankmath',
    name: 'Rank Math SEO',
    icon: <FileText className="w-6 h-6" />,
    purpose: 'Pilotage direct des meta SEO dans Rank Math depuis Crawlers : meta titles, descriptions, focus keywords, canonical URLs.',
    dataUsage: [
      'Lecture des scores SEO Rank Math par page',
      'Écriture des meta SEO optimisées par l\'IA',
      'Synchronisation des focus keywords avec l\'audit stratégique',
    ],
    interactsWith: ['Code Architect', 'Audit Stratégique IA', 'Autopilote Parménion'],
    disconnectable: true,
    authMethod: 'WordPress REST API (via connexion CMS active)',
    color: 'text-red-500',
  },
  {
    id: 'marina',
    name: 'Marina API',
    icon: <Terminal className="w-6 h-6" />,
    purpose: 'API asynchrone B2B pour générer des rapports SEO & GEO complets (15+ pages) en marque blanche, intégrable sur n\'importe quel site tiers.',
    dataUsage: [
      'Audit complet (technique, stratégique, visibilité IA, cocoon)',
      'Rapports générés dans la langue demandée (fr, en, es)',
      'Données du rapport non réutilisées après génération',
      'Branding personnalisable (intro, CTA, masquage badge)',
    ],
    interactsWith: ['Audit Expert', 'Cocoon', 'GEO Score', 'LLM Visibility'],
    disconnectable: true,
    authMethod: 'Clé API Marina (x-marina-key)',
    color: 'text-violet-500',
  },
];

const securityPoints = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Données anonymisées',
    desc: 'Les métriques transmises aux modèles IA sont agrégées et anonymisées. Aucune donnée brute identifiable n\'est partagée.',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: 'Data Firewall',
    desc: 'Les données Google (GSC, GA4) restent confinées dans un écosystème séparé. Seules des métriques agrégées alimentent les prédictions.',
  },
  {
    icon: <Unplug className="w-5 h-5" />,
    title: 'Déconnexion en 1 clic',
    desc: 'Chaque API est déconnectable instantanément depuis Console → API Externes. La suppression est immédiate et irréversible.',
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    title: 'Recommandations plus précises',
    desc: 'Plus vous connectez de sources, plus les prédictions de ROI, de trafic et les recommandations IA sont précises et contextualisées.',
  },
];

export default function ApiIntegrations() {
  const { language } = useLanguage();
  useCanonicalHreflang('/api-integrations');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>API & Intégrations — Connectez vos outils SEO | Crawlers.fr</title>
        <meta name="description" content="Découvrez toutes les API et intégrations disponibles dans Crawlers.fr : Google Search Console, GA4, Matomo, CMS, Marina API. Données anonymisées, déconnexion en 1 clic." />
        <link rel="canonical" href="https://crawlers.fr/api-integrations" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Crawlers.fr — API & Intégrations",
          "applicationCategory": "SEO Tool",
          "description": "Hub d'intégrations API pour audits SEO/GEO avec données anonymisées et déconnexion instantanée.",
          "url": "https://crawlers.fr/api-integrations",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
        })}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="container mx-auto px-4 relative z-10 max-w-4xl text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp}>
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm border-primary/30 bg-primary/5">
                <Database className="w-3.5 h-3.5 mr-1.5" />
                {apis.length} intégrations disponibles
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                API & <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">Intégrations</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
                Connectez vos outils existants pour des recommandations plus précises, des prédictions de ROI fiables et une automatisation complète.
              </p>
              <p className="text-sm text-muted-foreground/70 max-w-xl mx-auto">
                Toutes les données sont <strong className="text-foreground">anonymisées</strong>. 
                Chaque intégration est <strong className="text-foreground">déconnectable en 1 clic</strong>.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Security guarantees */}
        <section className="py-12 border-y border-border/50 bg-muted/30">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {securityPoints.map((sp, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: i * 0.1, duration: 0.4 } } }}
                  className="flex flex-col items-center text-center gap-3 p-4"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {sp.icon}
                  </div>
                  <h3 className="font-semibold text-sm">{sp.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{sp.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* API Cards */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Toutes les intégrations</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Chaque API enrichit vos audits et recommandations. Plus de données connectées = plus de précision.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {apis.map((api, i) => (
                <motion.div
                  key={api.id}
                  id={api.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-50px' }}
                  variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: i * 0.05, duration: 0.4 } } }}
                >
                  <Card className="h-full border-border/60 hover:border-primary/30 transition-colors">
                    <CardContent className="p-6 space-y-4">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0 ${api.color}`}>
                          {api.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base">{api.name}</h3>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-green-500/30 text-green-500 bg-green-500/5">
                              <Unplug className="w-2.5 h-2.5 mr-0.5" />
                              Déconnectable
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{api.authMethod}</p>
                        </div>
                      </div>

                      {/* Purpose */}
                      <p className="text-sm text-muted-foreground leading-relaxed">{api.purpose}</p>

                      {/* Data usage */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          Utilisation des données (anonymisées)
                        </p>
                        <ul className="space-y-1.5">
                          {api.dataUsage.map((usage, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                              <span>{usage}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Interacts with */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          Alimente les outils
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {api.interactsWith.map((tool, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px] py-0.5 px-2">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Data flow summary */}
        <section className="py-16 bg-muted/30 border-t border-border/50">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Comment vos données sont utilisées</h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Le cycle est simple : vous connectez → nous anonymisons → l'IA analyse → vous obtenez des recommandations précises.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
                      <Database className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold mb-2">Collecte</h3>
                    <p className="text-xs text-muted-foreground">
                      Les données brutes (clics, sessions, positions) sont importées via OAuth ou API token sécurisé.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3 text-green-500">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold mb-2">Anonymisation</h3>
                    <p className="text-xs text-muted-foreground">
                      Les données brutes restent confinées. Seules des métriques agrégées et anonymisées alimentent les modèles IA.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-violet-500/20 bg-violet-500/5">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3 text-violet-500">
                      <Brain className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold mb-2">Recommandations IA</h3>
                    <p className="text-xs text-muted-foreground">
                      Prédictions de trafic, estimations de ROI, détection d'anomalies et recommandations personnalisées.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="hero" size="lg">
                  <Link to="/app/console">
                    Connecter mes APIs
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/data-flow-diagram">
                    Voir le diagramme de flux
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* What we DON'T do */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <h2 className="text-2xl font-bold mb-6 text-center">Ce que nous ne faisons <span className="text-destructive">jamais</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  'Revendre vos données à des tiers',
                  'Stocker les tokens OAuth après déconnexion',
                  'Partager des données brutes avec les LLMs',
                  'Collecter des données personnelles de vos visiteurs',
                  'Conserver des données après suppression de compte',
                  'Utiliser vos données pour entraîner des modèles',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
