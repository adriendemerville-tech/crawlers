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
      <Header />
      <main className="flex-1 pt-20">
        <header className="container mx-auto max-w-4xl px-4 pt-8 pb-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            FAQ Crawlers.fr — questions fréquentes SEO &amp; GEO
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits, le plan Pro Agency et l'intégration technique de Crawlers.fr.
          </p>
        </header>
        <FAQSection />
        <GEOFAQSection />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
