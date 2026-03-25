import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { WordPressScanner } from '@/components/WordPressScanner';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Download, Cloud, RefreshCw, ShieldCheck, Zap, Brain, Search,
  Code, AlertTriangle, CheckCircle2, ArrowRight, Sparkles, Globe,
  FileCode, Puzzle, Link2, BarChart3, Lock, Gauge
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import heroImage from '@/assets/blog/wordpress-plugin-hero.webp';

const SITE_URL = 'https://crawlers.fr';
const PLUGIN_URL = `https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/download-plugin`;

const SEO_META = {
  title: 'Comment modifier le code de son site WordPress facilement ? | Crawlers.fr',
  description: "Optimisez le code de votre site WordPress sans toucher au PHP. Le plugin Crawlers.fr ou le widget GTM injecte automatiquement les balises SEO, JSON-LD et métadonnées GEO pour les moteurs de réponse IA.",
  ogTitle: 'Modifier le Code WordPress Sans Coder — Plugin & Widget Crawlers.fr',
  canonical: `${SITE_URL}/modifier-code-wordpress`,
};

const STEPS = [
  {
    icon: Search,
    title: 'Analysez votre site',
    desc: 'Lancez un Audit Expert sur Crawlers.fr. L\'IA scanne votre code source et identifie chaque frein à la visibilité IA.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    icon: Download,
    title: 'Branchez votre site',
    desc: 'Depuis Mon Espace → Mes Sites, cliquez sur l\'icône de branchement. Choisissez le plugin WordPress (.php) ou le snippet GTM/Script universel.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Link2,
    title: 'Activez la connexion',
    desc: 'WordPress : Lien Magique en un clic. GTM / Autres CMS : collez le snippet dans Google Tag Manager ou directement avant </head>.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: RefreshCw,
    title: 'Injection automatique',
    desc: 'Les balises Meta, le JSON-LD structuré et le code correctif GEO sont injectés automatiquement. Votre site parle aux LLMs.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
];

const PAIN_POINTS = [
  { icon: AlertTriangle, text: 'Toucher au fichier functions.php sans savoir ce qu\'on fait' },
  { icon: AlertTriangle, text: 'Installer un énième plugin qui ralentit le site' },
  { icon: AlertTriangle, text: 'Payer un développeur pour ajouter 3 balises meta' },
  { icon: AlertTriangle, text: 'Risquer l\'écran blanc de la mort après une mauvaise manipulation' },
];

const FAQ_ITEMS = [
  {
    q: 'Est-ce que le plugin / widget ralentit mon site ?',
    a: 'Non. Le plugin WordPress pèse moins de 50 Ko et n\'exécute aucun JavaScript côté visiteur. Le widget GTM pèse ~2 Ko et s\'exécute en mode différé (defer). Aucun impact sur les performances.',
  },
  {
    q: 'Quelle est la différence entre le plugin WordPress et le snippet GTM ?',
    a: 'Le plugin WordPress se synchronise automatiquement toutes les 6h via WP Cron et injecte les correctifs dans wp_head/wp_footer. Le snippet GTM/Script universel fonctionne sur tous les CMS (Shopify, React, HTML statique…) et se connecte en temps réel via le widget Crawlers.AI.',
  },
  {
    q: 'Ai-je besoin d\'une clé API ?',
    a: 'Non. Pour WordPress, le Lien Magique connecte automatiquement en un clic. Pour GTM, le snippet contient déjà votre clé API pré-remplie.',
  },
  {
    q: 'Le plugin fonctionne-t-il avec tous les thèmes WordPress ?',
    a: 'Oui. Le plugin utilise les hooks WordPress standards (wp_head) et ne modifie aucun fichier de thème. Il est compatible avec tous les thèmes et builders (Elementor, Divi, GeneratePress, Astra…).',
  },
  {
    q: 'Que se passe-t-il si je désactive le plugin ou retire le snippet ?',
    a: 'Les balises injectées disparaissent proprement. Votre site revient à son état d\'origine. Aucune modification permanente n\'est effectuée sur vos fichiers.',
  },
  {
    q: 'Comment le plugin améliore ma visibilité sur ChatGPT et Perplexity ?',
    a: 'Il injecte des données structurées JSON-LD et des métadonnées sémantiques que les crawlers IA (GPTBot, PerplexityBot, ClaudeBot) utilisent pour comprendre et citer votre contenu. C\'est ce qu\'on appelle l\'optimisation GEO (Generative Engine Optimization).',
  },
  {
    q: 'Le plugin est-il gratuit ?',
    a: 'Le plugin et le widget sont gratuits. L\'Audit Expert qui génère les correctifs personnalisés fonctionne avec un système de crédits à partir de 5€ — soit 20 à 50 fois moins cher qu\'un outil comme Semrush.',
  },
];

const ModifierCodeWordPress = () => {
  const { language } = useLanguage();
  useCanonicalHreflang('/modifier-code-wordpress');

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: SEO_META.title,
    description: SEO_META.description,
    image: `${SITE_URL}/assets/blog/wordpress-plugin-hero.webp`,
    author: { '@type': 'Organization', name: 'Crawlers.fr', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: SITE_URL },
    datePublished: '2026-03-02',
    dateModified: '2026-03-02',
    mainEntityOfPage: { '@type': 'WebPage', '@id': SEO_META.canonical },
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Comment optimiser le code WordPress pour l\'IA sans coder',
    description: 'Guide en 4 étapes pour injecter automatiquement les balises SEO et GEO sur WordPress via le plugin Crawlers.fr.',
    step: STEPS.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.title,
      text: s.desc,
    })),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: 'Modifier le Code WordPress', item: SEO_META.canonical },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{SEO_META.title}</title>
        <meta name="description" content={SEO_META.description} />
        <link rel="canonical" href={SEO_META.canonical} />
        <meta property="og:title" content={SEO_META.ogTitle} />
        <meta property="og:description" content={SEO_META.description} />
        <meta property="og:url" content={SEO_META.canonical} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-violet-950/40 to-background pt-24 pb-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
          <div className="container relative mx-auto px-4 max-w-5xl">
            <div className="text-center space-y-6">
              <Badge variant="outline" className="border-violet-500/40 text-violet-300 bg-violet-500/10 gap-1.5">
                <Sparkles className="h-3 w-3" />
                Guide GEO 2026
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                Comment modifier le code de son site{' '}
                <span className="bg-gradient-to-r from-violet-400 via-amber-300 to-violet-400 bg-clip-text text-transparent">
                  WordPress
                </span>{' '}
                facilement&nbsp;?
              </h1>
              <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Optimiser votre site pour les <strong className="text-white">moteurs de réponse IA</strong> (ChatGPT, Perplexity, Gemini) ne nécessite plus de savoir coder.
                Le plugin WordPress ou le widget GTM Crawlers.fr injecte automatiquement les balises <strong className="text-white">JSON-LD</strong>, les métadonnées SEO et le code GEO — sans toucher à votre thème.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button
                  variant="hero"
                  size="xl"
                  className="gap-2 bg-violet-600 hover:bg-violet-700"
                  onClick={() => window.open(PLUGIN_URL, '_blank')}
                >
                  <Download className="h-5 w-5" />
                  Télécharger le Plugin (.zip)
                </Button>
                <Button size="xl" className="gap-2 bg-slate-800 text-white hover:bg-slate-700 border border-slate-600" asChild>
                  <Link to="/audit-expert">
                    <Brain className="h-5 w-5" />
                    Lancer mon Audit Expert
                  </Link>
                </Button>
              </div>
            </div>

            {/* Hero image */}
            <div className="mt-12 relative rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-violet-500/10">
              <img
                src={heroImage}
                alt="Interface du plugin WordPress Crawlers.fr pour l'optimisation GEO et SEO automatique"
                className="w-full h-auto"
                loading="eager"
                width={1920}
                height={1080}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
            </div>
          </div>
        </section>

        {/* ═══════════════════ SCANNER WORDPRESS ═══════════════════ */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-2xl">
            <Separator className="mb-12 bg-violet-500/20" />
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Votre site est-il sous WordPress ?
              </h2>
              <p className="text-muted-foreground">
                Entrez une URL pour détecter instantanément si le site utilise WordPress.
              </p>
            </div>
            <WordPressScanner />
            <Separator className="mt-12 bg-violet-500/20" />
          </div>
        </section>

        {/* ═══════════════════ PROBLÉMATIQUE ═══════════════════ */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Modifier le code WordPress :{' '}
                <span className="text-destructive">le cauchemar des TPE/PME</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                82&nbsp;% des sites WordPress n'ont aucune donnée structurée JSON-LD.
                Résultat : ils sont <strong>invisibles</strong> pour ChatGPT, Perplexity et les moteurs de réponse IA.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {PAIN_POINTS.map((p, i) => (
                <Card key={i} className="border-destructive/20 bg-destructive/5">
                  <CardContent className="flex items-start gap-3 py-4 px-5">
                    <p.icon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{p.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-center text-muted-foreground mt-8 text-sm">
              Et pourtant, il suffit souvent d'ajouter <strong className="text-foreground">quelques balises bien placées</strong> pour que les LLMs vous citent.
            </p>
          </div>
        </section>

        {/* ═══════════════════ LA SOLUTION ═══════════════════ */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-14">
              <Badge className="mb-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <Puzzle className="h-3 w-3 mr-1" />
                Zéro Code
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Le plugin &amp; widget Crawlers.fr : un pont intelligent entre l'IA et votre site
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Notre plugin WordPress et notre widget GTM agissent comme un <strong className="text-foreground">intermédiaire invisible</strong> entre votre site et la plateforme Crawlers.fr.
                Ils récupèrent les correctifs générés par l'Audit Expert et les injectent proprement dans votre <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">&lt;head&gt;</code> — sans modifier vos fichiers source.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: FileCode, title: 'Injection propre', desc: 'WordPress : via wp_head (hook standard). GTM/Script : via le widget Crawlers.AI. Aucun fichier de thème modifié.', color: 'text-violet-500' },
                { icon: Cloud, title: 'Synchronisation cloud', desc: 'Le plugin interroge l\'API toutes les 6h. Le widget GTM se connecte en temps réel. Dernières optimisations toujours appliquées.', color: 'text-blue-500' },
                { icon: ShieldCheck, title: 'Réversible à 100%', desc: 'Désactivez le plugin ou retirez le snippet — tout disparaît. Pas de résidus, pas de modifications permanentes.', color: 'text-emerald-500' },
              ].map((feature, i) => (
                <Card key={i} className="text-center border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="pt-8 pb-6 space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <feature.icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ GUIDE ÉTAPE PAR ÉTAPE ═══════════════════ */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                4 étapes pour optimiser votre WordPress pour l'IA
              </h2>
              <p className="text-muted-foreground text-lg">
                De l'audit à la synchronisation automatique — moins de 5 minutes.
              </p>
            </div>

            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-5 p-6 rounded-xl border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className={`shrink-0 w-14 h-14 rounded-xl ${step.bg} flex items-center justify-center relative`}>
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                    <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA mid-page */}
            <div className="mt-10 text-center">
              <Button
                variant="hero"
                size="lg"
                className="gap-2 bg-violet-600 hover:bg-violet-700"
                onClick={() => window.open(PLUGIN_URL, '_blank')}
              >
                <Download className="h-5 w-5" />
                Télécharger le Plugin Crawlers.fr
              </Button>
            </div>
          </div>
        </section>

        {/* ═══════════════════ AUDIT EXPERT ═══════════════════ */}
        <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-6">
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  <Brain className="h-3 w-3 mr-1" />
                  Le cerveau de l'optimisation
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  L'Audit Expert : votre scanner GEO
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  L'Audit Expert analyse le code source HTML de votre WordPress en temps réel.
                  Il détecte les <strong className="text-foreground">freins à la lecture par les LLMs</strong> — balises manquantes, données structurées absentes, signaux sémantiques faibles — et génère le code correctif prêt à être injecté.
                </p>
                <ul className="space-y-3">
                  {[
                    'Détection des balises Title, H1, Meta Description',
                    'Génération automatique de JSON-LD Schema.org',
                    'Analyse de la présence GTM / GA4',
                    'Score de "citabilité" par les moteurs de réponse IA',
                    'Corrections injectables en un clic via le plugin WordPress ou le widget GTM',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="hero" size="lg" className="gap-2" asChild>
                  <Link to="/audit-expert">
                    <Zap className="h-5 w-5" />
                    Lancer mon Audit Expert maintenant
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Visual card */}
              <Card className="border-primary/20 bg-gradient-to-br from-violet-500/5 to-amber-500/5 overflow-hidden">
                <CardContent className="p-8 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Score GEO</p>
                      <p className="text-xs text-muted-foreground">Visibilité sur les moteurs de réponse IA</p>
                    </div>
                  </div>
                  {[
                    { label: 'JSON-LD Schema.org', value: 'Absent → Injecté', status: true },
                    { label: 'Meta Description', value: 'Trop longue → Optimisée', status: true },
                    { label: 'Balise H1', value: 'Dupliquée → Corrigée', status: true },
                    { label: 'Données structurées FAQ', value: 'Absentes → Générées', status: true },
                    { label: 'Signal sémantique LLM', value: '12% → 87%', status: true },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {row.value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ═══════════════════ CHAMP SÉMANTIQUE GEO ═══════════════════ */}
        <section className="py-16 bg-muted/20">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl font-bold mb-6 text-center">
              Pourquoi l'optimisation GEO est indispensable en 2026
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-4">
              <p>
                L'<strong className="text-foreground">optimisation GEO</strong> (Generative Engine Optimization) désigne l'ensemble des techniques visant à rendre un site web lisible et citable par les <strong className="text-foreground">moteurs de réponse IA</strong> comme ChatGPT, Perplexity, Gemini ou Claude.
              </p>
              <p>
                Contrairement au SEO classique qui optimise pour les pages de résultats Google, le GEO optimise pour les <strong className="text-foreground">réponses générées par les LLMs</strong>. Ces modèles de langage ne "crawlent" pas votre site comme Googlebot : ils s'appuient sur des <strong className="text-foreground">données structurées JSON-LD</strong>, des balises sémantiques claires et des métadonnées enrichies pour décider de vous citer.
              </p>
              <p>
                Le plugin WordPress et le widget GTM Crawlers.fr automatisent cette optimisation en injectant les bonnes balises SEO, le JSON-LD automatique et les signaux sémantiques que les crawlers IA (GPTBot, PerplexityBot, ClaudeBot) recherchent.
                Le résultat : un <strong className="text-foreground">gain de performance LLM</strong> mesurable dès la première synchronisation, sans toucher une ligne de code.
              </p>
            </div>
          </div>
        </section>


        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-10">
              Questions fréquentes
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQ_ITEMS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-5">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══════════════════ HERO GTM ═══════════════════ */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-amber-500/5 via-background to-primary/5 border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 space-y-5">
                <Badge variant="outline" className="gap-1.5 border-amber-400/50 text-amber-600 dark:text-amber-400">
                  <Puzzle className="h-3.5 w-3.5" />
                  Google Tag Manager
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {language === 'es'
                    ? 'Integración GTM: inyecte su código sin tocar su CMS'
                    : language === 'en'
                    ? 'GTM Integration: inject your code without touching your CMS'
                    : 'Intégration GTM : injectez votre code sans toucher à votre CMS'}
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed">
                  {language === 'es'
                    ? 'Un snippet ligero (~2 Ko), asíncrono y sandboxeado. Compatible con todos los CMS: Shopify, Webflow, Wix, Squarespace… Sin dependencias, sin conflictos, desconexión instantánea.'
                    : language === 'en'
                    ? 'A lightweight snippet (~2 KB), asynchronous and sandboxed. Compatible with any CMS: Shopify, Webflow, Wix, Squarespace… No dependencies, no conflicts, instant disconnect.'
                    : 'Un snippet léger (~2 Ko), asynchrone et sandboxé. Compatible tous CMS : Shopify, Webflow, Wix, Squarespace… Sans dépendance, sans conflit, débranchement instantané.'}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button size="lg" className="gap-2" asChild>
                    <Link to="/integration-gtm">
                      <Code className="h-4 w-4" />
                      {language === 'es' ? 'Métodos de conexión' : language === 'en' ? 'Connection methods' : 'Méthodes de branchement'}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="shrink-0 w-48 h-48 md:w-56 md:h-56 rounded-2xl bg-gradient-to-br from-amber-400/20 to-primary/20 border border-amber-400/30 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Code className="h-12 w-12 mx-auto text-amber-500" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GTM · Script · API</p>
                  <p className="text-2xl font-bold text-foreground">~2 Ko</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ CTA FINAL ═══════════════════ */}
        <section className="py-20 bg-gradient-to-b from-background to-slate-950">
          <div className="container mx-auto px-4 max-w-3xl text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Prêt à rendre votre WordPress visible pour l'IA ?
            </h2>
            <p className="text-slate-300 text-lg max-w-xl mx-auto">
              Téléchargez le plugin, collez le snippet GTM ou lancez votre Audit Expert et laissez Crawlers.fr optimiser votre code automatiquement.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button
                variant="hero"
                size="xl"
                className="gap-2 bg-violet-600 hover:bg-violet-700"
                onClick={() => window.open(PLUGIN_URL, '_blank')}
              >
                <Download className="h-5 w-5" />
                Télécharger le Plugin (.zip)
              </Button>
              <Button size="xl" className="gap-2 bg-slate-800 text-white hover:bg-slate-700 border border-slate-600" asChild>
                <Link to="/audit-expert">
                  <Brain className="h-5 w-5" />
                  Audit Expert gratuit
                </Link>
              </Button>
            </div>
            <p className="text-xs text-slate-500 pt-4">
              Plugin compatible WordPress 5.0+ · Widget GTM compatible tous CMS · Aucune dépendance · Licence GPL · <Link to="/blog" className="underline hover:text-slate-300">Documentation technique</Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default ModifierCodeWordPress;
