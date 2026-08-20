import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { PageEditorial } from '@/components/seo/PageEditorial';
import { ExpertAuditDashboard, ExpertAuditContent, ExpertAuditFAQ } from '@/components/ExpertAudit';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';

// Lazy load components
const NewsCarousel = lazy(() => import('@/components/NewsCarousel').then(m => ({ default: m.NewsCarousel })));

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

// FAQ data for Schema.org

const metaData = {
  fr: {
    title: "Audit SEO & GEO expert — check-up technique complet",
    description: "Audit SEO et GEO par un expert : Core Web Vitals, citabilité ChatGPT/Claude/Perplexity, JSON-LD et code correctif. Check-up en 2 min."
  },
  en: {
    title: "Technical & Strategic SEO/GEO Audit — Complete Check-up | Crawlers.fr",
    description: "Technical and strategic SEO and GEO audit: performance, Core Web Vitals, LLM citability (ChatGPT, Claude, Perplexity), JSON-LD structured data and custom corrective code. Complete check-up in 2 minutes."
  },
  es: {
    title: "Auditoría Técnica & Estratégica SEO/GEO — Check-up Completo | Crawlers.fr",
    description: "Auditoría técnica y estratégica de tu SEO y GEO: rendimiento, Core Web Vitals, citabilidad LLM (ChatGPT, Claude, Perplexity), datos estructurados JSON-LD y código correctivo personalizado. Check-up completo en 2 minutos."
  }
};

const ExpertAudit = () => {
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const { language } = useLanguage();
  const meta = metaData[language] || metaData.fr;

  // Fix canonical & hreflang for multilingual indexation
  useCanonicalHreflang('/audit-expert');



  // Force all links inside audit-expert to open in new tab
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      // Skip internal navigation anchors (hash links, javascript:)
      if (href.startsWith('#') || href.startsWith('javascript:')) return;
      // Force external opening
      if (href.startsWith('http') && !anchor.hasAttribute('target')) {
        e.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };

    const mainEl = document.querySelector('main[aria-label="Audit Expert SEO & IA"]');
    mainEl?.addEventListener('click', handleClick as EventListener);
    return () => {
      mainEl?.removeEventListener('click', handleClick as EventListener);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1" role="main" aria-label="Audit Expert SEO & IA">
        <ExpertAuditDashboard onLoadingChange={setIsAuditLoading} />
        {!isAuditLoading && (
          <>
            <Suspense fallback={<div className="h-96 animate-pulse bg-muted/30" />}>
              <NewsCarousel />
            </Suspense>
            <ExpertAuditContent />
            <ExpertAuditFAQ />
          </>
        )}
        <PageEditorial
          heading="Ce que couvre un audit expert SEO et GEO"
          intro="L'audit expert produit des constats vérifiables et le correctif associé. Cette section décrit son périmètre, ce qui reste du ressort humain, et comment lire la priorisation."
          citable="Un audit expert Crawlers.fr examine quatre plans sur une URL : accessibilité et statut technique, structure sémantique et unicité de l'intention, données structurées valides, et citabilité par les moteurs génératifs. Chaque constat est rattaché à une preuve extraite de la page servie."
          sections={[
            {
              title: 'Constat, cause racine, correctif',
              paragraphs: [
                "Un constat isolé ne sert à rien s'il ne remonte pas à sa cause. Un titre absent peut venir du modèle de page, d'une donnée manquante en base ou d'un rendu côté client : le correctif diffère radicalement selon le cas.",
                "C'est la raison pour laquelle l'audit compare systématiquement le HTML servi au rendu final avant de conclure sur la qualité du contenu.",
              ],
            },
            {
              title: 'Priorisation par impact, pas par volume',
              paragraphs: [
                "Une liste de deux cents remarques n'aide personne. La priorisation retient d'abord ce qui empêche l'indexation, ensuite ce qui dégrade la compréhension de la page, enfin ce qui relève de l'optimisation fine.",
              ],
              bullets: [
                "Bloquant : page non indexable, canonique contradictoire, statut HTTP anormal, contenu absent du HTML servi.",
                "Structurel : intention dupliquée entre deux URL, titre non distinctif, hiérarchie de titres incohérente.",
                "Amélioration : densité factuelle, passages citables, enrichissement des données structurées.",
              ],
            },
            {
              title: 'Ce qui reste humain',
              paragraphs: [
                "L'arbitrage commercial ne s'automatise pas : choisir la requête qui mérite une page, décider de fusionner deux contenus historiques, assumer un angle éditorial. L'audit supprime la collecte manuelle, pas la décision.",
              ],
            },
          ]}
        />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default ExpertAudit;
