import { lazy, Suspense } from 'react';
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Network, TrendingUp, Eye, Zap, Globe, Brain, ArrowRight, Shield,
  BarChart3, Target, Link2, FileText, MessageSquare, Layers, RefreshCw,
  Search, CheckCircle2, GitBranch, Workflow, PenTool
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import cocoonGraph from '@/assets/screenshots/crawlers.fr_cocon-semantique-3d-maillage-interne.webp';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const i18n = {
  fr: {
    title: "Cocoon — Architecte de Cocon Sémantique IA | Crawlers.fr",
    metaDesc: "Visualisation 3D du maillage interne, détection de cannibalisation, auto-maillage IA, clustering sémantique, ROI prédictif et optimisation GEO pour les moteurs IA.",
    badge: "Module Pro Agency",
    heroTitle1: "Votre site est un ",
    heroHighlight: "organisme vivant",
    heroDesc: "Le module Cocoon transforme votre audit sémantique en une visualisation interactive où chaque page pulse au rythme de son trafic, chaque lien révèle la force de votre maillage. Algorithme de graphe orienté pondéré, détection de cannibalisation, auto-maillage IA et stratège conversationnel — tout ce dont vous avez besoin pour dominer le SEO et le GEO.",
    accessCocoon: "Accéder au Cocoon",
    discoverPro: "Découvrir Pro Agency",

    screenshotAlt: "Visualisation 3D du cocon sémantique — maillage interne et clusters thématiques",
    screenshotCaption: "Vue 3D interactive : chaque nœud représente une page, chaque lien une connexion sémantique pondérée.",

    geoTitle: "Pourquoi le ",
    geoHighlight: "GEO",
    geoTitleEnd: " dépasse le SEO classique",
    geoDesc: "Les moteurs génératifs ne cherchent pas des mots-clés — ils cherchent des réponses citables. Le Cocoon optimise votre architecture pour les deux mondes.",
    geoClassicLabel: "SEO Classique",
    geoClassicValue: "Mots-clés",
    geoClassicDesc: "Optimise pour des requêtes textuelles dans Google",
    geoCocoonLabel: "GEO (Cocoon)",
    geoCocoonValue: "Intentions",
    geoCocoonDesc: "Optimise pour la citabilité par les IA génératives",

    techTitle: "Comment fonctionne le ",
    techHighlight: "moteur Cocoon",
    techSteps: [
      { title: "Crawl & Graphe orienté", desc: "Le moteur crawle votre site et construit un graphe orienté pondéré. Chaque lien est scoré par similarité cosinus pour mesurer la pertinence sémantique réelle de chaque connexion." },
      { title: "Détection de cannibalisation", desc: "Priorité critique (x9) : le moteur identifie les pages qui se cannibalisent sémantiquement et structurellement via Gemini. La cannibalisation bloque toute suggestion de maillage tant qu'elle n'est pas résolue." },
      { title: "Clustering automatique", desc: "L'IA regroupe vos pages par proximité sémantique pour révéler la structure naturelle de votre contenu et identifier les silos thématiques." },
      { title: "Prescriptions & Déploiement", desc: "Chaque recommandation inclut des prescriptions visuelles (style, placement). Le déploiement se fait en un clic via les APIs CMS connectées." },
    ],

    engineTitle1: "Un moteur d'analyse ",
    engineHighlight: "complet",
    features: [
      { title: "Visualisation 3D & Radiale", description: "Deux vues complémentaires : graphe 3D interactif et vue radiale avec flux de juice (Or = descendant, Bleu = ascendant). Chaque page pulse au rythme de son trafic." },
      { title: "Détection de cannibalisation", description: "Priorité critique (x9). Détection sémantique et structurelle via Gemini. Bloque automatiquement toute suggestion de maillage tant que le conflit n'est pas résolu." },
      { title: "Auto-maillage IA en batch", description: "cocoon-bulk-auto-linking identifie des ancres sémantiques cohérentes (2-5 mots), injecte des liens contextuels via les APIs CMS. Maximum 1 lien par source vers une même destination." },
      { title: "GSC Gap Analysis", description: "Identifie les mots-clés positionnés 11-30 absents du texte de vos pages et déploie les corrections via cms-patch-content pour capturer le trafic manqué." },
      { title: "Algorithme Iab (Anti-Wiki)", description: "Identifiez automatiquement les pages où vous pouvez surpasser Wikipedia et les sites d'autorité dans les SERP et les réponses IA." },
      { title: "ROI Prédictif par Page", description: "Chaque nœud affiche une prédiction de ROI annualisé basée sur le CPC, le volume de recherche et le potentiel de conversion." },
      { title: "Score GEO & Citabilité LLM", description: "Mesurez la probabilité que ChatGPT, Gemini et Perplexity citent chacune de vos pages dans leurs réponses." },
      { title: "Mode X-Ray", description: "Révélez les pages fantômes à faible trafic, les orphelins détectés par BFS et les opportunités de contenu inexploitées." },
      { title: "Stratège conversationnel", description: "Un stratège IA qui vous tutoie, mémorise votre contexte et guide vos décisions de maillage avec des recommandations actionnables." },
      { title: "Content Architect intégré", description: "Générez des pages SEO complètes directement depuis le Cocoon : structure, balisage Schema.org, images et publication CMS en un clic." },
      { title: "Traçabilité & Rollback", description: "Chaque lien injecté est tracé (anchor_text, context_sentence). Rollback en un clic sur toutes les modifications batch." },
      { title: "Connexion CMS native", description: "WordPress, Shopify, Webflow, Prestashop — connexion directe pour déployer les corrections et le contenu sans quitter Crawlers." },
    ],

    ctaTitle: "Prêt à révéler la structure cachée de votre site ?",
    ctaDesc: "Inclus dans l'abonnement Pro Agency à 29€/mois. Accès illimité à l'Architecte de Cocon, aux analyses GEO, au Content Architect et à toutes les fonctionnalités premium.",
    ctaButton: "Lancer mon Cocoon",
  },
  en: {
    title: "Cocoon — AI Semantic Cocoon Architect | Crawlers.fr",
    metaDesc: "3D internal linking visualization, cannibalization detection, AI auto-linking, semantic clustering, predictive ROI and GEO optimization for AI engines.",
    badge: "Pro Agency Module",
    heroTitle1: "Your site is a ",
    heroHighlight: "living organism",
    heroDesc: "The Cocoon module transforms your semantic audit into an interactive visualization where each page pulses to the rhythm of its traffic, each link reveals the strength of your internal linking. Weighted directed graph algorithm, cannibalization detection, AI auto-linking and conversational strategist — everything you need to dominate SEO and GEO.",
    accessCocoon: "Access Cocoon",
    discoverPro: "Discover Pro Agency",

    screenshotAlt: "3D semantic cocoon visualization — internal linking and thematic clusters",
    screenshotCaption: "Interactive 3D view: each node represents a page, each link a weighted semantic connection.",

    geoTitle: "Why ",
    geoHighlight: "GEO",
    geoTitleEnd: " goes beyond traditional SEO",
    geoDesc: "Generative engines don't look for keywords — they look for citable answers. Cocoon optimizes your architecture for both worlds.",
    geoClassicLabel: "Traditional SEO",
    geoClassicValue: "Keywords",
    geoClassicDesc: "Optimizes for text queries in Google",
    geoCocoonLabel: "GEO (Cocoon)",
    geoCocoonValue: "Intents",
    geoCocoonDesc: "Optimizes for citability by generative AI",

    techTitle: "How the ",
    techHighlight: "Cocoon engine",
    techSteps: [
      { title: "Crawl & Directed Graph", desc: "The engine crawls your site and builds a weighted directed graph. Each link is scored by cosine similarity to measure the actual semantic relevance of each connection." },
      { title: "Cannibalization Detection", desc: "Critical priority (x9): the engine identifies pages that cannibalize each other semantically and structurally via Gemini. Cannibalization blocks all linking suggestions until resolved." },
      { title: "Automatic Clustering", desc: "AI groups your pages by semantic proximity to reveal the natural structure of your content and identify thematic silos." },
      { title: "Prescriptions & Deployment", desc: "Each recommendation includes visual prescriptions (style, placement). Deployment is one-click via connected CMS APIs." },
    ],

    engineTitle1: "A ",
    engineHighlight: "complete",
    features: [
      { title: "3D & Radial Visualization", description: "Two complementary views: interactive 3D graph and radial view with juice flow (Gold = descendant, Blue = ascendant). Each page pulses to the rhythm of its traffic." },
      { title: "Cannibalization Detection", description: "Critical priority (x9). Semantic and structural detection via Gemini. Automatically blocks any linking suggestion until the conflict is resolved." },
      { title: "AI Batch Auto-Linking", description: "cocoon-bulk-auto-linking identifies coherent semantic anchors (2-5 words), injects contextual links via CMS APIs. Maximum 1 link per source to same destination." },
      { title: "GSC Gap Analysis", description: "Identifies keywords ranked 11-30 missing from your page text and deploys corrections via cms-patch-content to capture missed traffic." },
      { title: "Iab Algorithm (Anti-Wiki)", description: "Automatically identify pages where you can outrank Wikipedia and authority sites in SERPs and AI responses." },
      { title: "Predictive ROI per Page", description: "Each node displays an annualized ROI prediction based on CPC, search volume and conversion potential." },
      { title: "GEO Score & LLM Citability", description: "Measure the probability that ChatGPT, Gemini and Perplexity cite each of your pages in their responses." },
      { title: "X-Ray Mode", description: "Reveal ghost pages with low traffic, orphans detected by BFS and untapped content opportunities." },
      { title: "Conversational Strategist", description: "An AI strategist that remembers your context and guides your linking decisions with actionable recommendations." },
      { title: "Integrated Content Architect", description: "Generate complete SEO pages directly from the Cocoon: structure, Schema.org markup, images and CMS publishing in one click." },
      { title: "Traceability & Rollback", description: "Every injected link is traced (anchor_text, context_sentence). One-click rollback on all batch modifications." },
      { title: "Native CMS Connection", description: "WordPress, Shopify, Webflow, Prestashop — direct connection to deploy corrections and content without leaving Crawlers." },
    ],

    ctaTitle: "Ready to reveal your site's hidden structure?",
    ctaDesc: "Included in the Pro Agency subscription at €29/month. Unlimited access to the Cocoon Architect, GEO analysis, Content Architect and all premium features.",
    ctaButton: "Launch my Cocoon",
  },
  es: {
    title: "Cocoon — Arquitecto de Cocoon Semántico IA | Crawlers.fr",
    metaDesc: "Visualización 3D del enlazado interno, detección de canibalización, auto-enlazado IA, clustering semántico, ROI predictivo y optimización GEO para motores IA.",
    badge: "Módulo Pro Agency",
    heroTitle1: "Su sitio es un ",
    heroHighlight: "organismo vivo",
    heroDesc: "El módulo Cocoon transforma su auditoría semántica en una visualización interactiva donde cada página pulsa al ritmo de su tráfico, cada enlace revela la fuerza de su enlazado. Algoritmo de grafos dirigidos ponderados, detección de canibalización, auto-enlazado IA y estratega conversacional — todo lo que necesita para dominar el SEO y el GEO.",
    accessCocoon: "Acceder al Cocoon",
    discoverPro: "Descubrir Pro Agency",

    screenshotAlt: "Visualización 3D del cocoon semántico — enlazado interno y clusters temáticos",
    screenshotCaption: "Vista 3D interactiva: cada nodo representa una página, cada enlace una conexión semántica ponderada.",

    geoTitle: "Por qué el ",
    geoHighlight: "GEO",
    geoTitleEnd: " supera al SEO clásico",
    geoDesc: "Los motores generativos no buscan palabras clave — buscan respuestas citables. Cocoon optimiza su arquitectura para ambos mundos.",
    geoClassicLabel: "SEO Clásico",
    geoClassicValue: "Palabras clave",
    geoClassicDesc: "Optimiza para consultas textuales en Google",
    geoCocoonLabel: "GEO (Cocoon)",
    geoCocoonValue: "Intenciones",
    geoCocoonDesc: "Optimiza para la citabilidad por IA generativa",

    techTitle: "Cómo funciona el ",
    techHighlight: "motor Cocoon",
    techSteps: [
      { title: "Crawl & Grafo dirigido", desc: "El motor rastrea su sitio y construye un grafo dirigido ponderado. Cada enlace se puntúa por similitud coseno para medir la relevancia semántica real de cada conexión." },
      { title: "Detección de canibalización", desc: "Prioridad crítica (x9): el motor identifica las páginas que se canibalizan semántica y estructuralmente vía Gemini. La canibalización bloquea toda sugerencia de enlazado hasta que se resuelva." },
      { title: "Clustering automático", desc: "La IA agrupa sus páginas por proximidad semántica para revelar la estructura natural de su contenido e identificar los silos temáticos." },
      { title: "Prescripciones & Despliegue", desc: "Cada recomendación incluye prescripciones visuales (estilo, ubicación). El despliegue se hace en un clic vía las APIs CMS conectadas." },
    ],

    engineTitle1: "Un motor de análisis ",
    engineHighlight: "completo",
    features: [
      { title: "Visualización 3D & Radial", description: "Dos vistas complementarias: grafo 3D interactivo y vista radial con flujo de juice (Oro = descendente, Azul = ascendente). Cada página pulsa al ritmo de su tráfico." },
      { title: "Detección de canibalización", description: "Prioridad crítica (x9). Detección semántica y estructural vía Gemini. Bloquea automáticamente toda sugerencia de enlazado hasta que el conflicto se resuelva." },
      { title: "Auto-enlazado IA en batch", description: "cocoon-bulk-auto-linking identifica anclas semánticas coherentes (2-5 palabras), inyecta enlaces contextuales vía APIs CMS. Máximo 1 enlace por fuente hacia un mismo destino." },
      { title: "GSC Gap Analysis", description: "Identifica las palabras clave posicionadas 11-30 ausentes del texto de sus páginas y despliega las correcciones vía cms-patch-content." },
      { title: "Algoritmo Iab (Anti-Wiki)", description: "Identifique automáticamente las páginas donde puede superar a Wikipedia y los sitios de autoridad en las SERP y respuestas IA." },
      { title: "ROI Predictivo por Página", description: "Cada nodo muestra una predicción de ROI anualizado basada en el CPC, el volumen de búsqueda y el potencial de conversión." },
      { title: "Score GEO & Citabilidad LLM", description: "Mida la probabilidad de que ChatGPT, Gemini y Perplexity citen cada una de sus páginas en sus respuestas." },
      { title: "Modo X-Ray", description: "Revele las páginas fantasma con bajo tráfico, los huérfanos detectados por BFS y oportunidades de contenido inexploradas." },
      { title: "Estratega conversacional", description: "Un estratega IA que memoriza su contexto y guía sus decisiones de enlazado con recomendaciones accionables." },
      { title: "Content Architect integrado", description: "Genere páginas SEO completas directamente desde el Cocoon: estructura, Schema.org, imágenes y publicación CMS en un clic." },
      { title: "Trazabilidad & Rollback", description: "Cada enlace inyectado es trazado (anchor_text, context_sentence). Rollback en un clic sobre todas las modificaciones batch." },
      { title: "Conexión CMS nativa", description: "WordPress, Shopify, Webflow, Prestashop — conexión directa para desplegar correcciones y contenido sin salir de Crawlers." },
    ],

    ctaTitle: "¿Listo para revelar la estructura oculta de su sitio?",
    ctaDesc: "Incluido en la suscripción Pro Agency a 29€/mes. Acceso ilimitado al Arquitecto de Cocoon, análisis GEO, Content Architect y todas las funcionalidades premium.",
    ctaButton: "Lanzar mi Cocoon",
  },
};

const featureIcons = [
  Network, Shield, Link2, Search, Brain, TrendingUp,
  Globe, Eye, MessageSquare, PenTool, RefreshCw, Layers
];

const techIcons = [GitBranch, Shield, Workflow, CheckCircle2];

export default function FeaturesCocoon() {
  const { language } = useLanguage();
  useCanonicalHreflang('/cocoon');
  const t = i18n[language] || i18n.fr;

  return (
    <>
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
      </Helmet>

      <Header />

      <main className="min-h-screen bg-[#0f0a1e]">
        {/* Hero */}
        <section className="relative overflow-hidden py-24 px-4">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4c1d95]/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#fbbf24]/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4c1d95]/30 border border-[#4c1d95]/20 text-sm text-[#a78bfa]">
              <Network className="w-4 h-4" />
              {t.badge}
            </div>

            <h1 className="text-4xl md:text-6xl font-bold font-display text-white leading-tight">
              {t.heroTitle1}
              <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">
                {t.heroHighlight}
              </span>
            </h1>

            <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">{t.heroDesc}</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/app/cocoon">
                <Button size="lg" className="bg-[#4c1d95] hover:bg-[#5b21b6] text-white px-8 py-6 text-base gap-2">
                  <Network className="w-5 h-5" />
                  {t.accessCocoon}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/pro-agency">
                <Button variant="outline" size="lg" className="border-[#fbbf24]/30 text-[#fbbf24] hover:bg-[#fbbf24]/10 px-8 py-6 text-base">
                  {t.discoverPro}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Screenshot */}
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden border border-[#4c1d95]/30 shadow-2xl shadow-[#4c1d95]/10">
              <img
                src={cocoonGraph}
                alt={t.screenshotAlt}
                width={1440}
                height={810}
                className="w-full h-auto"
                loading="eager"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a1e]/60 via-transparent to-transparent pointer-events-none" />
            </div>
            <p className="text-center text-sm text-white/30 mt-4">{t.screenshotCaption}</p>
          </div>
        </section>

        {/* GEO vs SEO */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">
                {t.geoTitle}<span className="text-[#fbbf24]">{t.geoHighlight}</span>{t.geoTitleEnd}
              </h2>
              <p className="text-white/50 max-w-xl mx-auto">{t.geoDesc}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { label: t.geoClassicLabel, value: t.geoClassicValue, desc: t.geoClassicDesc, highlight: false },
                { label: t.geoCocoonLabel, value: t.geoCocoonValue, desc: t.geoCocoonDesc, highlight: true },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`p-6 rounded-xl border ${
                    item.highlight
                      ? "border-[#fbbf24]/30 bg-gradient-to-br from-[#4c1d95]/20 to-[#fbbf24]/5"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {!item.highlight ? (
                      <Target className="w-5 h-5 text-white/40" />
                    ) : (
                      <Zap className="w-5 h-5 text-[#fbbf24]" />
                    )}
                    <h3 className={`font-semibold ${item.highlight ? "text-[#fbbf24]" : "text-white/70"}`}>
                      {item.label}
                    </h3>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{item.value}</p>
                  <p className="text-sm text-white/40">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">
                {t.techTitle}<span className="text-[#a78bfa]">{t.techHighlight}</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {t.techSteps.map((step, i) => {
                const Icon = techIcons[i];
                return (
                  <div key={i} className="relative p-6 rounded-xl border border-[hsl(263,70%,15%)] bg-[#0f0a1e]/80">
                    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#4c1d95] flex items-center justify-center text-sm font-bold text-white">
                      {i + 1}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5 text-[#fbbf24]" />
                      <h3 className="font-semibold text-white">{step.title}</h3>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white font-display">
                {t.engineTitle1}<span className="text-[#a78bfa]">{t.engineHighlight}</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {t.features.map((f, i) => {
                const Icon = featureIcons[i];
                return (
                  <div
                    key={i}
                    className="p-6 rounded-xl border border-[hsl(263,70%,15%)] bg-[#0f0a1e]/80 hover:border-[#4c1d95]/40 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#4c1d95]/20 flex items-center justify-center mb-4 group-hover:bg-[#4c1d95]/30 transition-colors">
                      <Icon className="w-5 h-5 text-[#fbbf24]" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Saturation Intelligence (weekly) */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white font-display">
                Cocoon vivant — <span className="text-[#fbbf24]">rafraîchissement hebdomadaire</span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                Tous les dimanches, le cocoon se recalcule automatiquement et son cache CMS est synchronisé.
                Une analyse LLM ciblée mesure ensuite la saturation thématique des clusters prioritaires
                pour orienter la production éditoriale vers les vrais gaps.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { time: '02:00 UTC', title: 'Cocoon refresh', desc: 'Recalcul du graphe orienté pondéré, détection de nouvelles cannibalisations, mise à jour des clusters.' },
                { time: '03:00 UTC', title: 'CMS cache refresh', desc: 'Synchronisation WordPress, Shopify, IKtracker, Drupal, Odoo, PrestaShop pour disposer du contenu à jour.' },
                { time: '04:00 UTC', title: 'Saturation LLM', desc: 'Top 5 clusters prioritaires uniquement (spiral_score ≥ 50). Gemini 3 Flash extrait les angles, Gemini 2.5 Pro synthétise score + gaps.' },
              ].map((j, i) => (
                <div key={j.title} className="p-6 rounded-xl border border-[hsl(263,70%,15%)] bg-[#0f0a1e]/80">
                  <div className="text-xs font-mono text-[#a78bfa] mb-2">{j.time}</div>
                  <h3 className="font-semibold text-white mb-2">Job {i + 1} — {j.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{j.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/5">
              <p className="text-[#fbbf24] font-semibold mb-2">Économie d'échelle</p>
              <p className="text-sm text-white/60 leading-relaxed">
                L'analyse LLM ne tourne que sur les clusters flaggés prioritaires par le scoring local et le moteur cocoon —
                coût moyen <strong className="text-white">~0,09 €/site/semaine</strong>. Le snapshot est injecté dans le Stage 0
                du pipeline éditorial pour éviter de publier un contenu sur un angle déjà saturé.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4c1d95] to-[#fbbf24]/20 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-[#fbbf24]" />
            </div>
            <h2 className="text-3xl font-bold text-white font-display">{t.ctaTitle}</h2>
            <p className="text-white/50">{t.ctaDesc}</p>
            <Link to="/app/cocoon">
              <Button size="lg" className="bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-bold px-10 py-6 text-base gap-2">
                {t.ctaButton}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </>
  );
}
