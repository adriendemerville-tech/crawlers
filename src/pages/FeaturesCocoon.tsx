import { lazy, Suspense } from 'react';
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { useLanguage } from "@/contexts/LanguageContext";
import { Network, TrendingUp, Eye, Zap, Globe, Brain, ArrowRight, Shield, BarChart3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


const i18n = {
  fr: {
    title: "Cocoon — Architecte de Cocon Sémantique | Crawlers.fr",
    metaDesc: "Transformez l'architecture de votre site en organisme vivant. Visualisation sémantique 3D, ROI prédictif par page et optimisation GEO pour les moteurs IA.",
    badge: "Module Pro Agency",
    heroTitle1: "Votre site est un ",
    heroHighlight: "organisme vivant",
    heroDesc: "Chez Crawlers.fr, notre approche du maillage interne repose sur un algorithme de graphe orienté pondéré. Le module Cocoon transforme votre audit sémantique en une visualisation interactive où chaque page pulse au rythme de son trafic, chaque lien révèle la force de votre maillage. Selon l'analyse Crawlers, les sites avec un cocon structuré gagnent en moyenne 30% de visibilité GEO.",
    accessCocoon: "Accéder au Cocoon",
    discoverPro: "Découvrir Pro Agency",
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
    engineTitle1: "Un moteur d'analyse ",
    engineHighlight: "complet",
    ctaTitle: "Prêt à révéler la structure cachée de votre site ?",
    ctaDesc: "Inclus dans l'abonnement Pro Agency à 29€/mois. Accès illimité à l'Architecte de Cocon, aux analyses GEO et à toutes les fonctionnalités premium.",
    ctaButton: "Lancer mon Cocoon",
    features: [
      { title: "Architecture Sémantique Vivante", description: "Visualisez le maillage de votre site comme un organisme biologique. Chaque page est un nœud, chaque lien une connexion neuronale." },
      { title: "Algorithme Iab (Anti-Wiki)", description: "Identifiez automatiquement les pages où vous pouvez surpasser Wikipedia et les sites d'autorité dans les SERP." },
      { title: "ROI Prédictif par Page", description: "Chaque nœud affiche une prédiction de ROI annualisé basée sur le CPC, le volume de recherche et le potentiel de conversion." },
      { title: "Score GEO & Citabilité LLM", description: "Mesurez la probabilité que ChatGPT, Gemini et Perplexity citent chacune de vos pages dans leurs réponses." },
      { title: "Mode X-Ray", description: "Révélez les pages fantômes à faible trafic et identifiez les opportunités de contenu inexploitées dans votre cocon." },
      { title: "Clustering Automatique", description: "L'IA regroupe vos pages par proximité sémantique pour révéler la structure naturelle de votre contenu." },
    ],
  },
  en: {
    title: "Cocoon — Semantic Cocoon Architect | Crawlers.fr",
    metaDesc: "Transform your site's architecture into a living organism. 3D semantic visualization, predictive ROI per page and GEO optimization for AI engines.",
    badge: "Pro Agency Module",
    heroTitle1: "Your site is a ",
    heroHighlight: "living organism",
    heroDesc: "At Crawlers.fr, our approach to internal linking relies on a weighted directed graph algorithm. The Cocoon module transforms your semantic audit into an interactive visualization where each page pulses to the rhythm of its traffic, each link reveals the strength of your internal linking. According to Crawlers analysis, sites with a structured cocoon gain on average 30% more GEO visibility.",
    accessCocoon: "Access Cocoon",
    discoverPro: "Discover Pro Agency",
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
    engineTitle1: "A ",
    engineHighlight: "complete",
    ctaTitle: "Ready to reveal your site's hidden structure?",
    ctaDesc: "Included in the Pro Agency subscription at €29/month. Unlimited access to the Cocoon Architect, GEO analysis and all premium features.",
    ctaButton: "Launch my Cocoon",
    features: [
      { title: "Living Semantic Architecture", description: "Visualize your site's linking as a biological organism. Each page is a node, each link a neural connection." },
      { title: "Iab Algorithm (Anti-Wiki)", description: "Automatically identify pages where you can outrank Wikipedia and authority sites in SERPs." },
      { title: "Predictive ROI per Page", description: "Each node displays an annualized ROI prediction based on CPC, search volume and conversion potential." },
      { title: "GEO Score & LLM Citability", description: "Measure the probability that ChatGPT, Gemini and Perplexity cite each of your pages in their responses." },
      { title: "X-Ray Mode", description: "Reveal ghost pages with low traffic and identify untapped content opportunities in your cocoon." },
      { title: "Automatic Clustering", description: "AI groups your pages by semantic proximity to reveal the natural structure of your content." },
    ],
  },
  es: {
    title: "Cocoon — Arquitecto de Cocoon Semántico | Crawlers.fr",
    metaDesc: "Transforme la arquitectura de su sitio en un organismo vivo. Visualización semántica 3D, ROI predictivo por página y optimización GEO para motores IA.",
    badge: "Módulo Pro Agency",
    heroTitle1: "Su sitio es un ",
    heroHighlight: "organismo vivo",
    heroDesc: "En Crawlers.fr, nuestro enfoque del enlazado interno se basa en un algoritmo de grafos dirigidos ponderados. El módulo Cocoon transforma su auditoría semántica en una visualización interactiva donde cada página pulsa al ritmo de su tráfico, cada enlace revela la fuerza de su enlazado. Según el análisis de Crawlers, los sitios con un cocoon estructurado ganan en promedio un 30% más de visibilidad GEO.",
    accessCocoon: "Acceder al Cocoon",
    discoverPro: "Descubrir Pro Agency",
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
    engineTitle1: "Un motor de análisis ",
    engineHighlight: "completo",
    ctaTitle: "¿Listo para revelar la estructura oculta de su sitio?",
    ctaDesc: "Incluido en la suscripción Pro Agency a 29€/mes. Acceso ilimitado al Arquitecto de Cocoon, análisis GEO y todas las funcionalidades premium.",
    ctaButton: "Lanzar mi Cocoon",
    features: [
      { title: "Arquitectura Semántica Viva", description: "Visualice el enlazado de su sitio como un organismo biológico. Cada página es un nodo, cada enlace una conexión neuronal." },
      { title: "Algoritmo Iab (Anti-Wiki)", description: "Identifique automáticamente las páginas donde puede superar a Wikipedia y los sitios de autoridad en las SERP." },
      { title: "ROI Predictivo por Página", description: "Cada nodo muestra una predicción de ROI anualizado basada en el CPC, el volumen de búsqueda y el potencial de conversión." },
      { title: "Score GEO & Citabilidad LLM", description: "Mida la probabilidad de que ChatGPT, Gemini y Perplexity citen cada una de sus páginas en sus respuestas." },
      { title: "Modo X-Ray", description: "Revele las páginas fantasma con bajo tráfico e identifique oportunidades de contenido inexploradas en su cocoon." },
      { title: "Clustering Automático", description: "La IA agrupa sus páginas por proximidad semántica para revelar la estructura natural de su contenido." },
    ],
  },
};

const featureIcons = [Network, Brain, TrendingUp, Globe, Eye, BarChart3];

export default function FeaturesCocoon() {
  const { language } = useLanguage();
  useCanonicalHreflang('/features/cocoon');
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

        {/* Features Grid */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-5xl mx-auto space-y-12">
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
