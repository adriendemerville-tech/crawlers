import { lazy, Suspense, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { ExpertAuditDashboard, ExpertAuditContent, ExpertAuditFAQ } from '@/components/ExpertAudit';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';

// Lazy load components
const NewsCarousel = lazy(() => import('@/components/NewsCarousel').then(m => ({ default: m.NewsCarousel })));

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

// FAQ data for Schema.org
const faqSchemaData = {
  fr: [
    { q: "Qu'est-ce que le Score SEO 200 et comment est-il calculé ?", a: "Le Score SEO 200 est un indicateur composite évaluant votre site sur 200 points répartis en 5 piliers : Performance (40 pts), Socle Technique (50 pts), Sémantique & Contenu (60 pts), Préparation IA & GEO (30 pts) et Santé/Sécurité (20 pts)." },
    { q: "Quelle est la différence entre SEO traditionnel et GEO ?", a: "Le SEO traditionnel optimise votre visibilité sur Google. Le GEO (Generative Engine Optimization) optimise votre contenu pour être cité par les moteurs de recherche génératifs comme ChatGPT, Claude et Perplexity." },
    { q: "Comment améliorer mon score de citabilité IA ?", a: "Ajoutez des données structurées Schema.org, créez du contenu factuel avec des statistiques, intégrez des tableaux comparatifs et optimisez votre robots.txt pour les crawlers IA." },
    { q: "Pourquoi les Core Web Vitals sont-ils importants pour l'IA ?", a: "Les Core Web Vitals impactent la capacité des IA à crawler votre contenu. Un site lent est moins bien analysé. Google intègre ces métriques dans son algorithme SGE." },
    { q: "Que signifie Préparation IA dans l'audit ?", a: "La section Préparation IA mesure si votre site est optimisé pour être compris et cité par les LLM. Elle vérifie les données structurées JSON-LD et l'accessibilité aux crawlers IA." },
    { q: "À quelle fréquence dois-je réaliser un audit SEO & IA ?", a: "Nous recommandons un audit mensuel pour les sites actifs et trimestriel pour les sites vitrines. Les algorithmes évoluent fréquemment." },
    { q: "Comment interpréter les requêtes de test LLM ?", a: "Les requêtes de test sont des prompts à soumettre à ChatGPT ou Claude pour vérifier si votre marque est citée. Si vous n'apparaissez pas, votre stratégie GEO nécessite des optimisations." },
    { q: "Le Score SEO 200 remplace-t-il un audit manuel ?", a: "Le Score SEO 200 est un diagnostic automatisé rapide qui complète un audit manuel en fournissant des données techniques précises et objectives." }
  ],
  en: [
    { q: "What is the SEO 200 Score and how is it calculated?", a: "The SEO 200 Score is a composite indicator evaluating your site on 200 points across 5 pillars: Performance (40 pts), Technical Foundation (50 pts), Semantics & Content (60 pts), AI & GEO Readiness (30 pts), and Health/Security (20 pts)." },
    { q: "What's the difference between traditional SEO and GEO?", a: "Traditional SEO optimizes visibility on Google. GEO (Generative Engine Optimization) optimizes content to be cited by generative search engines like ChatGPT, Claude, and Perplexity." },
    { q: "How can I improve my AI citability score?", a: "Add Schema.org structured data, create factual content with statistics, integrate comparative tables, and optimize your robots.txt for AI crawlers." },
    { q: "Why are Core Web Vitals important for AI?", a: "Core Web Vitals impact AI's ability to crawl your content. A slow site is poorly analyzed. Google integrates these metrics into its SGE algorithm." },
    { q: "What does AI Readiness mean in the audit?", a: "The AI Readiness section measures if your site is optimized to be understood and cited by LLMs. It verifies JSON-LD structured data and accessibility to AI crawlers." },
    { q: "How often should I perform an SEO & AI audit?", a: "We recommend monthly audits for active sites and quarterly for showcase sites. Algorithms evolve frequently." },
    { q: "How to interpret LLM test queries?", a: "Test queries are prompts to submit to ChatGPT or Claude to verify if your brand is cited. If you don't appear, your GEO strategy needs optimization." },
    { q: "Does the SEO 200 Score replace a manual audit?", a: "The SEO 200 Score is a quick automated diagnostic that complements a manual audit by providing precise and objective technical data." }
  ],
  es: [
    { q: "¿Qué es el Score SEO 200 y cómo se calcula?", a: "El Score SEO 200 es un indicador compuesto que evalúa tu sitio en 200 puntos en 5 pilares: Rendimiento (40 pts), Base Técnica (50 pts), Semántica y Contenido (60 pts), Preparación IA y GEO (30 pts) y Salud/Seguridad (20 pts)." },
    { q: "¿Cuál es la diferencia entre SEO tradicional y GEO?", a: "El SEO tradicional optimiza la visibilidad en Google. GEO (Generative Engine Optimization) optimiza el contenido para ser citado por motores de búsqueda generativos como ChatGPT, Claude y Perplexity." },
    { q: "¿Cómo mejorar mi puntuación de citabilidad IA?", a: "Agrega datos estructurados Schema.org, crea contenido factual con estadísticas, integra tablas comparativas y optimiza tu robots.txt para crawlers IA." },
    { q: "¿Por qué son importantes los Core Web Vitals para la IA?", a: "Los Core Web Vitals impactan la capacidad de la IA para rastrear tu contenido. Un sitio lento es mal analizado. Google integra estas métricas en su algoritmo SGE." },
    { q: "¿Qué significa Preparación IA en la auditoría?", a: "La sección Preparación IA mide si tu sitio está optimizado para ser comprendido y citado por LLMs. Verifica datos estructurados JSON-LD y accesibilidad a crawlers IA." },
    { q: "¿Con qué frecuencia debo realizar una auditoría SEO e IA?", a: "Recomendamos auditorías mensuales para sitios activos y trimestrales para sitios escaparate. Los algoritmos evolucionan frecuentemente." },
    { q: "¿Cómo interpretar las consultas de prueba LLM?", a: "Las consultas de prueba son prompts para enviar a ChatGPT o Claude para verificar si tu marca es citada. Si no apareces, tu estrategia GEO necesita optimización." },
    { q: "¿El Score SEO 200 reemplaza una auditoría manual?", a: "El Score SEO 200 es un diagnóstico automatizado rápido que complementa una auditoría manual proporcionando datos técnicos precisos y objetivos." }
  ]
};

const metaData = {
  fr: {
    title: "Audit Technique & Stratégique SEO/GEO — Check-up complet | Crawlers.fr",
    description: "Audit technique et stratégique de votre SEO et GEO : performance, Core Web Vitals, citabilité LLM (ChatGPT, Claude, Perplexity), données structurées JSON-LD et code correctif personnalisé. Check-up complet en 2 minutes."
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
  const { language } = useLanguage();
  const meta = metaData[language] || metaData.fr;
  const faqItems = faqSchemaData[language] || faqSchemaData.fr;

  // Fix canonical & hreflang for multilingual indexation
  useCanonicalHreflang('/audit-expert');

  useEffect(() => {
    // Update document title
    document.title = meta.title;

    // Update or create meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', meta.description);

    // Canonical is now managed by useCanonicalHreflang hook

    // Homepage FAQ schema is no longer in index.html - injected only on homepage via React

    // Create FAQ Schema.org JSON-LD
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map(item => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.a
        }
      }))
    };

    // Create WebPage Schema.org JSON-LD
    const webPageSchema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": meta.title,
      "description": meta.description,
      "url": "https://crawlers.fr/audit-expert",
      "inLanguage": language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      "isPartOf": {
        "@type": "WebSite",
        "name": "Crawlers.fr",
        "url": "https://crawlers.fr"
      },
      "about": {
        "name": "Audit Technique & Stratégique SEO/GEO",
        "applicationCategory": "WebApplication",
        "operatingSystem": "Web Browser",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "EUR"
        }
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
          { "@type": "ListItem", "position": 2, "name": "Audit Technique & Stratégique SEO/GEO", "item": "https://crawlers.fr/audit-expert" }
        ]
      }
    };

    // Remove existing schema scripts
    document.querySelectorAll('script[data-schema="expert-audit"]').forEach(el => el.remove());

    // Add FAQ Schema
    const faqScriptEl = document.createElement('script');
    faqScriptEl.type = 'application/ld+json';
    faqScriptEl.setAttribute('data-schema', 'expert-audit');
    faqScriptEl.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqScriptEl);

    // Add WebPage Schema
    const webPageScriptEl = document.createElement('script');
    webPageScriptEl.type = 'application/ld+json';
    webPageScriptEl.setAttribute('data-schema', 'expert-audit');
    webPageScriptEl.textContent = JSON.stringify(webPageSchema);
    document.head.appendChild(webPageScriptEl);

    // Cleanup on unmount
    return () => {
      document.querySelectorAll('script[data-schema="expert-audit"]').forEach(el => el.remove());
    };
  }, [language, meta, faqItems]);

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
      <Helmet>
        <title>Audit SEO expert 200 points + Score GEO gratuit | Crawlers.fr</title>
        <meta name="description" content="Audit SEO expert 200 points + Score GEO gratuit. Technique, sémantique, performance, visibilité IA. 7 algorithmes propriétaires. Résultats en 60 secondes." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/audit-expert" />
        <meta property="og:title" content="Audit SEO expert 200 points + Score GEO gratuit | Crawlers.fr" />
        <meta property="og:description" content="Audit SEO expert 200 points + Score GEO gratuit. Technique, sémantique, performance, visibilité IA. 7 algorithmes propriétaires. Résultats en 60 secondes." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Audit SEO expert 200 points + Score GEO gratuit | Crawlers.fr" />
        <meta name="twitter:description" content="Audit SEO expert 200 points + Score GEO gratuit. Technique, sémantique, performance, visibilité IA. 7 algorithmes propriétaires. Résultats en 60 secondes." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <Header />
      <main className="flex-1" role="main" aria-label="Audit Expert SEO & IA">
        <ExpertAuditDashboard />
        <Suspense fallback={<div className="h-96 animate-pulse bg-muted/30" />}>
          <NewsCarousel />
        </Suspense>
        <ExpertAuditContent />
        <ExpertAuditFAQ />
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default ExpertAudit;
