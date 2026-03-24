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
  Layers, Search, Eye, CheckCircle, ChevronRight
} from 'lucide-react';

/** Gold Crawlers logo for branding */
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
              Le Stratège connaît votre site. Il analyse votre cocon sémantique, prescrit des actions concrètes 
              — maillage, contenus, arborescence — et conserve une mémoire de toutes vos conversations 
              pour affiner ses recommandations au fil du temps.
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

        {/* ─── Features Grid ─── */}
        <section className="py-16 sm:py-24">
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

        {/* ─── How it works ─── */}
        <section className="py-16 sm:py-24 bg-muted/30 border-y border-border">
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
        <section className="py-16 sm:py-24">
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
        <section className="py-16 sm:py-24 border-t border-border">
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
