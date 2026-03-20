import { lazy, Suspense, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowRight, CheckCircle2, Zap, Shield, Brain,
  Target, BarChart3, Search, Globe, FileText, Lock, Gauge, Loader2, Smartphone, Monitor
} from 'lucide-react';
import heroImage from '@/assets/landing/audit-seo-gratuit-hero.webp';
import { supabase } from '@/integrations/supabase/client';
import { PageSpeedResult } from '@/types/pagespeed';
import { PageSpeedDashboard } from '@/components/PageSpeedDashboard';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const AuditSeoGratuit = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/audit-seo-gratuit');

  const [psUrl, setPsUrl] = useState('');
  const [psLoading, setPsLoading] = useState(false);
  const [psResult, setPsResult] = useState<PageSpeedResult | null>(null);
  const [psStrategy, setPsStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [psError, setPsError] = useState('');

  const runPageSpeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!psUrl.trim()) return;
    setPsLoading(true);
    setPsError('');
    setPsResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('check-pagespeed', {
        body: { url: psUrl.trim(), strategy: psStrategy }
      });
      if (error || !data?.success) {
        setPsError(data?.error === 'quota_exceeded' 
          ? 'Quota API dépassé, réessayez demain.' 
          : (data?.error || 'Erreur lors de l\'analyse'));
      } else {
        setPsResult(data.data);
      }
    } catch {
      setPsError('Erreur réseau, réessayez.');
    } finally {
      setPsLoading(false);
    }
  };

  const handleStrategyChange = async (newStrategy: 'mobile' | 'desktop') => {
    setPsStrategy(newStrategy);
    if (psResult) {
      setPsLoading(true);
      setPsError('');
      try {
        const { data, error } = await supabase.functions.invoke('check-pagespeed', {
          body: { url: psUrl.trim(), strategy: newStrategy }
        });
        if (!error && data?.success) setPsResult(data.data);
      } catch {} finally { setPsLoading(false); }
    }
  };
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": "Audit SEO Gratuit en Ligne 2026 — Score sur 200 Points | Crawlers.fr",
        "description": "Audit SEO gratuit et instantané : analysez votre site sur 200 points (Core Web Vitals, JSON-LD, robots.txt, visibilité LLM). Résultats en 2 minutes, code correctif inclus.",
        "url": "https://crawlers.fr/audit-seo-gratuit",
        "isPartOf": { "@type": "WebSite", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
            { "@type": "ListItem", "position": 2, "name": "Audit SEO Gratuit", "item": "https://crawlers.fr/audit-seo-gratuit" }
          ]
        }
      },
      {
        "@type": "SoftwareApplication",
        "name": "Crawlers.fr — Audit SEO Gratuit",
        "applicationCategory": "WebApplication",
        "operatingSystem": "Web Browser",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
        "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "ratingCount": "312", "bestRating": "5" }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "L'audit SEO est-il vraiment gratuit ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Oui, l'audit technique (Score SEO 200) est 100% gratuit, sans inscription obligatoire. Il analyse la performance, le socle technique, la sémantique, la préparation IA et la sécurité de votre site." }
          },
          {
            "@type": "Question",
            "name": "Combien de temps prend l'audit SEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "L'audit complet se génère en moins de 2 minutes. Il inclut un score sur 200 points, des recommandations priorisées et du code correctif personnalisé." }
          },
          {
            "@type": "Question",
            "name": "Quelle est la différence entre un audit SEO classique et un audit GEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "L'audit SEO classique optimise votre visibilité sur Google. L'audit GEO (Generative Engine Optimization) optimise votre citabilité par les IA comme ChatGPT, Claude et Perplexity. Crawlers.fr fait les deux simultanément." }
          }
        ]
      }
    ]
  };

  const features = [
    { icon: Gauge, title: "Core Web Vitals", desc: "LCP, CLS, TBT analysés via Google PageSpeed Insights." },
    { icon: Shield, title: "Sécurité & HTTPS", desc: "Certificat SSL, Safe Browsing, menaces détectées." },
    { icon: FileText, title: "Balisage sémantique", desc: "Title, Meta, H1, densité de contenu, hiérarchie HTML." },
    { icon: Brain, title: "Préparation IA & GEO", desc: "JSON-LD, robots.txt, accessibilité GPTBot & ClaudeBot." },
    { icon: Target, title: "Mots-clés stratégiques", desc: "Positionnement DataForSEO + analyse d'intention IA." },
    { icon: BarChart3, title: "Code correctif", desc: "Script JSON-LD personnalisé, prêt à intégrer dans votre CMS." },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Audit SEO en Ligne 2026 — Score 200 Points, Visibilité IA | Crawlers.fr</title>
        <meta name="description" content="Audit SEO gratuit sur 200 points : Core Web Vitals, JSON-LD, robots.txt, visibilité LLM. Résultats en 2 min, code correctif inclus." />
        <link rel="canonical" href="https://crawlers.fr/audit-seo-gratuit" />
        <meta property="og:title" content="Audit SEO 2026 — Score 200 Points | Crawlers.fr" />
        <meta property="og:description" content="Analysez votre site sur 200 points : performance, technique, sémantique, IA/GEO et sécurité. Code correctif personnalisé inclus." />
        <meta property="og:url" content="https://crawlers.fr/audit-seo-gratuit" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://crawlers.fr/og-audit-seo-gratuit.webp" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4 text-xs font-medium uppercase tracking-wide">
                  <Search className="h-3 w-3 mr-1.5" />
                  100% Gratuit — Sans carte bancaire
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
                  Audit SEO gratuit : analysez votre site sur 200 points en 2 minutes
                </h1>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Crawlers.fr scanne votre site web et génère un diagnostic complet : Core Web Vitals, balisage sémantique, 
                  données structurées JSON-LD, accessibilité aux robots IA et score de visibilité GEO. 
                  Recevez des recommandations priorisées et du <strong>code correctif personnalisé</strong> prêt à intégrer.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" variant="hero">
                    <Link to="/audit-expert">
                      Lancer mon audit SEO gratuit
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/methodologie">
                      Voir la méthodologie
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative">
                <img 
                  src={heroImage} 
                  alt="Interface de l'audit SEO gratuit Crawlers.fr montrant le score sur 200 points avec les métriques de performance et les graphiques d'analyse" 
                  className="rounded-2xl shadow-2xl border border-border/50"
                  width={960}
                  height={540}
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Ce que l'audit analyse */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-foreground text-center mb-3">
              Que vérifie l'audit SEO gratuit de Crawlers.fr ?
            </h2>
            <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
              Plus de 50 points d'analyse répartis en 5 piliers, couvrant le SEO classique et la visibilité IA générative (GEO).
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 p-2 rounded-lg bg-primary/10">
                        <f.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                        <p className="text-sm text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pourquoi gratuit */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Pourquoi proposer un audit SEO gratuit en 2026 ?
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              En 2026, les règles du référencement ont fondamentalement changé. Google n'est plus le seul canal de découverte : 
              ChatGPT, Claude, Perplexity et Gemini génèrent des réponses directes en citant — ou en ignorant — votre site. 
              Un audit SEO classique ne suffit plus. Il faut mesurer simultanément votre performance technique, 
              votre balisage sémantique <em>et</em> votre citabilité par les modèles de langage.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Crawlers.fr automatise cette double analyse grâce à un score composite sur 200 points. L'audit gratuit 
              vous donne un diagnostic complet en moins de 2 minutes : erreurs techniques, opportunités sémantiques, 
              et un code correctif JSON-LD prêt à copier-coller. C'est la porte d'entrée vers une stratégie SEO & GEO efficace.
            </p>
            <h3 className="text-xl font-semibold text-foreground mb-3 mt-8">
              Audit SEO gratuit vs audit payant : quelle différence ?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              L'audit gratuit couvre le volet technique (Score SEO 200). Pour aller plus loin — analyse concurrentielle, 
              positionnement sur les mots-clés DataForSEO, visibilité LLM détaillée et plan d'action priorisé — 
              l'audit stratégique IA est disponible pour 2 crédits seulement.
            </p>

            {/* Lead Magnet — PageSpeed inline */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" id="pagespeed">
              <CardContent className="p-6">
                <div className="text-center mb-5">
                  <Gauge className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    Testez les performances de votre site — gratuitement
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Analyse Google PageSpeed Insights instantanée : Core Web Vitals, score de performance, accessibilité et SEO.
                  </p>
                </div>

                <form onSubmit={runPageSpeed} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    type="url"
                    placeholder="https://votre-site.fr"
                    value={psUrl}
                    onChange={e => setPsUrl(e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Button type="submit" variant="hero" disabled={psLoading} className="shrink-0">
                    {psLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gauge className="h-4 w-4 mr-2" />}
                    Analyser
                  </Button>
                </form>

                {psError && (
                  <p className="text-sm text-destructive text-center mb-3">{psError}</p>
                )}

                {(psResult || psLoading) && (
                  <PageSpeedDashboard
                    result={psResult}
                    isLoading={psLoading}
                    strategy={psStrategy}
                    onStrategyChange={handleStrategyChange}
                  />
                )}

                {psResult && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Pour un audit complet (200 points, code correctif, visibilité IA) :
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/audit-expert">
                        Lancer l'audit expert complet
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ inline */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Questions fréquentes sur l'audit SEO gratuit</h2>
            <div className="space-y-6">
              {[
                { q: "L'audit SEO est-il vraiment gratuit ?", a: "Oui, l'audit technique (Score SEO 200) est 100% gratuit, sans inscription. Il couvre la performance, le balisage, la préparation IA et la sécurité." },
                { q: "Combien de temps prend l'analyse ?", a: "Moins de 2 minutes pour un diagnostic complet sur 200 points avec code correctif personnalisé." },
                { q: "Mon site est-il analysé par une IA ?", a: "Oui, Crawlers.fr combine des données techniques (Google PageSpeed, DataForSEO) et des analyses IA (Gemini, GPT) pour un diagnostic hybride." },
                { q: "Quelle différence avec Semrush ou Ahrefs ?", a: "Crawlers.fr est le seul outil qui mesure simultanément votre SEO technique ET votre visibilité sur les moteurs IA (GEO). De plus, il génère du code correctif, pas juste un rapport." },
              ].map((item, i) => (
                <div key={i}>
                  <h3 className="font-semibold text-foreground mb-1">{item.q}</h3>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-12 px-4 bg-gradient-to-b from-background to-primary/5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Prêt à découvrir votre score ?
            </h2>
            <p className="text-muted-foreground mb-6">
              Aucune inscription requise. Résultats en 2 minutes. Code correctif inclus.
            </p>
            <Button asChild size="lg" variant="hero">
              <Link to="/audit-expert">
                Lancer l'audit SEO gratuit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default AuditSeoGratuit;
