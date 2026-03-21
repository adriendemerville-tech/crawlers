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
  ArrowRight, CheckCircle2, Globe, Brain, Search,
  FileText, Shield, BarChart3, Zap, Target, BookOpen, TrendingUp, Loader2
} from 'lucide-react';
import heroImage from '@/assets/landing/geo-pillar-hero.webp';
import { supabase } from '@/integrations/supabase/client';
import { GeoResult } from '@/types/geo';
import { GeoDashboard } from '@/components/GeoDashboard';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const GenerativeEngineOptimization = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/generative-engine-optimization');

  const [geoUrl, setGeoUrl] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [geoError, setGeoError] = useState('');

  const runGeoAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geoUrl.trim()) return;
    setGeoLoading(true);
    setGeoError('');
    setGeoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('check-geo', {
        body: { url: geoUrl.trim(), lang: language }
      });
      if (error || !data?.success) {
        setGeoError(data?.error || 'Erreur lors de l\'analyse GEO');
      } else {
        setGeoResult(data.data);
      }
    } catch {
      setGeoError('Erreur réseau, réessayez.');
    } finally {
      setGeoLoading(false);
    }
  };

  const publishDate = '2026-03-09';

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Generative Engine Optimization (GEO) : définition, stratégie et guide complet 2026",
        "description": "Le GEO (Generative Engine Optimization) est la discipline qui optimise votre contenu pour être cité par ChatGPT, Claude, Perplexity et Google SGE. Guide complet avec stratégie actionnable.",
        "image": "https://crawlers.fr/og-geo-pillar.webp",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": publishDate,
        "dateModified": publishDate,
        "url": "https://crawlers.fr/generative-engine-optimization",
        "mainEntityOfPage": "https://crawlers.fr/generative-engine-optimization"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Generative Engine Optimization", "item": "https://crawlers.fr/generative-engine-optimization" }
        ]
      },
      {
        "@type": "DefinedTerm",
        "name": "GEO",
        "alternateName": "Generative Engine Optimization",
        "description": "Discipline du marketing digital visant à optimiser un contenu pour être cité comme source fiable par les moteurs de recherche génératifs (ChatGPT, Claude, Perplexity, Google SGE).",
        "inDefinedTermSet": {
          "@type": "DefinedTermSet",
          "name": "Lexique SEO & GEO",
          "url": "https://crawlers.fr/lexique"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Qu'est-ce que le GEO (Generative Engine Optimization) ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Le GEO est la discipline qui optimise votre contenu pour être cité par les moteurs de recherche IA (ChatGPT, Claude, Perplexity, Google SGE). Contrairement au SEO qui cible les liens bleus Google, le GEO cible la citabilité dans les réponses textuelles des IA." }
          },
          {
            "@type": "Question",
            "name": "Quelle est la différence entre SEO et GEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Le SEO optimise votre positionnement dans les résultats de recherche classiques (liens bleus Google). Le GEO optimise votre citabilité dans les réponses des IA génératives. Les deux sont complémentaires : un bon socle technique SEO facilite aussi le crawling par les robots IA." }
          },
          {
            "@type": "Question",
            "name": "Comment mesurer son score GEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Crawlers.fr propose un score GEO gratuit qui mesure l'accessibilité de votre site aux crawlers IA, la qualité de vos données structurées JSON-LD, et votre taux de citation par les principaux LLM (ChatGPT, Claude, Gemini)." }
          },
          {
            "@type": "Question",
            "name": "Comment optimiser son site pour les moteurs IA ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Les 5 leviers principaux du GEO : 1) Données structurées JSON-LD riches, 2) robots.txt permissif pour GPTBot et ClaudeBot, 3) Contenu factuel avec sources vérifiables, 4) Format scannable (tableaux, listes, citations), 5) Autorité d'entité (Wikidata, presse, mentions)." }
          }
        ]
      }
    ]
  };

  const pillars = [
    {
      icon: FileText,
      title: "Données structurées JSON-LD",
      desc: "Les LLM exploitent les données structurées Schema.org pour comprendre le contexte d'une page. Un balisage JSON-LD riche (Organization, Article, FAQ, HowTo, Product) augmente significativement vos chances d'être cité.",
    },
    {
      icon: Shield,
      title: "Accessibilité aux crawlers IA",
      desc: "GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot — ces robots doivent pouvoir accéder à votre contenu. Un robots.txt permissif et des temps de réponse rapides sont essentiels.",
    },
    {
      icon: BookOpen,
      title: "Contenu factuel et sourçable",
      desc: "Les IA privilégient les contenus avec des données chiffrées, des citations d'experts, des tableaux comparatifs et des sources vérifiables. Le contenu d'opinion sans preuve est ignoré.",
    },
    {
      icon: Target,
      title: "Format scannable",
      desc: "Listes à puces, tableaux HTML, définitions claires, résumés en début de section. Les LLM extraient mieux l'information d'un contenu structuré que d'un bloc de texte continu.",
    },
    {
      icon: TrendingUp,
      title: "Autorité d'entité",
      desc: "Être reconnu comme une entité fiable via Wikidata, Google Knowledge Graph, mentions presse et écosystème de liens. L'E-E-A-T (Experience, Expertise, Authoritativeness, Trust) est central.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>GEO : Generative Engine Optimization — Guide Complet 2026 | Crawlers.fr</title>
        <meta name="description" content="Qu'est-ce que le GEO ? Guide complet de la Generative Engine Optimization : définition, différences avec le SEO, stratégies d'optimisation pour ChatGPT, Perplexity, Gemini." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/generative-engine-optimization" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/generative-engine-optimization" />
        <meta property="og:title" content="GEO : Generative Engine Optimization — Guide Complet 2026 | Crawlers.fr" />
        <meta property="og:description" content="Qu'est-ce que le GEO ? Guide complet de la Generative Engine Optimization : définition, différences avec le SEO, stratégies d'optimisation pour ChatGPT, Perplexity, Gemini." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="article:published_time" content={publishDate} />
        <meta property="article:author" content="Adrien de Volontat" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="GEO : Generative Engine Optimization — Guide Complet 2026 | Crawlers.fr" />
        <meta name="twitter:description" content="Qu'est-ce que le GEO ? Guide complet de la Generative Engine Optimization : définition, différences avec le SEO, stratégies d'optimisation pour ChatGPT, Perplexity, Gemini." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 px-4 bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-xs uppercase">Page Pilier</Badge>
              <span className="text-xs text-muted-foreground">Mis à jour le 9 mars 2026</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              Generative Engine Optimization (GEO) : définition, stratégie et guide complet 2026
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Par <strong>Adrien de Volontat</strong> — Fondateur de Crawlers.fr
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8 text-lg">
              Le GEO est la discipline qui optimise votre contenu pour être cité par les moteurs de recherche IA — 
              ChatGPT, Claude, Perplexity, Google SGE. Ce guide définit le concept, détaille les 5 piliers d'une 
              stratégie GEO efficace, et vous montre comment mesurer votre visibilité IA gratuitement.
            </p>
            <img 
              src={heroImage} 
              alt="Illustration du concept de Generative Engine Optimization montrant les connexions entre ChatGPT, Perplexity, Claude et le contenu web optimisé"
              className="w-full rounded-2xl shadow-lg border border-border/50"
              width={960}
              height={540}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </section>

        {/* Contenu pilier */}
        <article className="py-12 px-4">
          <div className="mx-auto max-w-3xl space-y-10">

            {/* Sommaire */}
            <Card className="bg-muted/30">
              <CardContent className="p-6">
                <h2 className="font-bold text-foreground mb-3">Sommaire</h2>
                <ol className="space-y-1 text-sm text-primary list-decimal list-inside">
                  <li><a href="#definition" className="hover:underline">Qu'est-ce que le GEO ?</a></li>
                  <li><a href="#seo-vs-geo" className="hover:underline">SEO vs GEO : quelles différences ?</a></li>
                  <li><a href="#piliers" className="hover:underline">Les 5 piliers du GEO</a></li>
                  <li><a href="#mesurer" className="hover:underline">Comment mesurer son score GEO</a></li>
                  <li><a href="#strategie" className="hover:underline">Stratégie GEO actionnable en 2026</a></li>
                </ol>
              </CardContent>
            </Card>

            {/* 1. Définition */}
            <section id="definition">
              <h2 className="text-2xl font-bold text-foreground mb-4">1. Qu'est-ce que le GEO (Generative Engine Optimization) ?</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Le <strong>GEO (Generative Engine Optimization)</strong> est la discipline du marketing digital qui vise 
                à optimiser un contenu web pour être cité comme source fiable par les <strong>moteurs de recherche génératifs</strong> — 
                ChatGPT (OpenAI), Claude (Anthropic), Perplexity, Google SGE (Search Generative Experience) et Gemini.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Contrairement au SEO classique qui cible les "liens bleus" de Google, le GEO se concentre sur la 
                <strong> citabilité</strong> : la capacité de votre contenu à apparaître dans les réponses textuelles 
                générées par les IA. En 2026, <strong>45% des recherches</strong> ne génèrent plus de clic vers un site web 
                (source : SparkToro) — les utilisateurs obtiennent leur réponse directement dans l'interface de l'IA.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Le GEO n'est pas une alternative au SEO : c'est un <strong>complément indispensable</strong>. Un bon socle 
                technique SEO (HTTPS, Core Web Vitals, HTML propre) facilite le crawling par les robots IA. Mais le SEO 
                seul ne garantit pas la citation par les LLM — il faut aussi structurer son contenu pour la compréhension sémantique.
              </p>
            </section>

            {/* 2. SEO vs GEO */}
            <section id="seo-vs-geo">
              <h2 className="text-2xl font-bold text-foreground mb-4">2. SEO vs GEO : quelles différences ?</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Critère</th>
                      <th className="text-center px-4 py-3 font-medium">SEO</th>
                      <th className="text-center px-4 py-3 font-medium">GEO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Objectif", "Classement Google (liens bleus)", "Citation par les IA (réponses textuelles)"],
                      ["Métrique clé", "Position dans les SERP", "Taux de citation LLM"],
                      ["Contenu optimal", "Mots-clés + liens", "Données factuelles + sources"],
                      ["Balisage", "Title, Meta, H1", "JSON-LD, Schema.org complet"],
                      ["Robots", "Googlebot", "GPTBot, ClaudeBot, PerplexityBot"],
                      ["Signal de confiance", "Backlinks", "E-E-A-T + Autorité d'entité"],
                      ["Risque principal", "Perte de positionnement", "Hallucination (citation incorrecte)"],
                    ].map(([critere, seo, geo], i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-4 py-2 font-medium text-foreground">{critere}</td>
                        <td className="text-center px-4 py-2 text-muted-foreground">{seo}</td>
                        <td className="text-center px-4 py-2 text-muted-foreground">{geo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. Les 5 piliers */}
            <section id="piliers">
              <h2 className="text-2xl font-bold text-foreground mb-6">3. Les 5 piliers du Generative Engine Optimization</h2>
              <div className="space-y-4">
                {pillars.map((p, i) => (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 p-2 rounded-lg bg-primary/10">
                          <p.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-2">{p.title}</h3>
                          <p className="text-sm text-muted-foreground">{p.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Lead Magnet — Score GEO inline */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent my-8" id="score-geo">
              <CardContent className="p-6">
                <div className="text-center mb-5">
                  <Globe className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    Mesurez votre score GEO gratuitement
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Crawlers.fr analyse l'accessibilité de votre site aux crawlers IA, la qualité de vos données structurées 
                    et votre taux de citation par ChatGPT, Claude et Gemini.
                  </p>
                </div>

                <form onSubmit={runGeoAudit} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    type="url"
                    placeholder="https://votre-site.fr"
                    value={geoUrl}
                    onChange={e => setGeoUrl(e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Button type="submit" variant="hero" disabled={geoLoading} className="shrink-0">
                    {geoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                    Analyser
                  </Button>
                </form>

                {geoError && (
                  <p className="text-sm text-destructive text-center mb-3">{geoError}</p>
                )}

                {(geoResult || geoLoading) && (
                  <GeoDashboard result={geoResult} isLoading={geoLoading} />
                )}

                {geoResult && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Pour l'audit complet (200 points, visibilité LLM, code correctif) :
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

            {/* 4. Mesurer */}
            <section id="mesurer">
              <h2 className="text-2xl font-bold text-foreground mb-4">4. Comment mesurer son score GEO ?</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Le score GEO de Crawlers.fr évalue votre site sur plusieurs dimensions : accessibilité aux robots IA 
                (GPTBot, ClaudeBot, PerplexityBot autorisés dans robots.txt), présence et qualité des données structurées 
                JSON-LD, richesse sémantique du contenu, et taux de citation par les principaux LLM.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Ce score est complété par l'analyse de <strong>Visibilité LLM</strong>, qui interroge directement ChatGPT, 
                Claude et Gemini avec des requêtes liées à votre secteur pour vérifier si votre marque est citée, 
                recommandée ou ignorée. Combinées, ces deux analyses donnent une vision complète de votre position dans 
                l'écosystème de recherche IA.
              </p>
            </section>

            {/* 5. Stratégie */}
            <section id="strategie">
              <h2 className="text-2xl font-bold text-foreground mb-4">5. Stratégie GEO actionnable en 2026</h2>
              <div className="space-y-3">
                {[
                  "Auditer votre accessibilité IA avec Crawlers.fr (robots.txt, temps de réponse, JSON-LD)",
                  "Enrichir vos pages avec des données structurées Schema.org (Organization, Article, FAQ, HowTo, Product)",
                  "Créer du contenu factuel : données chiffrées, citations d'experts, tableaux comparatifs, sources vérifiables",
                  "Optimiser votre robots.txt pour autoriser GPTBot, ClaudeBot et PerplexityBot",
                  "Développer votre autorité d'entité via Wikidata, Google Knowledge Graph et mentions presse",
                  "Surveiller vos citations LLM mensuellement avec l'outil de Visibilité LLM de Crawlers.fr",
                  "Détecter et corriger les hallucinations IA sur votre marque via l'outil de diagnostic dédié",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Conclusion */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Conclusion</h2>
              <p className="text-muted-foreground leading-relaxed">
                Le Generative Engine Optimization n'est pas un buzzword : c'est la réponse stratégique à la transformation 
                des moteurs de recherche. En 2026, être invisible pour les IA signifie perdre 45% de votre audience potentielle. 
                Les entreprises qui combinent SEO technique solide et stratégie GEO proactive captent les deux canaux de découverte 
                — Google et les moteurs de réponse IA. Crawlers.fr vous donne les outils pour mesurer, optimiser et suivre 
                votre visibilité sur ces deux fronts.
              </p>
            </section>

            {/* Liens internes */}
            <div className="border-t border-border pt-6 mt-8 space-y-2">
              <p className="text-sm font-semibold text-foreground">Ressources complémentaires :</p>
              <ul className="space-y-1">
                <li><Link to="/audit-seo-gratuit" className="text-sm text-primary hover:underline">Audit SEO Gratuit — Testez votre site en 2 minutes</Link></li>
                <li><Link to="/analyse-site-web-gratuit" className="text-sm text-primary hover:underline">Guide : Comment analyser un site web gratuitement</Link></li>
                <li><Link to="/blog/paradoxe-google-geo-2026" className="text-sm text-primary hover:underline">Le paradoxe Google et l'avènement du GEO en 2026</Link></li>
                <li><Link to="/lexique" className="text-sm text-primary hover:underline">Lexique SEO & GEO — Toutes les définitions</Link></li>
                <li><Link to="/methodologie" className="text-sm text-primary hover:underline">Méthodologie d'audit : 50+ points analysés</Link></li>
              </ul>
            </div>
          </div>
        </article>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default GenerativeEngineOptimization;
