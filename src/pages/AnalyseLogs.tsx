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
  ArrowRight, FileText, Shield, CheckCircle2, Search, AlertTriangle,
  Eye, Zap, Globe, Brain, Target, BarChart3, Bot, Terminal, Activity,
  PieChart, Clock, Server, Lock
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const AnalyseLogs = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/analyse-logs');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "Analyse de Logs Serveur — Comprenez comment Google et les IA crawlent votre site",
        "description": "Analysez vos fichiers de logs serveur pour comprendre le comportement de Googlebot, Bingbot et des bots IA (GPTBot, ClaudeBot). Détectez le budget crawl gaspillé, les pages orphelines et les anomalies d'indexation.",
        "author": { "@type": "Person", "name": "Adrien de Volontat", "url": "https://crawlers.fr/a-propos" },
        "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
        "datePublished": "2026-04-09",
        "dateModified": "2026-04-09",
        "url": "https://crawlers.fr/analyse-logs",
        "mainEntityOfPage": "https://crawlers.fr/analyse-logs"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Analyse de Logs", "item": "https://crawlers.fr/analyse-logs" }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Qu'est-ce que l'analyse de logs serveur en SEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "L'analyse de logs serveur consiste à examiner les fichiers de requêtes HTTP enregistrés par votre serveur web pour comprendre comment les robots (Googlebot, Bingbot, GPTBot) explorent votre site. Cela révèle les pages crawlées, la fréquence de passage, les erreurs rencontrées et le budget crawl consommé." }
          },
          {
            "@type": "Question",
            "name": "Comment l'analyse de logs aide-t-elle le SEO ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Elle permet d'identifier les pages que Google ne visite jamais (pages orphelines), celles qui gaspillent du budget crawl (redirections, 404, pages inutiles), et de vérifier que vos pages prioritaires sont bien explorées. C'est un complément indispensable à la Search Console." }
          },
          {
            "@type": "Question",
            "name": "L'analyse de logs détecte-t-elle les bots IA ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Oui. Crawlers détecte plus de 40 bots IA dans vos logs, incluant GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, Google-Extended et Bytespider. Vous pouvez voir exactement quelles pages ils crawlent, à quelle fréquence, et si votre robots.txt les bloque correctement." }
          },
          {
            "@type": "Question",
            "name": "Faut-il des compétences techniques pour analyser ses logs ?",
            "acceptedAnswer": { "@type": "Answer", "text": "Non. Crawlers ingère automatiquement vos logs via un connecteur Cloudflare ou par import direct, les catégorise par type de bot et génère un tableau de bord visuel sans aucune compétence technique requise." }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "name": "Crawlers — Analyse de Logs Serveur",
        "applicationCategory": "WebApplication",
        "operatingSystem": "Web",
        "url": "https://crawlers.fr/analyse-logs",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "EUR",
          "description": "Analyse de logs incluse dans les plans Pro Agency"
        }
      }
    ]
  };

  const insights = [
    { icon: Search, title: 'Budget Crawl', desc: 'Visualisez comment Google répartit son budget crawl sur vos pages et identifiez le gaspillage.' },
    { icon: Bot, title: '40+ Bots détectés', desc: 'Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, Bytespider — chaque bot est identifié et catégorisé.' },
    { icon: AlertTriangle, title: 'Pages orphelines', desc: 'Détectez les pages que les robots ne visitent jamais faute de maillage interne.' },
    { icon: Activity, title: 'Fréquence de crawl', desc: 'Comprenez la vélocité de passage de chaque bot et son évolution dans le temps.' },
    { icon: Shield, title: 'Erreurs serveur', desc: 'Identifiez les 404, 500, redirections en chaîne et autres erreurs qui freinent l\'indexation.' },
    { icon: Lock, title: 'Sécurité bots', desc: 'Repérez les bots malveillants, les scrapers agressifs et les tentatives d\'intrusion dans vos logs.' },
  ];

  const steps = [
    { step: '1', title: 'Connectez vos logs', desc: 'Via le connecteur Cloudflare intégré ou par import direct de vos fichiers de logs (Apache, Nginx, IIS).' },
    { step: '2', title: 'Catégorisation automatique', desc: 'Chaque requête est analysée : type de bot (moteur, IA, social, malveillant), User-Agent, code HTTP, URL.' },
    { step: '3', title: 'Tableau de bord visuel', desc: 'Explorez vos données de crawl via des graphiques interactifs : fréquence, distribution, erreurs, tendances.' },
    { step: '4', title: 'Recommandations IA', desc: 'L\'IA identifie les anomalies et génère des recommandations concrètes pour optimiser votre budget crawl.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Analyse de Logs Serveur — Comprenez le crawl de Google et des IA | Crawlers</title>
        <meta name="description" content="Analysez vos logs serveur pour comprendre comment Googlebot et les bots IA explorent votre site. Détectez le budget crawl gaspillé, les pages orphelines et optimisez votre indexation." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://crawlers.fr/analyse-logs" />
        <meta property="og:title" content="Analyse de Logs Serveur — Comprenez le crawl de Google et des bots IA" />
        <meta property="og:description" content="Détectez 40+ bots dans vos logs, analysez le budget crawl et optimisez votre indexation avec Crawlers." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://crawlers.fr/analyse-logs" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main>
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-background to-primary/5" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <Badge variant="outline" className="mb-4 text-cyan-500 border-cyan-500/30">
              <Terminal className="h-3 w-3 mr-1" /> Pro Agency
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Vos <span className="text-cyan-500">logs serveur</span> racontent<br />
              tout sur votre SEO
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Chaque requête HTTP est une <strong>donnée SEO brute</strong>. L'analyse de logs révèle ce que{' '}
              <Link to="/analyse-bots-ia" className="text-primary underline underline-offset-2 hover:text-primary/80">les bots IA</Link> et{' '}
              Googlebot font <em>réellement</em> sur votre site — pas ce que la Search Console vous montre.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="text-base px-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white">
                <Link to="/pro-agency">
                  Activer l'analyse de logs <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base">
                <Link to="/audit-expert">
                  Audit SEO gratuit
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 border-y border-border bg-muted/30">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: '40+', label: 'Bots identifiés' },
                { value: '∞', label: 'Lignes de logs' },
                { value: '< 5min', label: 'Ingestion complète' },
                { value: '24/7', label: 'Monitoring continu' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-3xl font-bold text-cyan-500">{s.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What we detect */}
        <section id="insights" className="py-16 md:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Ce que vos logs révèlent</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Chaque fichier de log contient des milliers de signaux SEO invisibles depuis la Search Console.
              Notre moteur les extrait, les catégorise et les transforme en recommandations actionnables.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.map(c => (
                <Card key={c.title} className="border-border/50 hover:border-cyan-500/30 transition-colors">
                  <CardContent className="p-6">
                    <c.icon className="h-8 w-8 text-cyan-500 mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Comment ça marche</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              De l'ingestion brute aux recommandations IA, en 4 étapes automatisées.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map(s => (
                <div key={s.step} className="text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500 text-xl font-bold border border-cyan-500/30">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEO context — why logs matter */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <h2>Pourquoi l'analyse de logs est indispensable en 2026</h2>
              <p>
                La <strong>Search Console</strong> ne montre qu'une fraction du comportement de crawl de Google.
                Les données d'exploration sont échantillonnées, retardées et ne couvrent pas les{' '}
                <Link to="/analyse-bots-ia" className="text-primary">bots IA émergents</Link> comme GPTBot ou ClaudeBot.
              </p>
              <p>
                L'analyse de logs serveur est la seule méthode qui offre une <strong>vue exhaustive et en temps réel</strong> de chaque
                requête effectuée par chaque robot sur votre site. C'est le complément indispensable de vos audits{' '}
                <Link to="/audit-expert" className="text-primary">SEO</Link> et{' '}
                <Link to="/score-geo" className="text-primary">GEO</Link>.
              </p>

              <h3>L'ère des bots IA dans vos logs</h3>
              <p>
                Depuis 2024, les crawlers IA représentent une part croissante du trafic bot. Comprendre leur comportement dans
                vos logs permet d'optimiser votre{' '}
                <Link to="/visibilite-llm" className="text-primary">visibilité LLM</Link> et de vérifier que votre{' '}
                <code>robots.txt</code> est correctement configuré.
              </p>

              <h3>Budget crawl et indexation</h3>
              <p>
                Un site de 10 000 pages ne peut pas se permettre que Googlebot passe 60% de son budget sur des pages
                filtrées, paginées ou en erreur. L'analyse de logs identifie précisément ce gaspillage et le corrèle
                avec les données de{' '}
                <Link to="/pagespeed" className="text-primary">performance</Link> et de{' '}
                <Link to="/app/site-crawl" className="text-primary">crawl multi-pages</Link>.
              </p>

              <h3>Requêtes fan-out : comprendre comment les IA décomposent vos thématiques</h3>
              <p>
                Quand un utilisateur pose une question à Perplexity, ChatGPT ou Gemini, le moteur ne se contente pas d'une seule recherche.
                Il <strong>décompose la requête en sous-questions</strong> (« fan-out ») — chaque axe faisant l'objet d'une recherche RAG indépendante.
                Comprendre quels bots crawlent quelles pages de votre site, c'est aussi comprendre quels axes thématiques les IA explorent pour construire leurs réponses.
              </p>
              <p>
                Crawlers.fr croise l'analyse de logs avec la <strong>détection des requêtes fan-out</strong> : nous simulons les sous-requêtes que les agents RAG vont formuler,
                et nous vérifions dans vos logs si les bots IA visitent effectivement les pages qui couvrent ces axes.
                Un bot qui ne visite jamais votre page « guide des prix » alors que l'axe « budget » est un fan-out fréquent ? C'est un signal d'alerte directement actionnable.
              </p>
              <p className="text-sm text-muted-foreground">
                <em>Note : il est probable que d'ici quelques mois, les moteurs de réponse IA deviennent plus transparents sur les requêtes formulées en interne par leurs agents.
                En attendant, notre approche hybride (simulation LLM + rétro-ingénierie des citations) offre une précision estimée à ~80%.</em>
              </p>
            </div>
          </div>
        </section>

        {/* Comparison: Logs vs GSC */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Logs serveur vs Search Console</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-cyan-500/30 bg-cyan-500/5">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="h-5 w-5 text-cyan-500" />
                    <h3 className="font-semibold text-foreground">Analyse de Logs</h3>
                  </div>
                  {[
                    'Données exhaustives et en temps réel',
                    'Tous les bots (Google, IA, sociaux, malveillants)',
                    'Budget crawl réel page par page',
                    'Détection pages orphelines et erreurs serveur',
                    'Historique complet sans échantillonnage',
                  ].map(item => (
                    <p key={item} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      {item}
                    </p>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Search Console seule</h3>
                  </div>
                  {[
                    'Données échantillonnées et retardées (48-72h)',
                    'Googlebot uniquement',
                    'Statistiques de crawl agrégées',
                    'Pas de détection pages orphelines',
                    'Historique limité à 16 mois',
                  ].map(item => (
                    <p key={item} className="text-sm flex items-start gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      {item}
                    </p>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Qu'est-ce que l'analyse de logs serveur en SEO ?</h3>
                <p className="text-muted-foreground text-sm">
                  L'analyse de logs serveur consiste à examiner les fichiers de requêtes HTTP enregistrés par votre serveur web pour comprendre comment les robots (Googlebot, Bingbot, GPTBot) explorent votre site. Cela révèle les pages crawlées, la fréquence de passage, les erreurs rencontrées et le budget crawl consommé.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Comment l'analyse de logs aide-t-elle le SEO ?</h3>
                <p className="text-muted-foreground text-sm">
                  Elle permet d'identifier les pages que Google ne visite jamais (pages orphelines), celles qui gaspillent du budget crawl (redirections, 404, pages inutiles), et de vérifier que vos pages prioritaires sont bien explorées. C'est un complément indispensable à la Search Console.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">L'analyse de logs détecte-t-elle les bots IA ?</h3>
                <p className="text-muted-foreground text-sm">
                  Oui. Crawlers détecte plus de 40 bots IA dans vos logs, incluant GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, Google-Extended et Bytespider. Vous pouvez voir exactement quelles pages ils crawlent et à quelle fréquence.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Faut-il des compétences techniques pour analyser ses logs ?</h3>
                <p className="text-muted-foreground text-sm">
                  Non. Crawlers ingère automatiquement vos logs via un connecteur Cloudflare ou par import direct, les catégorise par type de bot et génère un tableau de bord visuel sans aucune compétence technique requise.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Internal links section */}
        <section className="py-12 border-t border-border bg-muted/20">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Outils complémentaires</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { to: '/analyse-bots-ia', label: 'Analyse Bots IA' },
                { to: '/score-geo', label: 'Score GEO' },
                { to: '/visibilite-llm', label: 'Visibilité LLM' },
                { to: '/pagespeed', label: 'PageSpeed' },
                { to: '/audit-expert', label: 'Audit Expert' },
                { to: '/app/site-crawl', label: 'Crawl Multi-Pages' },
                { to: '/eeat', label: 'Audit E-E-A-T' },
                { to: '/app/cocoon', label: 'Cocoon Sémantique' },
                { to: '/conversion-optimizer', label: 'Conversion Optimizer' },
              ].map(l => (
                <Link key={l.to} to={l.to} className="text-sm px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <h3 className="text-sm font-medium text-muted-foreground mr-2 self-center">Ressources externes :</h3>
              {[
                { href: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers', label: 'Google Crawlers' },
                { href: 'https://www.cloudflare.com/learning/bots/what-is-a-web-crawler/', label: 'Cloudflare — Web Crawlers' },
                { href: 'https://ahrefs.com/blog/log-file-analysis/', label: 'Ahrefs — Log Analysis Guide' },
              ].map(l => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  {l.label} <ArrowRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-cyan-500/5 via-background to-primary/5">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Activez l'analyse de logs sur vos sites</h2>
            <p className="text-muted-foreground mb-8">
              L'analyse de logs est incluse dans les plans Pro Agency. Connectez votre Cloudflare Worker en 5 minutes et commencez à explorer vos données de crawl.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="text-base px-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white">
                <Link to="/pro-agency">
                  Découvrir Pro Agency <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base">
                <Link to="/audit-expert">
                  Audit SEO gratuit
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
};

export default AnalyseLogs;
