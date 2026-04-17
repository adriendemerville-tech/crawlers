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
  ArrowRight, Brain, MessageSquare, Search, Target, Zap,
  BarChart3, CheckCircle2, TrendingUp, Eye, BookOpen, Globe,
  Sparkles, Network, AlertTriangle, Layers, Gauge, Award
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const VisibiliteLLM = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/visibilite-llm');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Visibilité LLM — Votre marque est-elle citée par ChatGPT, Claude et Perplexity ?",
        "description": "Analysez la citabilité de votre site par les LLM. Découvrez si ChatGPT, Claude et Perplexity mentionnent votre marque et comment améliorer votre visibilité dans les réponses IA.",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": "2026-04-08",
        "dateModified": "2026-04-08",
        "url": "https://crawlers.fr/visibilite-llm",
        "mainEntityOfPage": "https://crawlers.fr/visibilite-llm"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Visibilité LLM", "item": "https://crawlers.fr/visibilite-llm" }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Comment savoir si ChatGPT cite ma marque ?",
            "acceptedAnswer": { "@type": "Answer", "text": "L'outil Visibilité LLM de Crawlers interroge directement les principaux LLM avec des requêtes liées à votre secteur et analyse si votre marque, vos produits ou votre URL apparaissent dans les réponses générées." }
          },
          {
            "@type": "Question",
            "name": "Qu'est-ce que la citabilité LLM ?",
            "acceptedAnswer": { "@type": "Answer", "text": "La citabilité LLM mesure la capacité de votre contenu à être sélectionné et cité comme source par un modèle de langage. Elle dépend de la clarté factuelle, la structure, l'autorité du domaine et la présence de données structurées." }
          },
          {
            "@type": "Question",
            "name": "Pourquoi ma marque n'apparaît-elle pas dans les réponses IA ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Plusieurs raisons possibles : robots.txt bloquant les crawlers IA, contenu peu structuré, absence de données factuelles, faible autorité du domaine, ou concurrents mieux optimisés pour le GEO." }
          }
        ]
      }
    ]
  };

  const analyses = [
    { icon: MessageSquare, title: 'Citation directe', desc: 'Votre marque est-elle nommée dans les réponses IA ?' },
    { icon: Globe, title: 'Référencement URL', desc: 'Vos pages sont-elles citées comme source par les LLM ?' },
    { icon: Target, title: 'Positionnement sectoriel', desc: 'Comment vous situez-vous vs vos concurrents dans les réponses IA ?' },
    { icon: BookOpen, title: 'Couverture thématique', desc: 'Sur quels sujets les IA vous mentionnent-elles ?' },
    { icon: TrendingUp, title: 'Tendance de visibilité', desc: 'Votre citabilité s\'améliore-t-elle ou se dégrade-t-elle ?' },
    { icon: BarChart3, title: 'Score de confiance', desc: 'Quel niveau de confiance les LLM accordent-ils à votre contenu ?' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Visibilité LLM — Votre marque est-elle citée par ChatGPT et Claude ? | Crawlers</title>
        <meta name="description" content="Analysez si ChatGPT, Claude et Perplexity citent votre marque. Mesurez votre citabilité LLM et améliorez votre présence dans les réponses IA en 2026." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://crawlers.fr/visibilite-llm" />
        <meta property="og:title" content="Visibilité LLM — Votre marque est-elle citée par les IA ?" />
        <meta property="og:description" content="Découvrez si ChatGPT, Claude et Perplexity mentionnent votre marque. Audit de citabilité LLM gratuit." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/visibilite-llm" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main>
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-background to-primary/5" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">
              <Brain className="h-3 w-3 mr-1" /> Citabilité IA
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6 lg:text-5xl">
              Les IA parlent-elles de <span className="text-primary">votre marque</span> ?
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Quand un utilisateur demande « quel est le meilleur outil pour [votre secteur] ? » à ChatGPT, 
              <strong> êtes-vous dans la réponse</strong> ? L'analyse de Visibilité LLM vous donne la réponse — et les clés pour y apparaître.
            </p>
            <LeadMagnetAudit
              type="llm"
              placeholder="https://votre-site.com"
              ctaLabel="Analyser ma visibilité LLM"
            />
          </div>
        </section>

        {/* Why it matters */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-3xl font-bold text-center mb-6">Pourquoi la visibilité LLM est critique en 2026</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              {[
                { value: '1.8 Md', label: 'Utilisateurs mensuels de ChatGPT', icon: MessageSquare },
                { value: '57%', label: 'Des recherches passent par un LLM', icon: Search },
                { value: '0 clic', label: 'La réponse IA remplace le clic vers votre site', icon: Eye },
              ].map(s => (
                <Card key={s.label} className="text-center border-border/50">
                  <CardContent className="p-6">
                    <s.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                    <div className="text-2xl font-bold text-foreground">{s.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* What we analyze */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Ce que nous analysons</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Notre outil interroge les principaux LLM et analyse en profondeur votre présence dans les réponses génératives.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyses.map(a => (
                <Card key={a.title} className="border-border/50">
                  <CardContent className="p-6">
                    <a.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">{a.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 7 KPIs GEO (Sprint 1) */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                <Sparkles className="h-3 w-3 mr-1" /> Nouveau — Tracking GEO Sprint 1
              </Badge>
              <h2 className="text-3xl font-bold mb-4">Les 7 KPIs GEO qui pilotent votre citabilité</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Au-delà du « est-ce que je suis cité ? », nous mesurons les signaux structurels qui déterminent 
                <strong> pourquoi</strong> les LLM choisissent vos contenus comme source.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Award, title: 'Quality Score GEO', desc: 'Note composite de citabilité : clarté factuelle, structure, autorité, fraîcheur.' },
                { icon: Network, title: 'Fan-Out Clusters', desc: 'Détection des décompositions RAG par les LLM — sur quelles sous-questions vous êtes (ou non) couvert.' },
                { icon: AlertTriangle, title: 'Drop Detector', desc: 'Alertes en temps réel si votre citabilité chute sur un cluster ou un moteur IA.' },
                { icon: Layers, title: 'Bot Mix', desc: 'Répartition des crawls par moteur (GPTBot vs ClaudeBot vs PerplexityBot) pour anticiper où vous serez cité.' },
                { icon: Gauge, title: 'Velocity Score', desc: 'Vitesse à laquelle un nouveau contenu est crawlé puis cité par les LLM.' },
                { icon: TrendingUp, title: 'Cluster Maturity', desc: 'Maturité de vos cocons sémantiques (% d\'URLs déployées vs prévues) qui conditionne la couverture LLM.' },
              ].map(k => (
                <Card key={k.title} className="border-border/50">
                  <CardContent className="p-6">
                    <k.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{k.title}</h3>
                    <p className="text-sm text-muted-foreground">{k.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>
                Vous voulez savoir <em>comment</em> les humains arrivent depuis ces citations IA ?{' '}
                <Link to="/analyse-bots-ia" className="text-primary hover:underline font-medium">
                  Voir le tracking Bot ↔ Humain →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Comment savoir si ChatGPT cite ma marque ?</h3>
                <p className="text-muted-foreground text-sm">L'outil Visibilité LLM de Crawlers interroge directement les principaux LLM avec des requêtes liées à votre secteur et analyse si votre marque, vos produits ou votre URL apparaissent dans les réponses générées.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Qu'est-ce que la citabilité LLM ?</h3>
                <p className="text-muted-foreground text-sm">La citabilité LLM mesure la capacité de votre contenu à être sélectionné et cité comme source par un modèle de langage. Elle dépend de la clarté factuelle, la structure, l'autorité du domaine et la présence de données structurées.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Pourquoi ma marque n'apparaît-elle pas dans les réponses IA ?</h3>
                <p className="text-muted-foreground text-sm">Plusieurs raisons possibles : robots.txt bloquant les crawlers IA, contenu peu structuré, absence de données factuelles, faible autorité du domaine, ou concurrents mieux optimisés pour le GEO.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-primary/5">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Découvrez votre visibilité LLM</h2>
            <p className="text-muted-foreground mb-8">
              Audit complet de votre citabilité par les IA avec recommandations pour augmenter votre présence dans les réponses génératives.
            </p>
            <Button asChild size="lg" className="text-base px-10">
              <Link to="/audit-expert">
                Lancer l'analyse LLM <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default VisibiliteLLM;
