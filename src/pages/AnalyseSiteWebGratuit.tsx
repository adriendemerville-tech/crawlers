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
  ArrowRight, CheckCircle2, Search, Globe, Brain, 
  Gauge, Shield, FileText, BarChart3, Zap, Target, AlertTriangle
} from 'lucide-react';
import heroImage from '@/assets/landing/analyse-site-web-hero.webp';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const AnalyseSiteWebGratuit = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/analyse-site-web-gratuit');

  const publishDate = '2026-03-09';

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Analyse de site web gratuite en 2026 : le guide complet pour auditer votre SEO et votre visibilité IA",
        "description": "Comment analyser votre site web gratuitement en 2026 : méthode complète couvrant le SEO technique, les Core Web Vitals, la visibilité LLM et l'optimisation GEO.",
        "image": "https://crawlers.fr/og-analyse-site-web.webp",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": publishDate,
        "dateModified": publishDate,
        "url": "https://crawlers.fr/analyse-site-web-gratuit",
        "mainEntityOfPage": "https://crawlers.fr/analyse-site-web-gratuit"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://crawlers.fr/blog" },
          { "@type": "ListItem", "position": 3, "name": "Analyse de site web gratuite", "item": "https://crawlers.fr/analyse-site-web-gratuit" }
        ]
      },
      {
        "@type": "HowTo",
        "name": "Comment analyser un site web gratuitement",
        "step": [
          { "@type": "HowToStep", "name": "Entrez votre URL", "text": "Rendez-vous sur crawlers.fr/audit-expert et entrez l'adresse de votre site web." },
          { "@type": "HowToStep", "name": "Lancez l'audit technique", "text": "Cliquez sur Audit Technique SEO pour obtenir votre score sur 200 points en moins de 2 minutes." },
          { "@type": "HowToStep", "name": "Analysez les résultats", "text": "Consultez vos scores par pilier : Performance, Technique, Sémantique, Préparation IA et Sécurité." },
          { "@type": "HowToStep", "name": "Téléchargez le code correctif", "text": "Générez et copiez le code JSON-LD et les corrections recommandées directement dans votre CMS." }
        ]
      }
    ]
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Analyse de Site Web 2026 — Guide Complet SEO & Visibilité IA | Crawlers.fr</title>
        <meta name="description" content="Analysez votre site web gratuitement : SEO technique, Core Web Vitals, visibilité LLM et JSON-LD. Guide complet 2026." />
        <link rel="canonical" href="https://crawlers.fr/analyse-site-web-gratuit" />
        <meta property="og:title" content="Analyse de Site Web — Guide Complet 2026" />
        <meta property="og:description" content="Le guide complet pour analyser votre site web : SEO technique, Core Web Vitals, visibilité IA et code correctif." />
        <meta property="og:url" content="https://crawlers.fr/analyse-site-web-gratuit" />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={publishDate} />
        <meta property="article:author" content="Adrien de Volontat" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero article */}
        <section className="py-12 px-4 bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-xs">Guide</Badge>
              <Badge variant="outline" className="text-xs">Blog</Badge>
              <span className="text-xs text-muted-foreground">Publié le 9 mars 2026</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 leading-tight">
              Analyse de site web gratuite en 2026 : le guide complet pour auditer votre SEO et votre visibilité IA
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Par <strong>Adrien de Volontat</strong> — Fondateur de Crawlers.fr
            </p>
            <img 
              src={heroImage} 
              alt="Illustration de l'analyse de site web avec loupe sur une interface SEO montrant des métriques et graphiques de performance"
              className="w-full rounded-2xl shadow-lg border border-border/50 mb-8"
              width={960}
              height={540}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </section>

        {/* Contenu article */}
        <article className="py-8 px-4">
          <div className="mx-auto max-w-3xl prose-container space-y-8">
            
            {/* Introduction */}
            <p className="text-muted-foreground leading-relaxed text-lg">
              Analyser un site web en 2026, ce n'est plus seulement vérifier les balises Title et la vitesse de chargement. 
              Avec l'essor de ChatGPT, Claude, Perplexity et Google SGE, votre site doit aussi être <strong>compréhensible 
              et citable par les intelligences artificielles</strong>. Ce guide vous montre comment réaliser une analyse 
              complète et gratuite, couvrant le SEO technique classique et la visibilité IA (GEO).
            </p>

            {/* Étape 1 */}
            <h2 className="text-2xl font-bold text-foreground">1. Les fondamentaux d'une analyse de site web en 2026</h2>
            <p className="text-muted-foreground leading-relaxed">
              Une analyse de site web moderne se décompose en <strong>5 piliers</strong> : la performance (Core Web Vitals), 
              le socle technique (HTTPS, indexabilité, accessibilité), la sémantique (Title, Meta, H1, densité de contenu), 
              la préparation IA (JSON-LD, robots.txt pour GPTBot/ClaudeBot) et la sécurité (SSL, Safe Browsing). 
              Un outil comme Crawlers.fr évalue ces 5 piliers simultanément via un score composite sur 200 points.
            </p>

            {/* Étape 2 */}
            <h2 className="text-2xl font-bold text-foreground">2. Comment analyser votre site web gratuitement</h2>
            <div className="space-y-3 pl-4 border-l-2 border-primary/30">
              {[
                "Rendez-vous sur crawlers.fr/audit-expert et entrez l'URL de votre site",
                "Lancez l'Audit Technique SEO : score sur 200 points en moins de 2 minutes",
                "Consultez vos résultats par pilier et identifiez les axes d'amélioration",
                "Générez le code correctif JSON-LD personnalisé, prêt à intégrer dans votre CMS"
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <p className="text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>

            {/* Lead Magnet */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent my-8">
              <CardContent className="p-6 text-center">
                <Search className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Analysez votre site maintenant — c'est gratuit
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Score SEO sur 200 points + Score GEO + Analyse des crawlers IA + Code correctif JSON-LD. 
                  Aucune inscription requise.
                </p>
                <Button asChild variant="hero" size="lg">
                  <Link to="/audit-expert">
                    Lancer l'analyse gratuite
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Étape 3 */}
            <h2 className="text-2xl font-bold text-foreground">3. Pourquoi l'analyse SEO classique ne suffit plus</h2>
            <p className="text-muted-foreground leading-relaxed">
              En 2026, <strong>45% des recherches en ligne</strong> ne génèrent plus de clic vers un site web (source : SparkToro). 
              Les moteurs de réponse comme ChatGPT, Perplexity et Google SGE fournissent des réponses directes en citant 
              des sources. Si votre site n'est pas structuré pour être compris par ces IA — JSON-LD, robots.txt permissif, 
              contenu factuel avec sources — vous perdez une part croissante de votre audience potentielle.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              C'est pourquoi une analyse de site web en 2026 doit couvrir deux dimensions : le <strong>SEO</strong> 
              (être bien classé sur Google) et le <strong>GEO</strong> (être cité par les IA). Crawlers.fr est le premier 
              outil gratuit qui mesure ces deux dimensions simultanément.
            </p>

            {/* Étape 4 */}
            <h2 className="text-2xl font-bold text-foreground">4. Les métriques clés à surveiller</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Gauge, label: "LCP < 2.5s", desc: "Largest Contentful Paint" },
                { icon: Zap, label: "CLS < 0.1", desc: "Cumulative Layout Shift" },
                { icon: FileText, label: "JSON-LD valide", desc: "Données structurées Schema.org" },
                { icon: Brain, label: "GPTBot autorisé", desc: "robots.txt permissif pour les IA" },
                { icon: Shield, label: "HTTPS actif", desc: "Certificat SSL valide" },
                { icon: Target, label: "H1 unique", desc: "Hiérarchie sémantique correcte" },
              ].map((m, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <m.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Étape 5 */}
            <h2 className="text-2xl font-bold text-foreground">5. De l'analyse au code correctif</h2>
            <p className="text-muted-foreground leading-relaxed">
              La différence majeure de Crawlers.fr par rapport aux outils traditionnels (Semrush, Ahrefs, Screaming Frog) : 
              l'outil ne se contente pas de lister des erreurs. Il <strong>génère un code correctif personnalisé</strong> — 
              balises JSON-LD, meta tags optimisés, configuration robots.txt — que vous pouvez copier-coller directement 
              dans votre site WordPress, Shopify ou site custom. Le tout suivant le protocole CLS-ZERO pour un impact nul 
              sur vos Core Web Vitals.
            </p>

            {/* Conclusion */}
            <h2 className="text-2xl font-bold text-foreground">Conclusion</h2>
            <p className="text-muted-foreground leading-relaxed">
              En 2026, analyser un site web gratuitement signifie couvrir simultanément le SEO technique et la 
              visibilité IA. Crawlers.fr automatise cette double analyse en moins de 2 minutes, avec un score 
              sur 200 points et du code correctif actionnable. C'est la première étape vers une stratégie de 
              référencement complète, adaptée aux moteurs de recherche traditionnels <em>et</em> génératifs.
            </p>

            {/* Liens internes */}
            <div className="border-t border-border pt-6 mt-8 space-y-2">
              <p className="text-sm font-semibold text-foreground">Articles connexes :</p>
              <ul className="space-y-1">
                <li><Link to="/generative-engine-optimization" className="text-sm text-primary hover:underline">Qu'est-ce que le GEO (Generative Engine Optimization) ?</Link></li>
                <li><Link to="/audit-seo-gratuit" className="text-sm text-primary hover:underline">Audit SEO gratuit — Lancez votre analyse</Link></li>
                <li><Link to="/methodologie" className="text-sm text-primary hover:underline">Notre méthodologie d'audit : 50+ points analysés</Link></li>
                <li><Link to="/comparatif-crawlers-semrush" className="text-sm text-primary hover:underline">Crawlers.fr vs Semrush : le comparatif 2026</Link></li>
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

export default AnalyseSiteWebGratuit;
