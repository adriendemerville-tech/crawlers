import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search, Layers, Brain, Target, CheckCircle2, FileText, BarChart3 } from 'lucide-react';
import { useEffect, lazy, Suspense} from 'react';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


export default function AuditSemantique() {
  const { language } = useLanguage();
  useCanonicalHreflang('/audit-semantique');

  const t = language === 'en' ? {
    title: 'Semantic SEO Audit — Analyze Your Content Depth | Crawlers.fr',
    metaDesc: 'Run a free semantic audit on your website. Evaluate content depth, keyword coverage, thematic gaps and E-E-A-T signals with Crawlers.fr AI engine.',
    h1: 'Semantic SEO Audit: Analyze Your Content Depth',
    intro: 'A semantic audit goes beyond technical SEO. It evaluates whether your content truly covers the topics your audience searches for — and whether AI answer engines like ChatGPT and Gemini can understand and cite your pages.',
    whatTitle: 'What Is a Semantic Audit?',
    whatText: 'A semantic audit analyzes the thematic depth and keyword coverage of your website. Unlike a technical audit (which checks code, speed, and structure), a semantic audit evaluates the quality, relevance and completeness of your content relative to your target queries.',
    whatItems: [
      'Keyword coverage analysis across your entire site',
      'Thematic gap detection — topics your competitors cover but you don\'t',
      'Content cannibalization identification between similar pages',
      'E-E-A-T signal evaluation (Experience, Expertise, Authority, Trust)',
      'Internal linking coherence and semantic clustering',
    ],
    howTitle: 'How Crawlers.fr Performs Semantic Analysis',
    howSteps: [
      { title: 'Multi-page crawl', desc: 'We crawl your entire site (up to 5,000 pages) to map your content architecture.' },
      { title: 'Semantic clustering', desc: 'AI groups your pages into thematic clusters and detects orphan pages and content gaps.' },
      { title: 'LLM visibility test', desc: 'We test whether ChatGPT, Gemini, Claude and Perplexity cite your content on relevant queries.' },
      { title: 'Actionable recommendations', desc: 'You receive a prioritized list of content to create, merge or optimize.' },
    ],
    diffTitle: 'Semantic Audit vs Technical Audit',
    diffRows: [
      { aspect: 'Focus', semantic: 'Content depth & relevance', technical: 'Code, speed, structure' },
      { aspect: 'Checks', semantic: 'Keywords, gaps, E-E-A-T, clustering', technical: 'HTML, Core Web Vitals, robots.txt' },
      { aspect: 'Output', semantic: 'Content strategy & priorities', technical: 'Code fixes & corrections' },
      { aspect: 'AI visibility', semantic: '✅ Directly evaluated', technical: '⚠️ Indirect impact only' },
    ],
    ctaTitle: 'Run Your Free Semantic Audit',
    ctaText: 'Crawlers.fr combines technical and semantic analysis in a single audit. Start now — no signup required.',
    ctaBtn: 'Start free audit',
    faqTitle: 'Frequently Asked Questions',
    faqs: [
      { q: 'Is the semantic audit free?', a: 'Yes, the initial audit on Crawlers.fr is 100% free with no signup. Advanced features like multi-page crawl and semantic clustering are available with a Pro Agency subscription.' },
      { q: 'How is this different from keyword research?', a: 'Keyword research identifies individual terms. A semantic audit evaluates how well your entire site covers a topic space, including content gaps, cannibalization and thematic coherence.' },
      { q: 'Does the semantic audit check AI visibility?', a: 'Yes. Crawlers.fr tests whether your content is cited by ChatGPT, Gemini, Claude and Perplexity — a unique capability not found in traditional SEO tools.' },
    ],
  } : language === 'es' ? {
    title: 'Auditoría Semántica SEO — Analice la Profundidad de su Contenido | Crawlers.fr',
    metaDesc: 'Realice una auditoría semántica gratuita de su sitio web. Evalúe la profundidad del contenido, la cobertura de palabras clave y los gaps temáticos con Crawlers.fr.',
    h1: 'Auditoría Semántica SEO: Analice la Profundidad de su Contenido',
    intro: 'Una auditoría semántica va más allá del SEO técnico. Evalúa si su contenido cubre realmente los temas que busca su audiencia — y si los motores de respuesta IA como ChatGPT y Gemini pueden entender y citar sus páginas.',
    whatTitle: '¿Qué es una Auditoría Semántica?',
    whatText: 'Una auditoría semántica analiza la profundidad temática y la cobertura de palabras clave de su sitio web. A diferencia de una auditoría técnica, evalúa la calidad, relevancia y completitud de su contenido.',
    whatItems: [
      'Análisis de cobertura de palabras clave en todo su sitio',
      'Detección de gaps temáticos frente a competidores',
      'Identificación de canibalización entre páginas similares',
      'Evaluación de señales E-E-A-T',
      'Coherencia del enlazado interno y clustering semántico',
    ],
    howTitle: 'Cómo Crawlers.fr Realiza el Análisis Semántico',
    howSteps: [
      { title: 'Crawl multi-página', desc: 'Rastreamos todo su sitio (hasta 5.000 páginas) para mapear su arquitectura de contenido.' },
      { title: 'Clustering semántico', desc: 'La IA agrupa sus páginas en clusters temáticos y detecta páginas huérfanas.' },
      { title: 'Test de visibilidad LLM', desc: 'Probamos si ChatGPT, Gemini, Claude y Perplexity citan su contenido.' },
      { title: 'Recomendaciones accionables', desc: 'Recibe una lista priorizada de contenido a crear, fusionar u optimizar.' },
    ],
    diffTitle: 'Auditoría Semántica vs Auditoría Técnica',
    diffRows: [
      { aspect: 'Enfoque', semantic: 'Profundidad y relevancia del contenido', technical: 'Código, velocidad, estructura' },
      { aspect: 'Verifica', semantic: 'Palabras clave, gaps, E-E-A-T, clustering', technical: 'HTML, Core Web Vitals, robots.txt' },
      { aspect: 'Resultado', semantic: 'Estrategia de contenido y prioridades', technical: 'Correcciones de código' },
      { aspect: 'Visibilidad IA', semantic: '✅ Evaluada directamente', technical: '⚠️ Solo impacto indirecto' },
    ],
    ctaTitle: 'Realice su Auditoría Semántica Gratuita',
    ctaText: 'Crawlers.fr combina análisis técnico y semántico en una sola auditoría. Empiece ahora — sin registro.',
    ctaBtn: 'Iniciar auditoría gratuita',
    faqTitle: 'Preguntas Frecuentes',
    faqs: [
      { q: '¿La auditoría semántica es gratuita?', a: 'Sí, la auditoría inicial en Crawlers.fr es 100% gratuita sin registro. Las funciones avanzadas están disponibles con una suscripción Pro Agency.' },
      { q: '¿En qué se diferencia de la investigación de palabras clave?', a: 'La investigación identifica términos individuales. Una auditoría semántica evalúa cómo su sitio completo cubre un espacio temático.' },
      { q: '¿Verifica la visibilidad IA?', a: 'Sí. Crawlers.fr prueba si su contenido es citado por ChatGPT, Gemini, Claude y Perplexity.' },
    ],
  } : {
    title: 'Audit Sémantique SEO — Analysez la Profondeur de Votre Contenu | Crawlers.fr',
    metaDesc: 'Réalisez un audit sémantique gratuit de votre site. Évaluez la profondeur de contenu, la couverture de mots-clés, les gaps thématiques et les signaux E-E-A-T avec Crawlers.fr.',
    h1: 'Audit Sémantique SEO : Analysez la Profondeur de Votre Contenu',
    intro: 'Un audit sémantique va au-delà du SEO technique. Il évalue si votre contenu couvre réellement les sujets recherchés par votre audience — et si les moteurs de réponse IA comme ChatGPT et Gemini peuvent comprendre et citer vos pages.',
    whatTitle: 'Qu\'est-ce qu\'un Audit Sémantique ?',
    whatText: 'Un audit sémantique analyse la profondeur thématique et la couverture de mots-clés de votre site web. Contrairement à un audit technique (qui vérifie le code, la vitesse et la structure), un audit sémantique évalue la qualité, la pertinence et la complétude de votre contenu par rapport à vos requêtes cibles.',
    whatItems: [
      'Analyse de la couverture de mots-clés sur l\'ensemble de votre site',
      'Détection des gaps thématiques — sujets couverts par vos concurrents mais pas par vous',
      'Identification de la cannibalisation de contenu entre pages similaires',
      'Évaluation des signaux E-E-A-T (Expérience, Expertise, Autorité, Fiabilité)',
      'Cohérence du maillage interne et clustering sémantique',
    ],
    howTitle: 'Comment Crawlers.fr Réalise l\'Analyse Sémantique',
    howSteps: [
      { title: 'Crawl multi-pages', desc: 'Nous crawlons l\'intégralité de votre site (jusqu\'à 5 000 pages) pour cartographier votre architecture de contenu.' },
      { title: 'Clustering sémantique', desc: 'L\'IA regroupe vos pages en clusters thématiques et détecte les pages orphelines et les gaps de contenu.' },
      { title: 'Test de visibilité LLM', desc: 'Nous testons si ChatGPT, Gemini, Claude et Perplexity citent votre contenu sur les requêtes pertinentes.' },
      { title: 'Recommandations actionnables', desc: 'Vous recevez une liste priorisée de contenus à créer, fusionner ou optimiser.' },
    ],
    diffTitle: 'Audit Sémantique vs Audit Technique',
    diffRows: [
      { aspect: 'Focus', semantic: 'Profondeur & pertinence du contenu', technical: 'Code, vitesse, structure' },
      { aspect: 'Vérifie', semantic: 'Mots-clés, gaps, E-E-A-T, clustering', technical: 'HTML, Core Web Vitals, robots.txt' },
      { aspect: 'Résultat', semantic: 'Stratégie de contenu & priorités', technical: 'Corrections de code' },
      { aspect: 'Visibilité IA', semantic: '✅ Évaluée directement', technical: '⚠️ Impact indirect uniquement' },
    ],
    ctaTitle: 'Lancez Votre Audit Sémantique Gratuit',
    ctaText: 'Crawlers.fr combine analyse technique et sémantique en un seul audit. Commencez maintenant — sans inscription.',
    ctaBtn: 'Lancer un audit gratuit',
    faqTitle: 'Questions Fréquentes',
    faqs: [
      { q: 'L\'audit sémantique est-il gratuit ?', a: 'Oui, l\'audit initial sur Crawlers.fr est 100% gratuit sans inscription. Les fonctionnalités avancées comme le crawl multi-pages et le clustering sémantique sont disponibles avec un abonnement Pro Agency.' },
      { q: 'En quoi est-ce différent de la recherche de mots-clés ?', a: 'La recherche de mots-clés identifie des termes individuels. Un audit sémantique évalue comment l\'ensemble de votre site couvre un espace thématique, y compris les gaps de contenu, la cannibalisation et la cohérence thématique.' },
      { q: 'L\'audit sémantique vérifie-t-il la visibilité IA ?', a: 'Oui. Crawlers.fr teste si votre contenu est cité par ChatGPT, Gemini, Claude et Perplexity — une capacité unique non présente dans les outils SEO traditionnels.' },
    ],
  };

  // Inject FAQ schema
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": t.faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'audit-semantique-faq');
    script.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(script);
    return () => {
      document.querySelectorAll('script[data-schema="audit-semantique-faq"]').forEach(el => el.remove());
    };
  }, [language]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
        <meta property="og:title" content={t.title} />
        <meta property="og:description" content={t.metaDesc} />
        <meta property="og:url" content="https://crawlers.fr/audit-semantique" />
      </Helmet>
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-16 space-y-16">
        {/* Hero */}
        <section className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{t.h1}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{t.intro}</p>
        </section>

        {/* What */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Search className="h-6 w-6 text-primary" /> {t.whatTitle}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{t.whatText}</p>
          <ul className="space-y-2">
            {t.whatItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* How */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" /> {t.howTitle}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {t.howSteps.map((step, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Layers className="h-6 w-6 text-primary" /> {t.diffTitle}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground"></th>
                  <th className="px-4 py-3 text-left font-semibold text-primary">Sémantique</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Technique</th>
                </tr>
              </thead>
              <tbody>
                {t.diffRows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{row.aspect}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.semantic}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.technical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">{t.faqTitle}</h2>
          <div className="space-y-4">
            {t.faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                <h3 className="font-semibold text-foreground">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-8">
          <h2 className="text-2xl font-bold text-foreground">{t.ctaTitle}</h2>
          <p className="text-muted-foreground">{t.ctaText}</p>
          <Link to="/audit-expert">
            <Button size="lg" className="gap-2">
              {t.ctaBtn} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
