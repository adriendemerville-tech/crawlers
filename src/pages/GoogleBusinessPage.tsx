import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { t3 } from '@/utils/i18n';
import {
  MapPin, Star, TrendingUp, BarChart3, Shield, Eye, Zap,
  CheckCircle2, ArrowRight, Globe, MessageSquare, Image,
  Clock, Users, Search, Crown, Sparkles, Target, Award
} from 'lucide-react';
import { PricingPlansSection } from '@/components/PricingPlansSection';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));



/* ── Fake GMB Console Preview ── */
function GmbConsolePreview() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xl">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-destructive/60" />
          <span className="w-3 h-3 rounded-full bg-amber-400/60" />
          <span className="w-3 h-3 rounded-full bg-green-400/60" />
        </div>
        <span className="text-xs text-muted-foreground font-mono">crawlers.fr/console → Google Business</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Score header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Score de complétude GBP</p>
            <p className="text-3xl font-bold text-foreground">78<span className="text-lg text-muted-foreground">/100</span></p>
          </div>
          <div className="h-16 w-16 rounded-full border-4 border-primary flex items-center justify-center">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Avis', value: '47', icon: Star, trend: '+12' },
            { label: 'Photos', value: '23', icon: Image, trend: '+5' },
            { label: 'Posts', value: '8', icon: MessageSquare, trend: '+3' },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-muted/40 p-3 text-center">
              <m.icon className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-semibold text-foreground">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              <span className="text-[10px] text-green-500 font-medium">{m.trend}</span>
            </div>
          ))}
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {[
            { label: 'Nom, adresse, téléphone (NAP)', done: true },
            { label: 'Catégorie principale optimisée', done: true },
            { label: 'Description avec mots-clés SEO', done: false },
            { label: 'Horaires à jour', done: true },
            { label: 'Photos récentes (< 30 jours)', done: false },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${item.done ? 'text-green-500' : 'text-muted-foreground/40'}`} />
              <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Competitors */}
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> Concurrents locaux détectés
          </p>
          <div className="space-y-1.5">
            {[
              { name: 'Concurrent A', score: 92, reviews: 128 },
              { name: 'Concurrent B', score: 85, reviews: 67 },
              { name: 'Votre fiche', score: 78, reviews: 47, you: true },
            ].map(c => (
              <div key={c.name} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${(c as any).you ? 'bg-primary/10 font-medium' : ''}`}>
                <span className="text-foreground">{c.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{c.reviews} avis</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.score}/100</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoogleBusinessPage() {
  const { language } = useLanguage();
  useCanonicalHreflang('/google-business');

  const features = [
    {
      icon: BarChart3,
      title: t3(language, 'Audit fiche sur 100 points', 'Listing Audit on 100 Points', 'Auditoría de ficha sobre 100 puntos'),
      desc: t3(language,
        'Votre fiche Google est notée sur 100 points répartis en 5 catégories : Identité, Contact, Médias, Enrichissement, Engagement. Chaque point manquant est détaillé avec un correctif actionnable et le gain estimé. L\'audit est proposé automatiquement dès la connexion de votre fiche.',
        'Your Google listing is scored on 100 points across 5 categories: Identity, Contact, Media, Enrichment, Engagement. Each missing point comes with an actionable fix and estimated gain. The audit is automatically offered upon listing connection.',
        'Su ficha Google se puntúa sobre 100 puntos en 5 categorías: Identidad, Contacto, Medios, Enriquecimiento, Engagement. Cada punto faltante incluye un correctivo accionable y la ganancia estimada.'
      ),
    },
    {
      icon: MessageSquare,
      title: t3(language, 'Réponses automatisées aux avis', 'Automated Review Replies', 'Respuestas automatizadas a reseñas'),
      desc: t3(language,
        'Générez des réponses contextuelles à vos avis Google en 1 clic grâce à l\'IA. Analyse du sentiment, priorisation des avis négatifs, ton adaptable (professionnel, amical, formel). Répondez à tous vos avis en lot ou individuellement, puis validez avant publication.',
        'Generate contextual replies to your Google reviews in 1 click with AI. Sentiment analysis, negative review prioritization, adaptable tone (professional, friendly, formal). Reply to all reviews in batch or individually, then validate before publishing.',
        'Genere respuestas contextuales a sus reseñas Google en 1 clic con IA. Análisis de sentimiento, priorización de reseñas negativas, tono adaptable. Responda a todas sus reseñas en lote o individualmente.'
      ),
    },
    {
      icon: Users,
      title: t3(language, 'Benchmark concurrentiel local', 'Local Competitive Benchmark', 'Benchmark competitivo local'),
      desc: t3(language,
        'Identifiez automatiquement vos concurrents locaux via Google Places, comparez vos scores, nombre d\'avis, fréquence de publications et photos. Visualisez votre position dans le pack local.',
        'Automatically identify your local competitors via Google Places, compare scores, review counts, posting frequency and photos. Visualize your position in the local pack.',
        'Identifique automáticamente a sus competidores locales vía Google Places, compare scores, número de reseñas, frecuencia de publicaciones y fotos.'
      ),
    },
    {
      icon: Sparkles,
      title: t3(language, 'Recommandations IA optimisées GEO', 'GEO-Optimized AI Recommendations', 'Recomendaciones IA optimizadas GEO'),
      desc: t3(language,
        'Notre IA génère des suggestions de description, de posts et de réponses aux avis optimisées pour la visibilité dans les moteurs génératifs (ChatGPT, Gemini, Perplexity).',
        'Our AI generates description, post and review response suggestions optimized for visibility in generative engines (ChatGPT, Gemini, Perplexity).',
        'Nuestra IA genera sugerencias de descripción, posts y respuestas a reseñas optimizadas para la visibilidad en motores generativos (ChatGPT, Gemini, Perplexity).'
      ),
    },
    {
      icon: Eye,
      title: t3(language, 'Suivi de visibilité locale', 'Local Visibility Tracking', 'Seguimiento de visibilidad local'),
      desc: t3(language,
        'Suivez l\'évolution de votre visibilité locale au fil du temps : positions dans le pack local, nombre d\'avis, note moyenne, et taux de clics depuis Google Maps.',
        'Track your local visibility evolution over time: positions in the local pack, review count, average rating, and click-through rate from Google Maps.',
        'Siga la evolución de su visibilidad local: posiciones en el pack local, número de reseñas, nota media y tasa de clics desde Google Maps.'
      ),
    },
    {
      icon: Shield,
      title: t3(language, 'Cohérence NAP multi-sources', 'Multi-Source NAP Consistency', 'Coherencia NAP multi-fuentes'),
      desc: t3(language,
        'Vérifiez que votre Nom, Adresse et Téléphone (NAP) sont identiques sur votre site, votre fiche GBP, et les annuaires principaux. Les incohérences sont détectées automatiquement.',
        'Verify that your Name, Address and Phone (NAP) are identical on your site, GBP listing, and major directories. Inconsistencies are automatically detected.',
        'Verifique que su Nombre, Dirección y Teléfono (NAP) sean idénticos en su sitio, ficha GBP y directorios principales.'
      ),
    },
    {
      icon: Zap,
      title: t3(language, 'Déploiement depuis Crawlers', 'Deployment from Crawlers', 'Despliegue desde Crawlers'),
      desc: t3(language,
        'Publiez vos posts GBP, mettez à jour votre description et répondez aux avis directement depuis la console Crawlers, sans quitter votre workflow d\'optimisation.',
        'Publish GBP posts, update your description and respond to reviews directly from the Crawlers console, without leaving your optimization workflow.',
        'Publique posts GBP, actualice su descripción y responda a reseñas directamente desde la consola Crawlers.'
      ),
    },
  ];

  const competitors = [
    {
      name: 'Semrush Listing Management',
      price: t3(language, 'À partir de 40 $/mois', 'From $40/month', 'Desde 40 $/mes'),
      limits: t3(language, 'Distribution d\'annuaires uniquement, pas d\'analyse GEO', 'Directory distribution only, no GEO analysis', 'Solo distribución de directorios, sin análisis GEO'),
    },
    {
      name: 'BrightLocal',
      price: t3(language, 'À partir de 39 $/mois', 'From $39/month', 'Desde 39 $/mes'),
      limits: t3(language, 'Reporting local solide mais aucun lien avec le SEO on-page ou la visibilité IA', 'Solid local reporting but no link to on-page SEO or AI visibility', 'Reporting local sólido pero sin vínculo con SEO on-page o visibilidad IA'),
    },
    {
      name: 'Whitespark',
      price: t3(language, 'À partir de 33 $/mois', 'From $33/month', 'Desde 33 $/mes'),
      limits: t3(language, 'Spécialiste citations, pas de diagnostic de fiche ni de suivi concurrent', 'Citation specialist, no listing diagnosis or competitor tracking', 'Especialista en citaciones, sin diagnóstico de ficha ni seguimiento de competidores'),
    },
  ];

  const faqItems = [
    {
      q: t3(language, 'Qu\'est-ce que Google Business Profile (GBP) et pourquoi l\'optimiser ?', 'What is Google Business Profile (GBP) and why optimize it?', '¿Qué es Google Business Profile (GBP) y por qué optimizarlo?'),
      a: t3(language,
        'Google Business Profile (anciennement Google My Business / GMB) est votre fiche d\'établissement sur Google. Elle apparaît dans le pack local, Google Maps et les résultats de recherche. En 2026, les moteurs génératifs comme ChatGPT et Gemini puisent dans ces fiches pour répondre aux requêtes locales. Chez Crawlers, notre outil Google Business analyse 42 critères de votre fiche et génère des recommandations optimisées à la fois pour le SEO local et la visibilité dans les LLMs.',
        'Google Business Profile (formerly Google My Business / GMB) is your business listing on Google. It appears in the local pack, Google Maps and search results. In 2026, generative engines like ChatGPT and Gemini draw from these listings to answer local queries. At Crawlers, our Google Business tool analyzes 42 criteria of your listing and generates recommendations optimized for both local SEO and LLM visibility.',
        'Google Business Profile (antes Google My Business / GMB) es su ficha de establecimiento en Google. Aparece en el pack local, Google Maps y los resultados de búsqueda. En 2026, los motores generativos como ChatGPT y Gemini consultan estas fichas para responder consultas locales.'
      ),
    },
    {
      q: t3(language, 'Quelle différence entre Crawlers et un outil de gestion GMB classique ?', 'What\'s the difference between Crawlers and a standard GMB management tool?', '¿Cuál es la diferencia entre Crawlers y una herramienta de gestión GMB clásica?'),
      a: t3(language,
        'Les outils classiques (BrightLocal, Whitespark) se limitent à la distribution de citations et au reporting. Crawlers va plus loin : analyse de complétude sur 42 points, benchmark concurrentiel automatique via Google Places, recommandations IA optimisées GEO, et surtout une intégration native avec vos audits SEO/GEO, votre maillage interne Cocoon et votre suivi de positionnement. Votre fiche GBP devient un levier de votre stratégie SEO globale, pas un silo isolé.',
        'Standard tools (BrightLocal, Whitespark) focus on citation distribution and reporting. Crawlers goes further: 42-point completeness analysis, automatic competitive benchmark via Google Places, GEO-optimized AI recommendations, and native integration with your SEO/GEO audits, Cocoon internal linking and position tracking. Your GBP listing becomes a lever of your global SEO strategy, not an isolated silo.',
        'Las herramientas clásicas se limitan a la distribución de citaciones y reporting. Crawlers va más allá: análisis de completitud en 42 puntos, benchmark competitivo automático vía Google Places, recomendaciones IA optimizadas GEO, e integración nativa con sus auditorías SEO/GEO.'
      ),
    },
    {
      q: t3(language, 'Le module Google Business est-il inclus dans l\'abonnement Pro Agency ?', 'Is the Google Business module included in the Pro Agency subscription?', '¿El módulo Google Business está incluido en la suscripción Pro Agency?'),
      a: t3(language,
        'Le module Google Business est inclus dans l\'abonnement Pro Agency+ à 79 €/mois. L\'abonnement Pro Agency à 29 €/mois inclut tous les autres outils (audits illimités, crawl, Cocoon, Content Architect, Autopilote). Si vous êtes indépendant ou petite entreprise, vous pouvez également utiliser le module à l\'unité via des crédits.',
        'The Google Business module is included in the Pro Agency+ subscription at €79/month. The Pro Agency subscription at €29/month includes all other tools (unlimited audits, crawl, Cocoon, Content Architect, Autopilot). Independent professionals can also use the module per-use via credits.',
        'El módulo Google Business está incluido en la suscripción Pro Agency+ a 79 €/mes. La suscripción Pro Agency a 29 €/mes incluye todas las demás herramientas.'
      ),
    },
    {
      q: t3(language, 'Comment Crawlers optimise ma fiche pour les moteurs génératifs (GEO) ?', 'How does Crawlers optimize my listing for generative engines (GEO)?', '¿Cómo Crawlers optimiza mi ficha para los motores generativos (GEO)?'),
      a: t3(language,
        'Crawlers applique les principes du GEO (Generative Engine Optimization) à votre fiche GBP : rédaction de descriptions avec des auto-citations de marque pour favoriser les citations par les LLMs, structuration des informations pour les réponses directes, et suggestions de FAQ optimisées pour les requêtes conversationnelles. Notre IA analyse comment ChatGPT, Gemini et Perplexity interprètent votre fiche et suggère des améliorations ciblées.',
        'Crawlers applies GEO (Generative Engine Optimization) principles to your GBP listing: descriptions with brand self-citations to favor LLM citations, information structuring for direct answers, and FAQ suggestions optimized for conversational queries. Our AI analyzes how ChatGPT, Gemini and Perplexity interpret your listing and suggests targeted improvements.',
        'Crawlers aplica los principios del GEO a su ficha GBP: descripciones con auto-citaciones de marca, estructuración de información para respuestas directas, y sugerencias de FAQ optimizadas para consultas conversacionales.'
      ),
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t3(language,
          'Google Business Profile (GMB) — Optimisation SEO Local & GEO | Crawlers.fr',
          'Google Business Profile (GMB) — Local SEO & GEO Optimization | Crawlers.fr',
          'Google Business Profile (GMB) — Optimización SEO Local & GEO | Crawlers.fr'
        )}</title>
        <meta name="description" content={t3(language,
          'Optimisez votre fiche Google Business Profile pour le SEO local et la visibilité IA (GEO). Score de complétude, benchmark concurrentiel, recommandations IA. Intégré à Crawlers.fr.',
          'Optimize your Google Business Profile for local SEO and AI visibility (GEO). Completeness score, competitive benchmark, AI recommendations. Integrated with Crawlers.fr.',
          'Optimice su Google Business Profile para SEO local y visibilidad IA (GEO). Score de completitud, benchmark competitivo, recomendaciones IA. Integrado con Crawlers.fr.'
        )} />
        <meta property="og:title" content="Google Business Profile — Optimisation SEO Local & GEO | Crawlers.fr" />
        <meta property="og:description" content="Analysez et optimisez votre fiche Google Business pour le SEO local et les moteurs IA. Score sur 42 critères, benchmark concurrent, recommandations GEO." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/google-business" />
        <link rel="canonical" href="https://crawlers.fr/google-business" />
      </Helmet>

      <Header />

      <main className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06),transparent_60%)]" />
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" /> SEO Local + GEO
                </Badge>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                  {t3(language,
                    'Optimisez votre fiche Google Business pour le SEO local et les moteurs IA',
                    'Optimize your Google Business listing for local SEO and AI engines',
                    'Optimice su ficha Google Business para SEO local y motores IA'
                  )}
                </h1>

                {/* GEO-optimized intro — first 150 words */}
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t3(language,
                    'Chez Crawlers, notre module Google Business Profile (GBP/GMB) analyse 42 critères de votre fiche d\'établissement et génère un score de complétude actionnable. En 2026, 67 % des requêtes locales passent par les moteurs génératifs (ChatGPT, Gemini, Perplexity) avant même d\'afficher le pack local Google. Notre approche unique combine le SEO local classique et le GEO (Generative Engine Optimization) pour maximiser votre visibilité sur les deux fronts. Benchmark concurrentiel automatique, recommandations IA ciblées, déploiement direct depuis la console — tout est intégré dans votre workflow d\'optimisation.',
                    'At Crawlers, our Google Business Profile (GBP/GMB) module analyzes 42 criteria of your business listing and generates an actionable completeness score. In 2026, 67% of local queries go through generative engines (ChatGPT, Gemini, Perplexity) before even showing the Google local pack. Our unique approach combines classic local SEO and GEO (Generative Engine Optimization) to maximize your visibility on both fronts.',
                    'En Crawlers, nuestro módulo Google Business Profile (GBP/GMB) analiza 42 criterios de su ficha de establecimiento y genera un score de completitud accionable. En 2026, el 67% de las consultas locales pasan por motores generativos antes de mostrar el pack local de Google.'
                  )}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="hero" size="lg">
                    <Link to="/auth?returnTo=/console">
                      {t3(language, 'Analyser ma fiche GBP', 'Analyze my GBP listing', 'Analizar mi ficha GBP')}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/tarifs">
                      {t3(language, 'Voir les tarifs', 'View pricing', 'Ver precios')}
                    </Link>
                  </Button>
                </div>
              </div>

              <div
              >
                <GmbConsolePreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {t3(language, 'Fonctionnalités du module Google Business', 'Google Business Module Features', 'Funcionalidades del módulo Google Business')}
              </h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                {t3(language,
                  'Un outil complet pour piloter votre visibilité locale, intégré nativement à vos audits SEO et GEO.',
                  'A complete tool to manage your local visibility, natively integrated with your SEO and GEO audits.',
                  'Una herramienta completa para gestionar su visibilidad local, integrada nativamente con sus auditorías SEO y GEO.'
                )}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <div
                  key={f.title}
                >
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-6 space-y-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <f.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why it matters ── */}
        <section className="py-16 md:py-24 border-t border-border bg-muted/20">
          <div className="mx-auto max-w-4xl px-4 text-center space-y-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {t3(language, 'Pourquoi optimiser votre fiche GBP en 2026 ?', 'Why optimize your GBP listing in 2026?', '¿Por qué optimizar su ficha GBP en 2026?')}
            </h2>

            <div className="grid sm:grid-cols-3 gap-6 text-left">
              {[
                {
                  icon: Search, stat: '46 %',
                  label: t3(language, 'des recherches Google ont une intention locale', 'of Google searches have local intent', 'de las búsquedas Google tienen intención local'),
                },
                {
                  icon: TrendingUp, stat: '67 %',
                  label: t3(language, 'des requêtes locales passent par un LLM en 2026', 'of local queries go through an LLM in 2026', 'de las consultas locales pasan por un LLM en 2026'),
                },
                {
                  icon: Award, stat: '3×',
                  label: t3(language, 'plus de clics pour les fiches GBP complètes', 'more clicks for complete GBP listings', 'más clics para fichas GBP completas'),
                },
              ].map(s => (
                <div key={s.stat} className="flex flex-col items-center gap-2 p-6 rounded-xl bg-card border border-border">
                  <s.icon className="h-6 w-6 text-primary" />
                  <span className="text-3xl font-bold text-foreground">{s.stat}</span>
                  <span className="text-sm text-muted-foreground text-center">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Crawlers manages GBP ── */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-4xl px-4 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
              {t3(language,
                'Pourquoi Crawlers intègre la gestion Google Business ?',
                'Why does Crawlers include Google Business management?',
                '¿Por qué Crawlers incluye la gestión de Google Business?'
              )}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t3(language,
                'Bien gérer sa fiche Google Business Profile, c\'est aujourd\'hui l\'un des meilleurs moyens de se rendre visible des moteurs IA. Les moteurs génératifs comme ChatGPT, Gemini ou Perplexity puisent directement dans les données structurées des fiches d\'établissement pour construire leurs réponses locales. Une fiche GBP complète, cohérente et régulièrement mise à jour améliore considérablement votre GEO (Generative Engine Optimization) — c\'est-à-dire votre capacité à apparaître dans les réponses générées par l\'IA, pas seulement dans les résultats classiques de Google.',
                'Managing your Google Business Profile well is now one of the best ways to become visible to AI engines. Generative engines like ChatGPT, Gemini and Perplexity pull directly from structured business listing data to build their local answers. A complete, consistent and regularly updated GBP listing dramatically improves your GEO (Generative Engine Optimization) — your ability to appear in AI-generated answers, not just traditional Google results.',
                'Gestionar bien su ficha Google Business Profile es hoy uno de los mejores medios para hacerse visible ante los motores IA. Los motores generativos como ChatGPT, Gemini o Perplexity extraen directamente de los datos estructurados de las fichas de establecimiento para construir sus respuestas locales. Una ficha GBP completa, coherente y actualizada regularmente mejora considerablemente su GEO (Generative Engine Optimization).'
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'C\'est pourquoi Crawlers a intégré nativement le pilotage de votre fiche GBP dans sa console : score de complétude sur 42 critères, benchmark concurrentiel automatique, recommandations IA ciblées et déploiement direct — le tout connecté à vos audits SEO, votre maillage interne et votre stratégie de contenu pour un effet de levier maximal.',
                'That\'s why Crawlers natively integrates GBP management into its console: completeness score across 42 criteria, automatic competitive benchmarking, targeted AI recommendations and direct deployment — all connected to your SEO audits, internal linking and content strategy for maximum leverage.',
                'Por eso Crawlers ha integrado nativamente el pilotaje de su ficha GBP en su consola: score de completitud en 42 criterios, benchmark competitivo automático, recomendaciones IA dirigidas y despliegue directo — todo conectado a sus auditorías SEO, su enlazado interno y su estrategia de contenidos.'
              )}
            </p>
          </div>
        </section>

        {/* ── Competition ── */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {t3(language, 'Crawlers vs la concurrence', 'Crawlers vs the competition', 'Crawlers vs la competencia')}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {t3(language,
                  'Les outils de gestion GMB existants ne couvrent ni le SEO on-page, ni la visibilité IA.',
                  'Existing GMB management tools cover neither on-page SEO nor AI visibility.',
                  'Las herramientas de gestión GMB existentes no cubren ni el SEO on-page ni la visibilidad IA.'
                )}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 text-left font-semibold text-foreground">{t3(language, 'Outil', 'Tool', 'Herramienta')}</th>
                    <th className="py-3 px-4 text-left font-semibold text-foreground">{t3(language, 'Prix', 'Price', 'Precio')}</th>
                    <th className="py-3 px-4 text-left font-semibold text-foreground">{t3(language, 'Limites', 'Limitations', 'Limitaciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map(c => (
                    <tr key={c.name} className="border-b border-border/50">
                      <td className="py-3 px-4 text-foreground font-medium">{c.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{c.price}</td>
                      <td className="py-3 px-4 text-muted-foreground">{c.limits}</td>
                    </tr>
                  ))}
                  <tr className="bg-primary/5">
                    <td className="py-3 px-4 font-bold text-primary">Crawlers.fr</td>
                    <td className="py-3 px-4 text-foreground font-medium">
                      {t3(language, 'Inclus dans Pro Agency+ (79 €/mois)', 'Included in Pro Agency+ (€79/month)', 'Incluido en Pro Agency+ (79 €/mes)')}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {t3(language,
                        'SEO local + GEO + audits on-page + maillage + contenu en un seul outil',
                        'Local SEO + GEO + on-page audits + linking + content in one tool',
                        'SEO local + GEO + auditorías on-page + enlazado + contenido en una sola herramienta'
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <PricingPlansSection
          title={t3(language, 'Tarification', 'Pricing', 'Precios')}
        />

        {/* ── FAQ (Schema.org FAQPage) ── */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
              {t3(language, 'Questions fréquentes', 'Frequently Asked Questions', 'Preguntas frecuentes')}
            </h2>
            <div className="space-y-6">
              {faqItems.map((item, i) => (
                <details key={i} className="group rounded-lg border border-border bg-card overflow-hidden">
                  <summary className="cursor-pointer px-5 py-4 font-medium text-foreground hover:bg-muted/30 transition-colors">
                    {item.q}
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-16 border-t border-border bg-primary/5">
          <div className="mx-auto max-w-3xl px-4 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {t3(language,
                'Prêt à optimiser votre fiche Google Business ?',
                'Ready to optimize your Google Business listing?',
                '¿Listo para optimizar su ficha Google Business?'
              )}
            </h2>
            <p className="text-muted-foreground">
              {t3(language,
                'Connectez votre fiche GBP en 30 secondes et obtenez votre score de complétude instantanément.',
                'Connect your GBP listing in 30 seconds and get your completeness score instantly.',
                'Conecte su ficha GBP en 30 segundos y obtenga su score de completitud instantáneamente.'
              )}
            </p>
            <Button asChild variant="hero" size="xl">
              <Link to="/auth?returnTo=/console">
                {t3(language, 'Analyser ma fiche GBP gratuitement', 'Analyze my GBP listing for free', 'Analizar mi ficha GBP gratis')}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>

      {/* JSON-LD: FAQPage + SoftwareApplication */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqItems.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": { "@type": "Answer", "text": item.a }
        }))
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Crawlers.fr — Google Business Optimizer",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://crawlers.fr/google-business",
        "description": "Optimisez votre fiche Google Business Profile pour le SEO local et la visibilité dans les moteurs IA (GEO). Score de complétude sur 42 critères, benchmark concurrentiel, recommandations IA.",
        "offers": {
          "@type": "Offer",
          "price": "79",
          "priceCurrency": "EUR",
          "description": "Inclus dans l'abonnement Pro Agency+ à 79 €/mois"
        }
      })}} />
    </>
  );
}
