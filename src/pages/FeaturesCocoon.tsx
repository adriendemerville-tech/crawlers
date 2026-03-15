import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { Network, TrendingUp, Eye, Zap, Globe, Brain, ArrowRight, Shield, BarChart3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const features = [
  {
    icon: Network,
    title: "Architecture Sémantique Vivante",
    description: "Visualisez le maillage de votre site comme un organisme biologique. Chaque page est un nœud, chaque lien une connexion neuronale.",
  },
  {
    icon: Brain,
    title: "Algorithme Iab (Anti-Wiki)",
    description: "Identifiez automatiquement les pages où vous pouvez surpasser Wikipedia et les sites d'autorité dans les SERP.",
  },
  {
    icon: TrendingUp,
    title: "ROI Prédictif par Page",
    description: "Chaque nœud affiche une prédiction de ROI annualisé basée sur le CPC, le volume de recherche et le potentiel de conversion.",
  },
  {
    icon: Globe,
    title: "Score GEO & Citabilité LLM",
    description: "Mesurez la probabilité que ChatGPT, Gemini et Perplexity citent chacune de vos pages dans leurs réponses.",
  },
  {
    icon: Eye,
    title: "Mode X-Ray",
    description: "Révélez les pages fantômes à faible trafic et identifiez les opportunités de contenu inexploitées dans votre cocon.",
  },
  {
    icon: BarChart3,
    title: "Clustering Automatique",
    description: "L'IA regroupe vos pages par proximité sémantique pour révéler la structure naturelle de votre contenu.",
  },
];

const geoAdvantages = [
  { label: "SEO Classique", value: "Mots-clés", description: "Optimise pour des requêtes textuelles dans Google" },
  { label: "GEO (Cocoon)", value: "Intentions", description: "Optimise pour la citabilité par les IA génératives" },
];

export default function FeaturesCocoon() {
  useCanonicalHreflang('/features/cocoon');

  return (
    <>
      <Helmet>
        <title>Cocoon — Architecte de Cocon Sémantique | Crawlers.fr</title>
        <meta
          name="description"
          content="Transformez l'architecture de votre site en organisme vivant. Visualisation sémantique 3D, ROI prédictif par page et optimisation GEO pour les moteurs IA."
        />
      </Helmet>

      <Header />

      <main className="min-h-screen bg-[#0f0a1e]">
        {/* Hero */}
        <section className="relative overflow-hidden py-24 px-4">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4c1d95]/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#fbbf24]/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4c1d95]/30 border border-[#4c1d95]/20 text-sm text-[#a78bfa]">
              <Network className="w-4 h-4" />
              Module Pro Agency
            </div>

            <h1 className="text-4xl md:text-6xl font-bold font-display text-white leading-tight">
              Votre site est un{" "}
              <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">
                organisme vivant
              </span>
            </h1>

            <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
              Le module Cocoon transforme votre audit sémantique en une visualisation interactive.
              Chaque page pulse au rythme de son trafic, chaque lien révèle la force de votre maillage.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cocoon">
                <Button
                  size="lg"
                  className="bg-[#4c1d95] hover:bg-[#5b21b6] text-white px-8 py-6 text-base gap-2"
                >
                  <Network className="w-5 h-5" />
                  Accéder au Cocoon
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/pro-agency">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-[#fbbf24]/30 text-[#fbbf24] hover:bg-[#fbbf24]/10 px-8 py-6 text-base"
                >
                  Découvrir Pro Agency
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
                Pourquoi le <span className="text-[#fbbf24]">GEO</span> dépasse le SEO classique
              </h2>
              <p className="text-white/50 max-w-xl mx-auto">
                Les moteurs génératifs ne cherchent pas des mots-clés — ils cherchent des réponses citables.
                Le Cocoon optimise votre architecture pour les deux mondes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {geoAdvantages.map((item, i) => (
                <div
                  key={i}
                  className={`p-6 rounded-xl border ${
                    i === 1
                      ? "border-[#fbbf24]/30 bg-gradient-to-br from-[#4c1d95]/20 to-[#fbbf24]/5"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {i === 0 ? (
                      <Target className="w-5 h-5 text-white/40" />
                    ) : (
                      <Zap className="w-5 h-5 text-[#fbbf24]" />
                    )}
                    <h3 className={`font-semibold ${i === 1 ? "text-[#fbbf24]" : "text-white/70"}`}>
                      {item.label}
                    </h3>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{item.value}</p>
                  <p className="text-sm text-white/40">{item.description}</p>
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
                Un moteur d'analyse <span className="text-[#a78bfa]">complet</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-[hsl(263,70%,15%)] bg-[#0f0a1e]/80 hover:border-[#4c1d95]/40 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#4c1d95]/20 flex items-center justify-center mb-4 group-hover:bg-[#4c1d95]/30 transition-colors">
                    <f.icon className="w-5 h-5 text-[#fbbf24]" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 border-t border-[hsl(263,70%,15%)]">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4c1d95] to-[#fbbf24]/20 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-[#fbbf24]" />
            </div>
            <h2 className="text-3xl font-bold text-white font-display">
              Prêt à révéler la structure cachée de votre site ?
            </h2>
            <p className="text-white/50">
              Inclus dans l'abonnement Pro Agency à 59€/mois. Accès illimité à l'Architecte de Cocon,
              aux analyses GEO et à toutes les fonctionnalités premium.
            </p>
            <Link to="/cocoon">
              <Button
                size="lg"
                className="bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-bold px-10 py-6 text-base gap-2"
              >
                Lancer mon Cocoon
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
