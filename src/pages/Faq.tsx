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
        <title>{t3(language, 'FAQ - Crawlers AI | Questions fréquentes SEO & GEO', 'FAQ - Crawlers AI | Frequently Asked Questions', 'FAQ - Crawlers AI | Preguntas frecuentes')}</title>
        <meta name="description" content={t3(language, 'Toutes les réponses à vos questions sur les outils SEO, GEO et d\'analyse IA de Crawlers.fr.', 'All answers to your questions about Crawlers.fr SEO, GEO and AI analysis tools.', 'Todas las respuestas a sus preguntas sobre las herramientas SEO, GEO y de análisis IA de Crawlers.fr.')} />
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
