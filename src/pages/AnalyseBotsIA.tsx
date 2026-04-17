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
  ArrowRight, Bot, Shield, CheckCircle2, Search, AlertTriangle,
  Eye, FileText, Zap, Globe, Brain, Target, BarChart3,
  Users, GitBranch, Fingerprint, Activity, Clock, TrendingUp
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const AnalyseBotsIA = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/analyse-bots-ia');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Analyse des Bots IA — Vérifiez l'accès de ChatGPT, Claude et Perplexity à votre site",
        "description": "Votre robots.txt bloque-t-il les crawlers IA ? Analysez gratuitement l'accessibilité de votre site aux bots IA (GPTBot, ClaudeBot, PerplexityBot) et optimisez votre visibilité GEO.",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": "2026-04-08",
        "dateModified": "2026-04-08",
        "url": "https://crawlers.fr/analyse-bots-ia",
        "mainEntityOfPage": "https://crawlers.fr/analyse-bots-ia"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Analyse Bots IA", "item": "https://crawlers.fr/analyse-bots-ia" }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Comment savoir si mon site bloque les bots IA ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Utilisez l'outil Crawlers pour analyser votre robots.txt et vérifier les règles Disallow ciblant GPTBot, ClaudeBot, PerplexityBot et les autres crawlers IA." }
          },
          {
            "@type": "Question",
            "name": "Quels sont les principaux bots IA qui crawlent les sites web ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Les principaux bots IA sont GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, Google-Extended, Amazonbot, AppleBot-Extended, Bytespider (ByteDance), et CCBot (Common Crawl)." }
          },
          {
            "@type": "Question",
            "name": "Bloquer les bots IA affecte-t-il mon SEO classique ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Non, bloquer les bots IA dans robots.txt n'affecte pas Googlebot ni votre SEO classique. Mais cela réduit votre visibilité dans les réponses génératives (ChatGPT, Claude, Perplexity)." }
          }
        ]
      }
    ]
  };

  const bots = [
    { name: 'GPTBot', org: 'OpenAI', desc: 'Crawle pour entraîner et alimenter ChatGPT' },
    { name: 'ClaudeBot', org: 'Anthropic', desc: 'Collecte des données pour Claude AI' },
    { name: 'PerplexityBot', org: 'Perplexity', desc: 'Indexe le web pour les réponses Perplexity' },
    { name: 'Google-Extended', org: 'Google', desc: 'Alimente Gemini et Google SGE' },
    { name: 'Amazonbot', org: 'Amazon', desc: 'Crawle pour Alexa et Amazon Q' },
    { name: 'Bytespider', org: 'ByteDance', desc: 'Collecte des données pour TikTok et Doubao' },
  ];

  const checkpoints = [
    { icon: Shield, title: 'Robots.txt', desc: 'Vérification des règles Disallow pour chaque bot IA' },
    { icon: Eye, title: 'Headers HTTP', desc: 'Analyse des headers X-Robots-Tag ciblant les crawlers IA' },
    { icon: FileText, title: 'Meta robots', desc: 'Détection des balises noindex/nofollow spécifiques aux bots IA' },
    { icon: Globe, title: 'Sitemap XML', desc: 'Accessibilité du sitemap par les crawlers génératifs' },
    { icon: Brain, title: 'Données structurées', desc: 'Présence de Schema.org exploitable par les LLM' },
    { icon: Zap, title: 'Temps de réponse', desc: 'Latence serveur et capacité à servir les bots rapidement' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Analyse Bots IA — Votre site est-il visible par ChatGPT, Claude, Perplexity ? | Crawlers</title>
        <meta name="description" content="Vérifiez gratuitement si votre robots.txt bloque les crawlers IA. Analysez l'accès de GPTBot, ClaudeBot, PerplexityBot à votre site et optimisez votre visibilité GEO en 2026." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://crawlers.fr/analyse-bots-ia" />
        <meta property="og:title" content="Analyse Bots IA — Votre site bloque-t-il les crawlers IA ?" />
        <meta property="og:description" content="Vérifiez si GPTBot, ClaudeBot, PerplexityBot peuvent accéder à votre site. Audit gratuit robots.txt pour l'IA." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/analyse-bots-ia" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main>
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">
              <Bot className="h-3 w-3 mr-1" /> Analyse gratuite
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Votre site est-il <span className="text-primary">visible par les IA</span> ?
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              En 2026, <strong>40% du trafic web</strong> passe par les moteurs génératifs. Si votre <code>robots.txt</code> bloque GPTBot ou ClaudeBot, 
              vous êtes <strong>invisible</strong> pour ChatGPT, Claude et Perplexity. Vérifiez maintenant.
            </p>
            <LeadMagnetAudit
              type="robots"
              placeholder="https://votre-site.com"
              ctaLabel="Analyser l'accès bots IA"
            />
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 border-y border-border bg-muted/30">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: '60+', label: 'Bots IA détectés' },
                { value: '< 30s', label: 'Analyse complète' },
                { value: '92%', label: 'Sites ont des blocages' },
                { value: '100%', label: 'Gratuit' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-3xl font-bold text-primary">{s.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bots list */}
        <section id="bots" className="py-16 md:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Les crawlers IA qui visitent votre site</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Chaque moteur d'IA envoie ses propres robots. Bloquer l'un ne bloque pas les autres. 
              Voici les principaux bots à surveiller.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bots.map(b => (
                <Card key={b.name} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Bot className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-foreground">{b.name}</h3>
                        <p className="text-xs text-primary/70 mb-1">{b.org}</p>
                        <p className="text-sm text-muted-foreground">{b.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* What we check */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Ce que nous analysons</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Notre outil vérifie chaque couche technique qui peut bloquer ou limiter l'accès des bots IA à votre contenu.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {checkpoints.map(c => (
                <Card key={c.title} className="border-border/50">
                  <CardContent className="p-6">
                    <c.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* AI Attribution → Human (Sprint 2) */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                <GitBranch className="h-3 w-3 mr-1" /> Nouveau — Tracking GEO Sprint 2
              </Badge>
              <h2 className="text-3xl font-bold mb-4">Attribution Bot IA → Visite humaine</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Quand un bot IA crawle votre page puis qu'un humain arrive depuis ChatGPT, Claude ou Perplexity, 
                nous corrélons les deux événements pour mesurer le <strong>vrai ROI</strong> de votre visibilité IA.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <Clock className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Fenêtre 30 jours stricte</h3>
                  <p className="text-sm text-muted-foreground">
                    Corrélation entre un crawl bot et une visite humaine sur la même URL, dans une fenêtre temporelle de 30 jours maximum.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <Activity className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Pondération exponentielle</h3>
                  <p className="text-sm text-muted-foreground">
                    Modèle multi-touch <code className="text-xs">w(d) = e^(-d/15)</code> — un crawl récent pèse plus qu'un crawl ancien dans l'attribution.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <Fingerprint className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Empreinte SHA-256</h3>
                  <p className="text-sm text-muted-foreground">
                    Fingerprinting (UA + IP tronquée + Accept-Language) pour rapprocher les sessions sans cookie tiers.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 md:p-8">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Ce que vous obtenez dans la Console
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Top URL attribuées</strong> — les pages que les humains visitent après un crawl IA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Source IA dominante</strong> par URL (ChatGPT vs Perplexity vs Claude…)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Délai crawl → visite</strong> — combien de jours entre l'indexation IA et l'arrivée humaine</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Comment savoir si mon site bloque les bots IA ?</h3>
                <p className="text-muted-foreground text-sm">Utilisez l'outil Crawlers pour analyser votre robots.txt et vérifier les règles Disallow ciblant GPTBot, ClaudeBot, PerplexityBot et les autres crawlers IA.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Quels sont les principaux bots IA qui crawlent les sites web ?</h3>
                <p className="text-muted-foreground text-sm">Les principaux bots IA sont GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, Google-Extended, Amazonbot, AppleBot-Extended, Bytespider (ByteDance), et CCBot (Common Crawl).</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Bloquer les bots IA affecte-t-il mon SEO classique ?</h3>
                <p className="text-muted-foreground text-sm">Non, bloquer les bots IA dans robots.txt n'affecte pas Googlebot ni votre SEO classique. Mais cela réduit votre visibilité dans les réponses génératives (ChatGPT, Claude, Perplexity).</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-primary/5">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Lancez votre analyse complète</h2>
            <p className="text-muted-foreground mb-8">
              Obtenez un rapport détaillé sur l'accessibilité de votre site aux bots IA, avec des recommandations concrètes pour maximiser votre visibilité GEO.
            </p>
            <Button asChild size="lg" className="text-base px-10">
              <Link to="/audit-expert">
                Analyser mon site gratuitement <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default AnalyseBotsIA;
