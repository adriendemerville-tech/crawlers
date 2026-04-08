import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Globe, Brain, Search, Target, Zap,
  BarChart3, CheckCircle2, TrendingUp, FileText, Shield, Eye
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const ScoreGEO = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/score-geo');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Score GEO — Mesurez votre optimisation pour les moteurs de recherche génératifs",
        "description": "Le Score GEO évalue la capacité de votre site à être cité par ChatGPT, Claude, Perplexity et Google SGE. Obtenez votre score et améliorez votre visibilité IA.",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": "2026-04-08",
        "dateModified": "2026-04-08",
        "url": "https://crawlers.fr/score-geo",
        "mainEntityOfPage": "https://crawlers.fr/score-geo"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Score GEO", "item": "https://crawlers.fr/score-geo" }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Qu'est-ce que le Score GEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Le Score GEO (Generative Engine Optimization) mesure la probabilité que votre contenu soit cité dans les réponses des moteurs IA comme ChatGPT, Claude ou Perplexity. Il évalue la structure, les données, la citabilité et l'autorité de votre page." }
          },
          {
            "@type": "Question",
            "name": "Comment améliorer son Score GEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Pour améliorer votre Score GEO : structurez vos contenus avec des titres clairs, ajoutez des données structurées Schema.org, citez vos sources, créez des réponses directes aux questions courantes, et assurez-vous que les bots IA peuvent accéder à votre site." }
          },
          {
            "@type": "Question",
            "name": "Le Score GEO remplace-t-il le SEO classique ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Non, le GEO complète le SEO. Le SEO optimise pour les résultats classiques de Google, tandis que le GEO optimise pour les réponses génératives. Les deux sont complémentaires et partagent des fondamentaux communs (contenu de qualité, structure, autorité)." }
          }
        ]
      }
    ]
  };

  const pillars = [
    { icon: FileText, title: 'Structure & Lisibilité', desc: 'Hiérarchie des titres, paragraphes concis, listes, réponses directes aux questions', score: 'Poids : 25%' },
    { icon: Brain, title: 'Données structurées', desc: 'Schema.org, JSON-LD, FAQ, HowTo, Article — les signaux exploités par les LLM', score: 'Poids : 20%' },
    { icon: Shield, title: 'Accessibilité IA', desc: 'robots.txt, headers, meta robots — les bots IA peuvent-ils crawler votre contenu ?', score: 'Poids : 20%' },
    { icon: Target, title: 'Citabilité', desc: 'Phrases courtes et factuelles, statistiques sourcées, définitions claires', score: 'Poids : 20%' },
    { icon: TrendingUp, title: 'Autorité & E-E-A-T', desc: 'Backlinks, mentions, auteur identifié, expertise démontrée', score: 'Poids : 15%' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Score GEO — Mesurez votre visibilité IA (ChatGPT, Claude, Perplexity) | Crawlers</title>
        <meta name="description" content="Obtenez votre Score GEO gratuit et mesurez la capacité de votre site à être cité par les moteurs de recherche génératifs. Optimisez votre visibilité IA en 2026." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://crawlers.fr/score-geo" />
        <meta property="og:title" content="Score GEO — Mesurez votre visibilité dans les réponses IA" />
        <meta property="og:description" content="Votre site est-il optimisé pour ChatGPT, Claude et Perplexity ? Obtenez votre Score GEO gratuit." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/score-geo" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main>
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-background to-primary/5" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">
              <Globe className="h-3 w-3 mr-1" /> Score GEO
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Mesurez votre <span className="text-primary">visibilité IA</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Le <strong>Score GEO</strong> évalue la probabilité que votre contenu soit cité par <strong>ChatGPT, Claude, Perplexity</strong> et Google SGE. 
              Un score faible signifie que les IA vous ignorent — même si votre SEO classique est bon.
            </p>
            <Button asChild size="lg" className="text-base px-8">
              <Link to="/audit-expert">
                Obtenir mon Score GEO <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* What is GEO */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-3xl font-bold text-center mb-6">Qu'est-ce que le Score GEO ?</h2>
            <div className="prose prose-lg max-w-none text-muted-foreground">
              <p>
                Le <strong>GEO (Generative Engine Optimization)</strong> est l'équivalent du SEO pour les moteurs de recherche IA. 
                Quand un utilisateur pose une question à ChatGPT ou Perplexity, ces moteurs parcourent le web, synthétisent les meilleures sources 
                et génèrent une réponse. Votre objectif : <strong>être la source citée</strong>.
              </p>
              <p>
                Le Score GEO de Crawlers analyse 5 piliers fondamentaux et attribue une note de 0 à 100. 
                Un score supérieur à 70 indique une bonne optimisation. En dessous de 40, votre contenu est probablement invisible pour les IA.
              </p>
            </div>
          </div>
        </section>

        {/* 5 Pillars */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Les 5 piliers du Score GEO</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Chaque pilier contribue au score final et identifie les axes d'amélioration prioritaires.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pillars.map(p => (
                <Card key={p.title} className="border-border/50">
                  <CardContent className="p-6">
                    <p.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">{p.title}</h3>
                    <p className="text-xs text-primary/70 mb-2">{p.score}</p>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </CardContent>
                </Card>
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
                <h3 className="font-semibold text-foreground mb-2">Qu'est-ce que le Score GEO ?</h3>
                <p className="text-muted-foreground text-sm">Le Score GEO mesure la probabilité que votre contenu soit cité dans les réponses des moteurs IA comme ChatGPT, Claude ou Perplexity. Il évalue la structure, les données, la citabilité et l'autorité de votre page.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Comment améliorer son Score GEO ?</h3>
                <p className="text-muted-foreground text-sm">Structurez vos contenus avec des titres clairs, ajoutez des données structurées Schema.org, citez vos sources, créez des réponses directes aux questions, et assurez-vous que les bots IA accèdent à votre site.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Le Score GEO remplace-t-il le SEO classique ?</h3>
                <p className="text-muted-foreground text-sm">Non, le GEO complète le SEO. Le SEO optimise pour les résultats classiques, le GEO pour les réponses génératives. Les deux sont complémentaires.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-primary/5">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Obtenez votre Score GEO maintenant</h2>
            <p className="text-muted-foreground mb-8">
              Audit complet en moins de 30 secondes. Découvrez votre score et recevez des recommandations concrètes pour booster votre visibilité IA.
            </p>
            <Button asChild size="lg" className="text-base px-10">
              <Link to="/audit-expert">
                Lancer l'audit GEO <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default ScoreGEO;
