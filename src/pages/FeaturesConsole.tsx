import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import {
  LayoutDashboard, Search, Sparkles, CheckSquare, Code2, Bug, FileEdit,
  Target, Globe, Store, Anchor, FileBox, Wallet, Crown, Settings, Shield,
  Network, Radio, ChevronRight, MonitorSmartphone, Layers, Eye,
} from 'lucide-react';
import consolePreview from '@/assets/console-preview.webp';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const modules = [
  { icon: Search, name: 'SEO', desc: 'Suivi des positions, audits techniques, opportunités de mots-clés et optimisations on-page.' },
  { icon: Sparkles, name: 'GEO', desc: 'Visibilité dans les LLM (ChatGPT, Gemini, Perplexity), profondeur LLM, benchmark et analyse des logs bots IA.' },
  { icon: CheckSquare, name: 'Plans d\'Action', desc: 'Tâches priorisées issues des audits, suivi de l\'avancement par site.' },
  { icon: Code2, name: '<Scripts>', desc: 'Codes correctifs prêts à déployer (canonicals, schema, redirects, meta).' },
  { icon: Bug, name: 'Crawls', desc: 'Crawl technique : erreurs, redirections, profondeur, pages orphelines.' },
  { icon: FileEdit, name: 'Content', desc: 'Pipeline éditorial 4-étages avec briefing, stratège, rédacteur et tonalisateur.' },
  { icon: Target, name: 'SEA → SEO', desc: 'Identification des synergies entre campagnes payantes et référencement organique.' },
  { icon: Globe, name: 'Indexation', desc: 'Monitoring de l\'indexation Google, comparaison SERP entre 4 providers.' },
  { icon: Store, name: 'GMB', desc: 'Audit Google Business 100 points, réponses IA aux avis, stats et concurrence locale.' },
  { icon: Anchor, name: 'Marina', desc: 'Audit B2B de prospection, scoring concurrentiel, rapports partageables.' },
  { icon: FileBox, name: 'Rapports', desc: 'Bibliothèque centralisée de tous vos audits, partageables en marque blanche.' },
  { icon: Wallet, name: 'Portefeuille', desc: 'Solde de crédits, recharges, historique de consommation.' },
];

const proModules = [
  { icon: Crown, name: 'Pro Agency / Pro Agency +', desc: 'Dashboard multi-clients, partage d\'équipe, rôles owner/editor/auditor.' },
  { icon: Settings, name: 'Paramètres', desc: 'Gestion du compte, langues, thème, intégrations Google et CMS.' },
  { icon: Shield, name: 'Créateur', desc: 'Console d\'administration réservée aux fondateurs et viewers privilégiés.' },
  { icon: Network, name: 'API', desc: 'Clé API personnelle pour brancher vos outils métier sur Crawlers.' },
];

export default function FeaturesConsole() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Ma Console — Crawlers.fr | Cockpit SEO & GEO unifié</title>
        <meta
          name="description"
          content="La Console Crawlers réunit SEO, GEO, plans d'action, scripts, crawls, content, GMB, indexation et reporting dans un cockpit unique. Découvrez son design et ses 16 modules."
        />
        <link rel="canonical" href="https://crawlers.fr/features/console" />
      </Helmet>

      <Header />

      <main className="container mx-auto px-4 py-16 sm:py-24 max-w-6xl">
        {/* Animated console preview */}
        <section className="mb-16 -mt-4">
          <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card/30 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none z-10" />
            <img
              src={consolePreview}
              alt="Aperçu animé de la console Crawlers : sidebar latérale, KPI, courbes de trafic et tableau de données"
              width={1600}
              height={1024}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-auto block console-preview-anim"
            />
          </div>
          <style>{`
            @keyframes consolePreviewPan {
              0%   { transform: scale(1.02) translate3d(0, 0, 0); }
              50%  { transform: scale(1.06) translate3d(-1.5%, -1%, 0); }
              100% { transform: scale(1.02) translate3d(0, 0, 0); }
            }
            .console-preview-anim {
              animation: consolePreviewPan 18s ease-in-out infinite;
              will-change: transform;
            }
            @media (prefers-reduced-motion: reduce) {
              .console-preview-anim { animation: none; }
            }
          `}</style>
        </section>

        {/* Hero */}
        <section className="text-center space-y-6 mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-card/40 text-xs uppercase tracking-widest text-muted-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Cockpit unifié
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight font-display">
            Ma Console
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Un seul écran pour piloter votre référencement traditionnel, votre visibilité IA,
            vos contenus, votre maillage et votre prospection — sans changer d'outil.
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <Link
              to="/app/console"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors text-sm font-medium"
            >
              Accéder à la console <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border text-foreground hover:bg-accent/40 transition-colors text-sm font-medium"
            >
              Voir toutes les fonctionnalités
            </Link>
          </div>
        </section>

        {/* Design philosophy */}
        <section className="grid md:grid-cols-3 gap-6 mb-20">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-3">
            <MonitorSmartphone className="h-6 w-6 text-foreground" />
            <h3 className="text-lg font-bold">Design épuré, dense en signal</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sidebar latérale fixe à gauche, contenu principal à droite. Typographie fine,
              icônes minimales, navigation à plat — pas de menus imbriqués.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-3">
            <Layers className="h-6 w-6 text-foreground" />
            <h3 className="text-lg font-bold">Sélecteur de site contextuel</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Un menu déroulant en haut de la sidebar contraint l'ensemble des modules
              au site choisi. Toutes les vues (SEO, GEO, Plans, Crawls, Content…) restent synchronisées.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-3">
            <Eye className="h-6 w-6 text-foreground" />
            <h3 className="text-lg font-bold">Adaptatif mobile</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sur mobile, la sidebar bascule en barre horizontale scrollable conservant
              les modules essentiels (SEO, GEO, GMB, Créateur).
            </p>
          </div>
        </section>

        {/* Scrolling banner */}
        <section className="mb-20 rounded-2xl border border-border/60 bg-card/30 p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <Radio className="h-6 w-6 text-foreground shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Bandeau d'alertes défilant</h2>
              <p className="text-muted-foreground leading-relaxed">
                En haut de chaque vue, un ticker temps réel agrège vos signaux Google Search Console,
                Google Analytics 4 et les anomalies détectées par notre moteur statistique (z-score).
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sources unifiées</h4>
              <ul className="text-sm space-y-1.5 text-foreground/90">
                <li>• Anomalies SEO (chutes de clics, impressions, positions)</li>
                <li>• Variations GA4 (sessions, conversions, revenus)</li>
                <li>• Actualités GSC (nouvelles requêtes, gains de position)</li>
                <li>• Événements stratégiques (mises à jour algorithmiques, saisonnalité)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contrôle utilisateur</h4>
              <ul className="text-sm space-y-1.5 text-foreground/90">
                <li>• Pause au survol pour lire un message</li>
                <li>• Masquage par défaut depuis les Paramètres</li>
                <li>• Réouverture en un clic via l'indicateur compact</li>
                <li>• Filtrage automatique par site sélectionné</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-3">12 modules métier, 4 modules transverses</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Chaque module est accessible depuis la sidebar et reste contraint au site sélectionné.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {modules.map(m => (
              <div key={m.name} className="rounded-xl border border-border/50 bg-card/30 p-5 hover:bg-card/50 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <m.icon className="h-4 w-4 text-foreground" />
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/20 p-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Modules transverses</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {proModules.map(m => (
                <div key={m.name} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <m.icon className="h-3.5 w-3.5 text-foreground" />
                    <h3 className="text-sm font-semibold">{m.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Utility */}
        <section className="mb-20 text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-bold">Pourquoi un cockpit unifié ?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le SEO classique, le GEO (visibilité IA), la production de contenu, le suivi technique
            et la prospection vivaient historiquement dans 5 outils distincts. La Console Crawlers
            les rassemble pour donner une lecture unique de votre performance et déclencher les
            actions correctives sans changer d'écran.
          </p>
        </section>

        {/* CTA */}
        <section className="text-center rounded-2xl border border-border/60 bg-card/40 p-10">
          <h2 className="text-2xl font-bold mb-3">Ouvrez votre console</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Connectez vos sites, vos services Google et commencez à piloter votre visibilité.
          </p>
          <Link
            to="/app/console"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors text-sm font-medium"
          >
            Lancer la console <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <Suspense fallback={<div className="h-48 bg-muted/10" />}>
        <Footer />
      </Suspense>
    </div>
  );
}
