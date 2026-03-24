import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Network, ArrowRight, Crown, Brain, Compass, Target,
  BarChart3, Shield, Zap, MessageSquare, GitBranch,
  Layers, Search, Eye, CheckCircle, ChevronRight,
  TrendingUp, Globe, FileText, ShoppingCart, Building2, Newspaper
} from 'lucide-react';

/* ─── Gold Logo ─── */
function GoldCrawlersLogo({ size = 64 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size}>
      <defs>
        <linearGradient id="goldGradLP" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#f5c842' }} />
          <stop offset="50%" style={{ stopColor: '#d4a853' }} />
          <stop offset="100%" style={{ stopColor: '#b8860b' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#goldGradLP)" />
      <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </g>
    </svg>
  );
}

const Header = lazy(() => import('@/components/Header').then(m => ({ default: m.Header })));
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/* ─── Data ─── */

const features = [
  {
    icon: Compass,
    title: 'Diagnostic du maillage interne',
    desc: 'Détecte les pages orphelines, les profondeurs excessives et les opportunités de maillage manquées via l\'analyse complète du graphe de votre site.',
  },
  {
    icon: Target,
    title: 'Prescriptions concrètes',
    desc: 'Reçoit des recommandations actionnables : créer du contenu, ajouter des liens, restructurer l\'arborescence. Chaque action est priorisée par impact SEO.',
  },
  {
    icon: Brain,
    title: 'Mémoire persistante',
    desc: 'Le Stratège mémorise vos conversations et vos décisions. Il s\'améliore avec le temps et affine ses recommandations à chaque session.',
  },
  {
    icon: BarChart3,
    title: 'Suivi d\'impact T+30 / T+60 / T+90',
    desc: 'Mesure l\'effet réel de chaque recommandation appliquée via Google Search Console et GA4. Vérifiez le ROI de chaque action.',
  },
  {
    icon: GitBranch,
    title: 'Visualisation 3D du cocon',
    desc: 'Explorez votre architecture sémantique en 3D : clusters thématiques, flux de liens ascendants et descendants, autorité par nœud.',
  },
  {
    icon: Shield,
    title: 'Détection de cannibalisation',
    desc: 'Identifie les pages qui se concurrencent sur les mêmes requêtes et propose des fusions ou des différenciations sémantiques.',
  },
];

const workflow = [
  { step: '01', title: 'Connectez votre site', desc: 'Ajoutez votre domaine dans l\'espace Console et lancez le premier crawl.' },
  { step: '02', title: 'Générez le graphe sémantique', desc: 'Le Stratège analyse la structure de liens, les clusters thématiques et la profondeur de chaque page.' },
  { step: '03', title: 'Dialoguez avec le Stratège', desc: 'Posez vos questions, demandez un diagnostic ou une prescription. Il connaît déjà votre site.' },
  { step: '04', title: 'Appliquez et mesurez', desc: 'Validez les recommandations, déployez et suivez l\'impact à T+30, T+60 et T+90.' },
];

const mathConcepts = [
  {
    title: 'Graphe orienté pondéré',
    formula: 'G = (V, E, w)',
    explanation: 'Votre site est modélisé comme un graphe orienté où chaque page est un nœud (V), chaque lien interne une arête (E), et chaque arête porte un poids (w) proportionnel à la pertinence sémantique du lien.',
    detail: 'La direction des arêtes distingue les liens descendant (page mère → page fille) des liens ascendant (page profonde → page stratégique), permettant d\'identifier les flux de "jus SEO".',
  },
  {
    title: 'Distribution d\'autorité',
    formula: 'A(p) = (1−d)/N + d × Σ A(q)/L(q)',
    explanation: 'Inspiré du PageRank, l\'algorithme calcule l\'autorité relative de chaque page en fonction du nombre et de la qualité des liens internes qu\'elle reçoit.',
    detail: 'Le facteur d\'amortissement (d ≈ 0.85) simule la probabilité qu\'un visiteur suive un lien plutôt que de naviguer vers une URL aléatoire. Les pages avec une forte autorité transmettent davantage de poids via leurs liens sortants.',
  },
  {
    title: 'Clustering thématique',
    formula: 'Sim(a,b) = cos(θ) = (A·B) / (‖A‖×‖B‖)',
    explanation: 'Les pages sont regroupées en clusters sémantiques via la similarité cosinus entre leurs vecteurs de contenu. Chaque cluster forme un "cocon" thématique cohérent.',
    detail: 'La proximité sémantique entre deux pages détermine si elles devraient être liées. Un cluster bien formé renforce la pertinence topique du site aux yeux des moteurs de recherche et des LLMs.',
  },
  {
    title: 'Détection des orphelins',
    formula: 'Orphelin(p) = { p ∈ V | deg⁻(p) = 0 }',
    explanation: 'Une page orpheline est un nœud sans aucun lien entrant interne. Elle est invisible pour les robots de crawl et ne reçoit aucune autorité du reste du site.',
    detail: 'Le Stratège identifie ces pages et propose des liens contextuels depuis les pages les plus pertinentes du même cluster, restaurant le flux d\'autorité et la découvrabilité.',
  },
  {
    title: 'Profondeur et accessibilité',
    formula: 'Prof(p) = min_path(racine, p)',
    explanation: 'La profondeur d\'une page est le nombre minimal de clics depuis la page d\'accueil. Au-delà de 3 niveaux, une page perd significativement en visibilité.',
    detail: 'Le Stratège mesure la profondeur de chaque nœud par BFS (parcours en largeur) et recommande la création de raccourcis internes pour les pages stratégiques enterrées trop profondément.',
  },
  {
    title: 'Score de cannibalisation',
    formula: 'Cann(a,b) = Sim(a,b) × Overlap(Qa, Qb)',
    explanation: 'Deux pages cannibalisent lorsqu\'elles ciblent les mêmes requêtes avec un contenu trop similaire, diluant leur potentiel de classement.',
    detail: 'Le score combine la similarité sémantique du contenu et le chevauchement des requêtes cibles. Au-delà d\'un seuil de 0.75, le Stratège propose une fusion ou une différenciation de l\'angle éditorial.',
  },
];

const useCases = [
  {
    icon: ShoppingCart,
    title: 'E-commerce',
    problem: '2 000 fiches produits, 80% orphelines',
    solution: 'Le Stratège détecte les fiches isolées, les rattache aux catégories parentes et crée des liens croisés vers les produits complémentaires.',
    result: '+34% de pages indexées en 60 jours',
  },
  {
    icon: Newspaper,
    title: 'Média / Blog éditorial',
    problem: '500 articles sans maillage thématique',
    solution: 'Clustering automatique par sujet, génération de pages piliers manquantes et maillage descendant structuré vers les articles de fond.',
    result: '+28% de trafic organique sur les clusters traités',
  },
  {
    icon: Building2,
    title: 'Site corporate B2B',
    problem: 'Pages services enterrées à 4+ clics de profondeur',
    solution: 'Réduction de la profondeur moyenne de 4.2 à 2.1 clics via des liens contextuels et une restructuration de l\'arborescence.',
    result: '+45% d\'impressions GSC sur les pages services',
  },
  {
    icon: Globe,
    title: 'Site multilingue',
    problem: 'Cannibalisation entre versions linguistiques',
    solution: 'Détection des pages en compétition inter-langues, correction des hreflang manquants et différenciation du contenu localisé.',
    result: 'Résolution de 90% des conflits hreflang détectés',
  },
];

export default function StrategeCocoon() {
  const { language } = useLanguage();

  return (
    <>
      <Helmet>
        <title>Stratège Cocoon — Consultant IA SEO Senior | Crawlers.fr</title>
        <meta name="description" content="Stratège Cocoon est un consultant IA senior qui analyse votre cocon sémantique, prescrit des actions concrètes et mesure l'impact réel sur votre SEO. Réservé aux abonnés Pro Agency." />
        <link rel="canonical" href="https://crawlers.fr/stratege-cocoon" />
      </Helmet>

      <Suspense fallback={null}>
        <Header />
      </Suspense>

      <main className="min-h-screen">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 via-background to-violet-950/10 dark:from-amber-950/30 dark:via-background dark:to-violet-950/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(38_92%_50%/0.08),transparent_60%)]" />

          <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28 text-center">
            <div className="flex justify-center mb-6">
              <GoldCrawlersLogo size={72} />
            </div>

            <Badge className="mb-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs font-semibold px-3 py-1">
              <Crown className="w-3.5 h-3.5 mr-1.5" />
              Pro Agency
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground font-display mt-4">
              Stratège Cocoon
            </h1>
            <p className="mt-2 text-lg sm:text-xl text-amber-600 dark:text-amber-400 font-medium">
              Votre consultant IA SEO senior
            </p>
            <p className="mt-6 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Le Stratège analyse la topologie de votre site comme un graphe mathématique, identifie 
              les failles structurelles invisibles à l'œil nu et prescrit des actions concrètes 
              dont l'impact est mesuré automatiquement dans le temps.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app/cocoon">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20">
                  <Network className="h-5 w-5" />
                  Accéder au Stratège
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/tarifs">
                <Button variant="outline" size="lg" className="gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                  Voir les offres Pro Agency
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Qu'est-ce que le Cocon Sémantique ? ─── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center mb-10">
              <Badge variant="outline" className="mb-4 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                Le concept
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-display">
                Qu'est-ce que le Cocon Sémantique ?
              </h2>
            </div>

            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p>
                Le <strong className="text-foreground">cocon sémantique</strong> est une architecture de site 
                inventée par Laurent Bourrelly. L'idée : organiser vos pages en <strong className="text-foreground">clusters thématiques</strong> reliés 
                par des liens internes contextuels, formant une structure en arbre où chaque branche 
                traite un sujet en profondeur.
              </p>
              <p>
                Contrairement au maillage classique (menu, footer, sidebar), le cocon sémantique crée 
                des <strong className="text-foreground">chemins de navigation thématiques</strong> qui guident à la fois l'internaute 
                et les robots de crawl vers vos pages stratégiques. Résultat : une meilleure répartition 
                de l'autorité, une indexation plus rapide et un signal de pertinence topique plus fort.
              </p>
              <p>
                Le problème ? Sur un site de plus de 100 pages, construire et maintenir un cocon manuellement 
                est un travail titanesque. C'est là que le <strong className="text-foreground">Stratège Cocoon</strong> intervient : 
                il automatise l'analyse, la détection des failles et la prescription d'actions.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Features Grid ─── */}
        <section className="py-16 sm:py-24 bg-muted/30 border-y border-border">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-display">
                Un consultant, pas un simple chatbot
              </h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Le Stratège combine analyse de graphe, IA conversationnelle et mémoire persistante 
                pour vous accompagner comme un vrai consultant senior.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Card key={i} className="border-border/50 bg-card/80 backdrop-blur-sm hover:border-amber-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                      <f.icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Fonctionnement Mathématique ─── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                Sous le capot
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-display">
                Le moteur mathématique
              </h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Le Stratège repose sur des algorithmes de théorie des graphes et d'algèbre linéaire 
                pour modéliser, analyser et optimiser votre architecture de site.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {mathConcepts.map((c, i) => (
                <Card key={i} className="border-border/50 bg-card/80 backdrop-blur-sm group hover:border-amber-500/20 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 border border-amber-500/20 text-sm font-bold text-amber-600 dark:text-amber-400">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <h3 className="font-semibold text-foreground">{c.title}</h3>
                    </div>

                    {/* Formula */}
                    <div className="mb-3 px-3 py-2 rounded-md bg-muted/60 border border-border font-mono text-sm text-foreground/90 overflow-x-auto">
                      {c.formula}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed mb-2">{c.explanation}</p>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">{c.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Applications concrètes ─── */}
        <section className="py-16 sm:py-24 bg-muted/30 border-y border-border">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                Cas d'usage
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-display">
                Applications concrètes
              </h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Le Stratège s'adapte à tous les types de sites. Voici des scénarios réels 
                où l'analyse de graphe transforme la performance SEO.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {useCases.map((uc, i) => (
                <Card key={i} className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <uc.icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="font-semibold text-foreground">{uc.title}</h3>
                    </div>

                    <div className="px-6 py-4 space-y-3">
                      {/* Problem */}
                      <div>
                        <span className="text-xs font-medium text-destructive/80 uppercase tracking-wider">Problème</span>
                        <p className="text-sm text-muted-foreground mt-0.5">{uc.problem}</p>
                      </div>

                      {/* Solution */}
                      <div>
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Solution</span>
                        <p className="text-sm text-muted-foreground mt-0.5">{uc.solution}</p>
                      </div>

                      {/* Result */}
                      <div className="flex items-center gap-2 pt-1">
                        <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{uc.result}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-display">
                Comment ça fonctionne ?
              </h2>
            </div>

            <div className="space-y-8">
              {workflow.map((w, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/20">
                    {w.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{w.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Comparison: Félix vs Stratège ─── */}
        <section className="py-16 sm:py-24 bg-muted/30 border-y border-border">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-foreground font-display">
                Félix vs Stratège Cocoon
              </h2>
              <p className="mt-2 text-muted-foreground">
                Deux agents complémentaires pour deux missions différentes.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-4 font-medium text-muted-foreground" />
                    <th className="p-4 font-semibold text-foreground">
                      <span className="text-violet-600 dark:text-violet-400">Félix</span>
                    </th>
                    <th className="p-4 font-semibold text-foreground">
                      <span className="text-amber-600 dark:text-amber-400">Stratège Cocoon</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Rôle', felix: 'Comprendre', strat: 'Agir' },
                    { label: 'Contexte', felix: 'Écran visible', strat: 'Graphe complet du site' },
                    { label: 'Mémoire', felix: 'Session uniquement', strat: 'Persistante (cross-session)' },
                    { label: 'Recommandations', felix: 'Explication des scores', strat: 'Prescriptions actionnables' },
                    { label: 'Suivi d\'impact', felix: '—', strat: 'T+30 / T+60 / T+90' },
                    { label: 'Accès', felix: 'Tous les utilisateurs', strat: 'Pro Agency' },
                  ].map((row, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-4 font-medium text-muted-foreground">{row.label}</td>
                      <td className="p-4 text-center text-foreground/80">{row.felix}</td>
                      <td className="p-4 text-center text-foreground/80 flex items-center justify-center gap-1.5">
                        {row.strat}
                        {row.strat === 'Pro Agency' && <Crown className="h-3 w-3 text-amber-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── CTA Final ─── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <GoldCrawlersLogo size={56} />
            <h2 className="mt-6 text-3xl font-bold text-foreground font-display">
              Prêt à piloter votre SEO avec un consultant IA ?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Rejoignez Pro Agency et accédez au Stratège Cocoon, à la visualisation 3D de votre cocon 
              sémantique et au suivi d'impact automatisé.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app/cocoon">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20">
                  <Network className="h-5 w-5" />
                  Lancer le Stratège
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/tarifs">
                <Button variant="outline" size="lg" className="gap-2">
                  Voir les tarifs
                  <ChevronRight className="h-4 w-4" />
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
