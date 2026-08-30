import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { PageEditorial } from '@/components/seo/PageEditorial';
import { Link } from '@/lib/router-compat';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeadMagnetAudit } from '@/components/LeadMagnetAudit';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Gauge, Zap, Clock, Eye, Smartphone,
  BarChart3, CheckCircle2, TrendingUp, Monitor, Server, Image
} from 'lucide-react';
import { ClusterMesh } from '@/components/seo/ClusterMesh';
import { DirectAnswer } from '@/components/seo/DirectAnswer';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const PageSpeedLanding = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/pagespeed');


  const metrics = [
    { icon: Eye, title: 'LCP', full: 'Largest Contentful Paint', desc: 'Temps de chargement du plus grand élément visible. Objectif : < 2.5s', color: 'text-green-500' },
    { icon: Zap, title: 'INP', full: 'Interaction to Next Paint', desc: 'Réactivité aux interactions utilisateur. Objectif : < 200ms', color: 'text-yellow-500' },
    { icon: Monitor, title: 'CLS', full: 'Cumulative Layout Shift', desc: 'Stabilité visuelle de la page. Objectif : < 0.1', color: 'text-blue-500' },
    { icon: Clock, title: 'TTFB', full: 'Time to First Byte', desc: 'Temps de réponse du serveur. Objectif : < 800ms', color: 'text-purple-500' },
    { icon: Server, title: 'FCP', full: 'First Contentful Paint', desc: 'Premier rendu de contenu visible. Objectif : < 1.8s', color: 'text-orange-500' },
    { icon: Image, title: 'SI', full: 'Speed Index', desc: 'Vitesse de remplissage visuel de la page. Objectif : < 3.4s', color: 'text-pink-500' },
  ];

  const optimizations = [
    'Compression images WebP/AVIF automatique',
    'Lazy loading des images et iframes',
    'Minification CSS/JS et tree-shaking',
    'Préchargement des ressources critiques',
    'CDN et mise en cache navigateur',
    'Réduction du JavaScript bloquant',
  ];

  return (
    <div className="min-h-screen bg-background">

      <Header />

      <main>
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-background to-primary/5" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">
              <Gauge className="h-3 w-3 mr-1" /> Performance
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Votre site est-il <span className="text-primary">assez rapide</span> ?
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              <strong>53% des visiteurs mobiles</strong> quittent un site qui met plus de 3 secondes à charger. 
              Testez vos <strong>Core Web Vitals</strong> et obtenez un plan d'action pour accélérer votre site.
            </p>
            <DirectAnswer
              className="mb-8"
              question="Quelle vitesse de chargement viser en 2026 et comment tester ses Core Web Vitals ?"
              answer={<>Une page doit s'afficher en moins de 2,5 secondes sur mobile : au-delà de 3 secondes, plus de la moitié des visiteurs abandonnent. Les trois Core Web Vitals à surveiller sont le LCP (≤ 2,5 s), l'INP (≤ 200 ms) et le CLS (≤ 0,1), mesurés sur mobile en priorité. Le test Crawlers.fr les relève sur votre URL et renvoie un plan d'action ordonné par gain réel.</>}
              facts={[
                { label: 'Quoi', value: 'LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1' },
                { label: 'Où', value: 'Mesure mobile et desktop sur l\'URL de votre choix' },
                { label: 'Pourquoi', value: '53 % des visiteurs mobiles quittent au-delà de 3 secondes' },
                { label: 'Combien', value: 'Test gratuit, sans inscription' },
              ]}
            />
            <LeadMagnetAudit
              type="pagespeed"
              placeholder="https://votre-site.com"
              ctaLabel="Tester la vitesse"
            />
          </div>
        </section>

        {/* Metrics */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Les métriques que nous analysons</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Chaque métrique mesure un aspect critique de l'expérience utilisateur et impacte directement votre SEO.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {metrics.map(m => (
                <Card key={m.title} className="border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <m.icon className={`h-6 w-6 ${m.color}`} />
                      <h3 className="font-bold text-foreground text-lg">{m.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{m.full}</p>
                    <p className="text-sm text-muted-foreground">{m.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Optimizations */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Recommandations automatiques</h2>
            <p className="text-muted-foreground text-center mb-12">
              Notre audit génère des recommandations concrètes et prioritaires pour chaque problème détecté.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {optimizations.map(o => (
                <div key={o} className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border/50">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm text-foreground">{o}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Qu'est-ce que les Core Web Vitals ?</h3>
                <p className="text-muted-foreground text-sm">Les Core Web Vitals sont 3 métriques Google qui mesurent l'expérience utilisateur : LCP pour la vitesse de chargement, INP pour la réactivité, et CLS pour la stabilité visuelle.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Comment améliorer son score PageSpeed ?</h3>
                <p className="text-muted-foreground text-sm">Optimisez les images (WebP, lazy loading), réduisez le JavaScript bloquant, activez la compression Gzip/Brotli, utilisez un CDN, minimisez le CSS critique et préchargez les ressources clés.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Le PageSpeed affecte-t-il le SEO ?</h3>
                <p className="text-muted-foreground text-sm">Oui, les Core Web Vitals sont un facteur de classement officiel de Google depuis 2021. Un site lent perd des positions dans les résultats de recherche, surtout sur mobile.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-primary/5">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Testez la vitesse de votre site</h2>
            <p className="text-muted-foreground mb-8">
              Analyse complète des Core Web Vitals avec un rapport détaillé et des recommandations d'optimisation prioritaires.
            </p>
            <Button asChild size="lg" className="text-base px-10">
              <Link to="/audit-expert">
                Lancer le test PageSpeed <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      
      <ClusterMesh
        currentPath="/pagespeed"
        currentLabel="PageSpeed"
        pillar={{"href":"/audit-seo-gratuit","label":"Audit SEO gratuit","description":"Pilier : 200 points techniques + GEO en 60 secondes."}}
        sisters={[{"href":"/audit-expert","label":"Audit expert","description":"168 critères + plan d'action correctif."},{"href":"/audit-semantique","label":"Audit sémantique","description":"Densité lexicale, entités, lacunes."},{"href":"/eeat","label":"E-E-A-T","description":"Signaux d'expertise & autorité."},{"href":"/guide-audit-seo","label":"Guide audit SEO","description":"Méthodologie pas à pas."}]}
      />
        <PageEditorial
          heading="Lire ses Core Web Vitals sans se tromper"
          intro="Un score de performance n'a de valeur que rapporté à ce que vivent les visiteurs. Cette page explique ce que mesure chaque métrique, la différence entre données de laboratoire et données réelles, et l'ordre dans lequel corriger."
          citable="Les Core Web Vitals retenus par Google sont le LCP (affichage du plus grand élément, cible sous 2,5 s), l'INP (réactivité aux interactions, cible sous 200 ms) et le CLS (stabilité visuelle, cible sous 0,1). Ils sont évalués au 75e centile des visites réelles, sur mobile en priorité."
          sections={[
            {
              title: 'Laboratoire et terrain ne racontent pas la même histoire',
              paragraphs: [
                "Un test synthétique exécute la page une fois, depuis un lieu et un réseau donnés : il sert à diagnostiquer. Les données de terrain agrègent les visites réelles sur 28 jours : ce sont elles qui comptent pour le classement.",
                "Un écart important entre les deux signale presque toujours une population d'appareils plus lente que le banc de test, ou un chemin de rendu qui dépend du réseau du visiteur.",
              ],
            },
            {
              title: 'Ordre de correction efficace',
              paragraphs: [
                "Corriger dans le bon ordre évite de retoucher dix fois la même page : on traite d'abord ce qui bloque l'affichage, ensuite ce qui bloque l'interaction, enfin ce qui déplace la mise en page.",
              ],
              bullets: [
                "LCP : identifier l'élément concerné, le précharger, lui donner des dimensions explicites, servir un format moderne.",
                "INP : réduire le JavaScript exécuté au chargement, différer ce qui n'est pas nécessaire au premier écran.",
                "CLS : réserver la hauteur des blocs qui se montent après hydratation, polices en font-display swap.",
                "TTFB : mise en cache, rendu côté serveur, proximité géographique de la réponse.",
              ],
            },
            {
              title: 'Performance et visibilité IA',
              paragraphs: [
                "La vitesse n'est pas un critère de citation pour un moteur génératif, mais elle en conditionne l'accès : un crawler qui rencontre des réponses lentes ou des délais d'attente explore moins de pages, donc en cite moins.",
              ],
            },
          ]}
        />
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default PageSpeedLanding;
