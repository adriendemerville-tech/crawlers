import { lazy, Suspense, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Eye, Target, Type, MousePointerClick, BarChart3,
  Smartphone, Search, TrendingUp, CheckCircle2, Layers, Zap, PenTool, ArrowDown
} from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const axes = [
  { icon: Type, title: 'Ton & Voix', desc: 'Le ton est-il adapté à l\'audience ? Trop commercial, pas assez, trop technique ?' },
  { icon: MousePointerClick, title: 'Pression CTA', desc: 'Les CTAs sont-ils bien placés, correctement formulés et adaptés à l\'intention de la page ?' },
  { icon: Target, title: 'Alignement', desc: 'La page est-elle cohérente avec le positionnement, le secteur et le modèle commercial ?' },
  { icon: Eye, title: 'Lisibilité', desc: 'Structure, paragraphes, vocabulaire adapté. Facilité de scan et compréhension immédiate.' },
  { icon: BarChart3, title: 'Conversion', desc: 'Preuves sociales, proposition de valeur, urgence. Les éléments de conversion sont-ils présents ?' },
  { icon: Smartphone, title: 'Expérience Mobile', desc: 'Taille des blocs, accessibilité des boutons, structure adaptée au mobile.' },
  { icon: Search, title: 'Mots-clés', desc: 'Les mots-clés ciblés sont-ils utilisés naturellement dans H1, H2, body ? Densité appropriée ?' },
];

const workflow = [
  { step: '1', title: 'Sélectionnez votre site', desc: 'Choisissez un site tracké dans votre console. Conversion Optimizer utilise les données déjà crawlées — aucun re-crawl nécessaire.', features: ['Données issues du crawl existant', 'Aucune latence supplémentaire'] },
  { step: '2', title: 'Choisissez la page à analyser', desc: 'Sélectionnez une URL parmi les pages crawlées. L\'outil charge automatiquement le contenu, les mots-clés ciblés et le contexte business.', features: ['Dropdown des pages crawlées', 'Croisement keyword_universe'] },
  { step: '3', title: 'Analyse IA contextuelle', desc: 'L\'IA évalue la page sur 7 axes UX/CRO en tenant compte de votre positionnement, maturité, audience cible et objectifs business.', features: ['Score global 0-100', '7 axes détaillés', 'Suggestions concrètes avec reformulations'] },
  { step: '4', title: 'Prescriptions Workbench', desc: 'Les suggestions critiques alimentent automatiquement le Workbench Architect pour exécution par Code Architect ou Content Architect.', features: ['Fusion automatique des doublons', 'Priorisation unifiée'] },
];

const faq = [
  { q: 'Conversion Optimizer re-crawle-t-il les pages ?', a: 'Non. Conversion Optimizer utilise exclusivement les données du dernier crawl complété. Aucune requête supplémentaire n\'est envoyée vers votre site.' },
  { q: 'Quels axes sont analysés ?', a: '7 axes : Ton & Voix, Pression CTA, Alignement positionnement, Lisibilité, Potentiel de conversion, Expérience mobile, Utilisation des mots-clés.' },
  { q: 'Comment les suggestions sont-elles priorisées ?', a: 'Chaque suggestion reçoit une priorité (critical, high, medium, low). Les suggestions critical et high sont automatiquement injectées dans le Workbench Architect pour exécution.' },
  { q: 'Quelle est la différence avec Content Architect ?', a: 'Content Architect crée du contenu neuf. Conversion Optimizer analyse le contenu existant et propose des reformulations ciblées pour améliorer la conversion et l\'expérience utilisateur.' },
  { q: 'Faut-il un abonnement Pro Agency ?', a: 'Conversion Optimizer nécessite un site tracké avec un crawl complété. Le crawl multi-pages est disponible avec l\'abonnement Pro Agency.' },
];

const ConversionOptimizerLanding = memo(() => {
  useCanonicalHreflang('/conversion-optimizer');

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Conversion Optimizer by Crawlers.fr",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "description": "Analysez le ton, les CTAs, la lisibilité et le potentiel de conversion de chaque page de votre site, calibré sur votre contexte business.",
        "offers": [
          { "@type": "Offer", "name": "Pro Agency", "price": "29", "priceCurrency": "EUR" },
          { "@type": "Offer", "name": "Pro Agency +", "price": "79", "priceCurrency": "EUR" },
        ],
        "featureList": ["UX audit on 7 axes", "Contextual AI analysis", "CTA pressure analysis", "Mobile UX scoring", "Keyword usage optimization", "Workbench integration"],
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Conversion Optimizer", "item": "https://crawlers.fr/conversion-optimizer" },
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": faq.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": { "@type": "Answer", "text": item.a }
        }))
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Conversion Optimizer — Audit UX/CRO contextuel par IA | Crawlers.fr</title>
        <meta name="description" content="Analysez le ton, les CTAs, la lisibilité et le potentiel de conversion de chaque page. Analyse IA calibrée sur votre contexte business, maturité et objectifs." />
        <link rel="canonical" href="https://crawlers.fr/conversion-optimizer" />
        <meta property="og:title" content="Conversion Optimizer — Audit UX/CRO contextuel par IA | Crawlers.fr" />
        <meta property="og:description" content="7 axes d'analyse UX : ton, CTAs, alignement, lisibilité, conversion, mobile, mots-clés. Calibré sur votre business." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/conversion-optimizer" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Conversion Optimizer — Audit UX/CRO contextuel | Crawlers.fr" />
        <meta name="twitter:description" content="Analyse UX/CRO contextuelle sur 7 axes. Suggestions concrètes avec reformulations." />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />
      <div className="min-h-screen bg-background">
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden border-b border-border pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 via-background to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(270_60%_40%/0.08),transparent_60%)]" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div>
              <Badge variant="outline" className="mb-6 border-emerald-600/30 bg-emerald-600/10 text-emerald-500 gap-1.5">
                <Eye className="h-3 w-3" />
                Nouveau
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Analysez l'UX de vos pages{' '}
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400 bg-clip-text text-transparent">
                en contexte
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground">
              Conversion Optimizer évalue le ton, les CTAs, la lisibilité et le potentiel de conversion de chaque page — calibré sur votre business, votre audience et vos objectifs.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-emerald-700 to-green-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                  <TrendingUp className="h-4 w-4" /> Essayer Conversion Optimizer <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/content-architect">
                <Button size="lg" variant="outline" className="gap-2 border-emerald-600/30 hover:bg-emerald-600/5">
                  <PenTool className="h-4 w-4" /> Content Architect
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <section className="border-b border-border py-12 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { value: '7', label: 'Axes d\'analyse', detail: 'UX/CRO' },
              { value: '0', label: 'Re-crawl', detail: 'Données existantes' },
              { value: '< 30s', label: 'Par page', detail: 'Analyse IA' },
              { value: '∞', label: 'Contexte', detail: 'Business + mots-clés' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">{s.value}</p>
                <p className="text-sm font-medium text-foreground mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ 7 AXES ═══ */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">7 axes d'analyse UX/CRO</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Chaque axe est évalué en tenant compte de votre type de business, votre audience cible, votre maturité et votre Voice DNA.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {axes.map((axis, i) => {
                const Icon = axis.icon;
                return (
                  <Card key={i} className="border-border/50 hover:border-emerald-600/30 hover:bg-violet-500/[0.03] transition-all duration-300">
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground mb-1">{axis.title}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{axis.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {/* 7th axis spans full on last row */}
              <Card className="border-border/50 hover:border-emerald-600/30 hover:bg-violet-500/[0.03] transition-all duration-300 sm:col-span-2 lg:col-span-1">
                <CardContent className="p-5 text-center">
                  <div className="inline-flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-emerald-500" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">Workbench Architect</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Les suggestions critiques alimentent automatiquement le Workbench pour exécution par Code ou Content Architect.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ═══ WORKFLOW ═══ */}
        <section className="py-20 sm:py-28 border-t border-border bg-muted/10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Comment ça marche</h2>
              <p className="mt-3 text-muted-foreground">Du crawl existant aux prescriptions actionnables — sans re-crawl</p>
            </div>

            <div className="space-y-8">
              {workflow.map((step, i) => (
                <div key={i}>
                  <Card className="overflow-hidden border-border/50 hover:border-emerald-600/20 transition-colors">
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-600/20 to-green-500/20 border border-emerald-600/20 text-2xl font-bold text-emerald-500">
                            {step.step}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{step.desc}</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {step.features.map((f, j) => (
                              <div key={j} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-foreground/80">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {i < workflow.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-5 w-5 text-emerald-500/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CROSS CTA — Content Architect ═══ */}
        <section className="py-16 border-t border-border">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
              <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <PenTool className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Conversion Optimizer + Content Architect</h3>
                  <p className="text-sm text-muted-foreground">
                    Conversion Optimizer diagnostique. Content Architect crée. Ensemble, ils transforment vos recommandations UX en contenus optimisés publiés directement sur votre CMS.
                  </p>
                </div>
                <Link to="/content-architect">
                  <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 whitespace-nowrap">
                    Content Architect <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-20 sm:py-28 border-t border-border">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Questions fréquentes</h2>
            </div>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-sm text-foreground mb-2">{item.q}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="border-t border-border py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Optimisez l'expérience de chaque page
            </h2>
            <p className="text-muted-foreground mb-8">
              Inscrivez-vous, lancez un crawl et analysez vos pages en quelques secondes.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-emerald-700 to-green-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                <TrendingUp className="h-4 w-4" />
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
      <Suspense fallback={null}><Footer /></Suspense>
    </>
  );
});

ConversionOptimizerLanding.displayName = 'ConversionOptimizerLanding';
export default ConversionOptimizerLanding;
