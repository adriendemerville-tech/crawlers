import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { FAQSection } from '@/components/FAQSection';
import { GEOFAQSection } from '@/components/GEOFAQSection';
import { lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

import { t3 } from '@/utils/i18n';

export default function Faq() {
  const { language } = useLanguage();
  useCanonicalHreflang('/faq');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>FAQ Crawlers.fr — Questions fréquentes SEO & GEO | Crawlers.fr</title>
        <meta name="description" content="FAQ Crawlers.fr — toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits, le plan Pro Agency et l'intégration technique." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/faq" />
        <meta property="og:title" content="FAQ Crawlers.fr — Questions fréquentes SEO & GEO | Crawlers.fr" />
        <meta property="og:description" content="FAQ Crawlers.fr — toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits, le plan Pro Agency et l'intégration technique." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="FAQ Crawlers.fr — Questions fréquentes SEO & GEO | Crawlers.fr" />
        <meta name="twitter:description" content="FAQ Crawlers.fr — toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits, le plan Pro Agency et l'intégration technique." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Qu'est-ce que Crawlers.fr ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crawlers.fr est la première plateforme francophone combinant audit SEO technique, GEO Score, visibilité LLM et génération de correctifs actionnables en un seul outil. Lancée en mars 2026, elle s'adresse aux agences SEO, freelances et PME."
              }
            },
            {
              "@type": "Question",
              "name": "Quelle est la différence entre SEO et GEO ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Le SEO optimise la visibilité sur les moteurs de recherche traditionnels comme Google. Le GEO (Generative Engine Optimization) optimise la visibilité dans les moteurs de réponse IA comme ChatGPT, Perplexity et Gemini. Crawlers.fr couvre les deux simultanément."
              }
            },
            {
              "@type": "Question",
              "name": "Crawlers.fr est-il gratuit ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Oui, partiellement. Les outils Bots IA, Score GEO, Visibilité LLM et PageSpeed sont gratuits sans inscription. L'audit technique SEO 200 points est gratuit avec inscription. Le plan Pro Agency est à 29€/mois, garanti à vie pour les 100 premiers abonnés."
              }
            },
            {
              "@type": "Question",
              "name": "Crawlers.fr est-il un simple wrapper GPT ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Non. Crawlers.fr est une infrastructure serverless de plus de 150 000 lignes de code avec 7 algorithmes propriétaires, un système multi-fallback sur toutes les APIs critiques, et une architecture sécurisée RGPD native. Ce n'est pas un wrapper IA."
              }
            },
            {
              "@type": "Question",
              "name": "Quels LLMs Crawlers.fr interroge-t-il ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crawlers.fr interroge simultanément ChatGPT, Gemini, Perplexity et Claude pour calculer votre score de visibilité LLM et votre Part de Voix dans les moteurs de réponse IA."
              }
            }
          ]
        })}</script>
      </Helmet>
      <Header />
      <main className="flex-1 pt-20">
        <FAQSection />
        <GEOFAQSection />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
