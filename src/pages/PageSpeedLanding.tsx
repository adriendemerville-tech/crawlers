import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
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

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const PageSpeedLanding = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/pagespeed');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Test PageSpeed & Core Web Vitals — Analysez la performance de votre site",
        "description": "Testez la vitesse de votre site avec notre outil PageSpeed. Analysez les Core Web Vitals (LCP, FID, CLS), obtenez des recommandations d'optimisation et améliorez votre score Google.",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": "2026-04-08",
        "dateModified": "2026-04-08",
        "url": "https://crawlers.fr/pagespeed",
        "mainEntityOfPage": "https://crawlers.fr/pagespeed"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "PageSpeed", "item": "https://crawlers.fr/pagespeed" }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Qu'est-ce que les Core Web Vitals ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Les Core Web Vitals sont 3 métriques Google qui mesurent l'expérience utilisateur : LCP (Largest Contentful Paint) pour la vitesse de chargement, INP (Interaction to Next Paint) pour la réactivité, et CLS (Cumulative Layout Shift) pour la stabilité visuelle." }
          },
          {
            "@type": "Question",
            "name": "Comment améliorer son score PageSpeed ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Optimisez les images (WebP, lazy loading), réduisez le JavaScript bloquant, activez la compression Gzip/Brotli, utilisez un CDN, minimisez le CSS critique et préchargez les ressources clés." }
          },
          {
            "@type": "Question",
            "name": "Le PageSpeed affecte-t-il le SEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Oui, les Core Web Vitals sont un facteur de classement officiel de Google depuis 2021. Un site lent perd des positions dans les résultats de recherche, surtout sur mobile." }
          }
        ]
      }
    ]
  };

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
      <Helmet>
        <title>Test PageSpeed & Core Web Vitals — Analysez la vitesse de votre site | Crawlers</title>
        <meta name="description" content="Testez gratuitement la vitesse de votre site. Analysez LCP, INP, CLS et les Core Web Vitals. Obtenez des recommandations d'optimisation pour améliorer votre score Google PageSpeed." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://crawlers.fr/pagespeed" />
        <meta property="og:title" content="Test PageSpeed & Core Web Vitals — Performance de votre site" />
        <meta property="og:description" content="Analysez gratuitement les Core Web Vitals de votre site et obtenez des recommandations d'optimisation." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/pagespeed" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

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
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default PageSpeedLanding;
