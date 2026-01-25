import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';

const faqData = {
  fr: [
    {
      question: "Qu'est-ce que le Score SEO 200 et comment est-il calculé ?",
      answer: "Le Score SEO 200 est un indicateur composite évaluant votre site sur 200 points répartis en 5 piliers : Performance (40 pts via Google PageSpeed), Socle Technique (50 pts), Sémantique & Contenu (60 pts), Préparation IA & GEO (30 pts) et Santé/Sécurité (20 pts). Chaque critère est mesuré automatiquement par nos algorithmes propriétaires et les APIs Google officielles."
    },
    {
      question: "Quelle est la différence entre SEO traditionnel et GEO (Generative Engine Optimization) ?",
      answer: "Le SEO traditionnel optimise votre visibilité sur les moteurs de recherche classiques comme Google. Le GEO (Generative Engine Optimization) est une nouvelle discipline qui optimise votre contenu pour être cité par les moteurs de recherche génératifs comme ChatGPT, Claude, Perplexity et Google SGE. Notre audit évalue les deux dimensions pour une visibilité complète en 2026."
    },
    {
      question: "Comment améliorer mon score de citabilité IA ?",
      answer: "Pour améliorer votre citabilité IA, concentrez-vous sur : 1) L'ajout de données structurées Schema.org (JSON-LD), 2) La création de contenu factuel avec des chiffres et statistiques, 3) L'intégration de tableaux comparatifs, 4) Les citations d'experts et sources fiables, 5) Un robots.txt permissif autorisant les crawlers IA. Notre audit vous fournit des recommandations prioritaires personnalisées."
    },
    {
      question: "Pourquoi les Core Web Vitals sont-ils importants pour l'IA ?",
      answer: "Les Core Web Vitals (LCP, CLS, TBT) impactent directement la capacité des IA à crawler et indexer votre contenu. Un site lent ou instable est moins bien analysé par les robots. De plus, Google intègre ces métriques dans son algorithme SGE pour sélectionner les sources citées. Un LCP < 2.5s et un CLS < 0.1 sont recommandés."
    },
    {
      question: "Que signifie 'Préparation IA' dans l'audit ?",
      answer: "La section 'Préparation IA' mesure si votre site est optimisé pour être compris et cité par les LLM (Large Language Models). Elle vérifie la présence de données structurées JSON-LD, l'accessibilité de votre robots.txt aux crawlers IA (GPTBot, ClaudeBot, etc.), et la clarté sémantique de votre contenu pour les systèmes RAG (Retrieval Augmented Generation)."
    },
    {
      question: "À quelle fréquence dois-je réaliser un audit SEO & IA ?",
      answer: "Nous recommandons un audit mensuel pour les sites actifs avec publication régulière, et un audit trimestriel pour les sites vitrines. Les mises à jour d'algorithmes de Google et des LLM sont fréquentes : un suivi régulier permet d'adapter votre stratégie et de maintenir votre visibilité dans l'écosystème IA & Search 2026."
    },
    {
      question: "Comment interpréter les requêtes de test LLM ?",
      answer: "Les requêtes de test LLM sont des prompts que vous pouvez soumettre à ChatGPT, Claude ou Perplexity pour vérifier si votre marque est citée. Testez-les régulièrement : si votre site n'apparaît pas dans les réponses, c'est que votre stratégie GEO nécessite des optimisations. Nos recommandations vous guident pour améliorer votre autorité d'entité."
    },
    {
      question: "Le Score SEO 200 remplace-t-il un audit manuel ?",
      answer: "Le Score SEO 200 est un diagnostic automatisé rapide et objectif. Il complète parfaitement un audit manuel approfondi en fournissant des données techniques précises. Pour une stratégie complète, combinez notre outil avec une analyse éditoriale et concurrentielle réalisée par un expert SEO/GEO."
    }
  ],
  en: [
    {
      question: "What is the SEO 200 Score and how is it calculated?",
      answer: "The SEO 200 Score is a composite indicator evaluating your site on 200 points across 5 pillars: Performance (40 pts via Google PageSpeed), Technical Foundation (50 pts), Semantics & Content (60 pts), AI & GEO Readiness (30 pts), and Health/Security (20 pts). Each criterion is automatically measured by our proprietary algorithms and official Google APIs."
    },
    {
      question: "What's the difference between traditional SEO and GEO (Generative Engine Optimization)?",
      answer: "Traditional SEO optimizes your visibility on classic search engines like Google. GEO (Generative Engine Optimization) is a new discipline that optimizes your content to be cited by generative search engines like ChatGPT, Claude, Perplexity, and Google SGE. Our audit evaluates both dimensions for complete 2026 visibility."
    },
    {
      question: "How can I improve my AI citability score?",
      answer: "To improve your AI citability, focus on: 1) Adding Schema.org structured data (JSON-LD), 2) Creating factual content with numbers and statistics, 3) Integrating comparative tables, 4) Expert citations and reliable sources, 5) A permissive robots.txt allowing AI crawlers. Our audit provides personalized priority recommendations."
    },
    {
      question: "Why are Core Web Vitals important for AI?",
      answer: "Core Web Vitals (LCP, CLS, TBT) directly impact the ability of AI to crawl and index your content. A slow or unstable site is poorly analyzed by robots. Additionally, Google integrates these metrics into its SGE algorithm to select cited sources. An LCP < 2.5s and CLS < 0.1 are recommended."
    },
    {
      question: "What does 'AI Readiness' mean in the audit?",
      answer: "The 'AI Readiness' section measures whether your site is optimized to be understood and cited by LLMs (Large Language Models). It verifies the presence of JSON-LD structured data, your robots.txt accessibility to AI crawlers (GPTBot, ClaudeBot, etc.), and the semantic clarity of your content for RAG (Retrieval Augmented Generation) systems."
    },
    {
      question: "How often should I perform an SEO & AI audit?",
      answer: "We recommend a monthly audit for active sites with regular publishing, and a quarterly audit for showcase sites. Google and LLM algorithm updates are frequent: regular monitoring allows you to adapt your strategy and maintain your visibility in the 2026 AI & Search ecosystem."
    },
    {
      question: "How to interpret LLM test queries?",
      answer: "LLM test queries are prompts you can submit to ChatGPT, Claude, or Perplexity to verify if your brand is cited. Test them regularly: if your site doesn't appear in responses, your GEO strategy needs optimization. Our recommendations guide you to improve your entity authority."
    },
    {
      question: "Does the SEO 200 Score replace a manual audit?",
      answer: "The SEO 200 Score is a quick and objective automated diagnostic. It perfectly complements a thorough manual audit by providing precise technical data. For a complete strategy, combine our tool with editorial and competitive analysis performed by an SEO/GEO expert."
    }
  ],
  es: [
    {
      question: "¿Qué es el Score SEO 200 y cómo se calcula?",
      answer: "El Score SEO 200 es un indicador compuesto que evalúa su sitio en 200 puntos distribuidos en 5 pilares: Rendimiento (40 pts vía Google PageSpeed), Base Técnica (50 pts), Semántica y Contenido (60 pts), Preparación IA y GEO (30 pts) y Salud/Seguridad (20 pts). Cada criterio se mide automáticamente por nuestros algoritmos propietarios y las APIs oficiales de Google."
    },
    {
      question: "¿Cuál es la diferencia entre SEO tradicional y GEO (Generative Engine Optimization)?",
      answer: "El SEO tradicional optimiza su visibilidad en motores de búsqueda clásicos como Google. GEO (Generative Engine Optimization) es una nueva disciplina que optimiza su contenido para ser citado por motores de búsqueda generativos como ChatGPT, Claude, Perplexity y Google SGE. Nuestra auditoría evalúa ambas dimensiones para una visibilidad completa en 2026."
    },
    {
      question: "¿Cómo mejorar mi puntuación de citabilidad IA?",
      answer: "Para mejorar su citabilidad IA, concéntrese en: 1) Agregar datos estructurados Schema.org (JSON-LD), 2) Crear contenido factual con números y estadísticas, 3) Integrar tablas comparativas, 4) Citas de expertos y fuentes confiables, 5) Un robots.txt permisivo que permita crawlers IA. Nuestra auditoría proporciona recomendaciones prioritarias personalizadas."
    },
    {
      question: "¿Por qué son importantes los Core Web Vitals para la IA?",
      answer: "Los Core Web Vitals (LCP, CLS, TBT) impactan directamente la capacidad de la IA para rastrear e indexar su contenido. Un sitio lento o inestable es mal analizado por los robots. Además, Google integra estas métricas en su algoritmo SGE para seleccionar las fuentes citadas. Se recomienda un LCP < 2.5s y un CLS < 0.1."
    },
    {
      question: "¿Qué significa 'Preparación IA' en la auditoría?",
      answer: "La sección 'Preparación IA' mide si su sitio está optimizado para ser comprendido y citado por LLMs (Large Language Models). Verifica la presencia de datos estructurados JSON-LD, la accesibilidad de su robots.txt a crawlers IA (GPTBot, ClaudeBot, etc.) y la claridad semántica de su contenido para sistemas RAG (Retrieval Augmented Generation)."
    },
    {
      question: "¿Con qué frecuencia debo realizar una auditoría SEO e IA?",
      answer: "Recomendamos una auditoría mensual para sitios activos con publicación regular, y una auditoría trimestral para sitios escaparate. Las actualizaciones de algoritmos de Google y LLM son frecuentes: un seguimiento regular permite adaptar su estrategia y mantener su visibilidad en el ecosistema IA y Search 2026."
    },
    {
      question: "¿Cómo interpretar las consultas de prueba LLM?",
      answer: "Las consultas de prueba LLM son prompts que puede enviar a ChatGPT, Claude o Perplexity para verificar si su marca es citada. Pruébelas regularmente: si su sitio no aparece en las respuestas, su estrategia GEO necesita optimización. Nuestras recomendaciones le guían para mejorar su autoridad de entidad."
    },
    {
      question: "¿El Score SEO 200 reemplaza una auditoría manual?",
      answer: "El Score SEO 200 es un diagnóstico automatizado rápido y objetivo. Complementa perfectamente una auditoría manual exhaustiva proporcionando datos técnicos precisos. Para una estrategia completa, combine nuestra herramienta con un análisis editorial y competitivo realizado por un experto SEO/GEO."
    }
  ]
};

export function ExpertAuditFAQ() {
  const { language } = useLanguage();
  const faqs = faqData[language] || faqData.fr;

  const titles = {
    fr: "Questions Fréquentes sur l'Audit SEO & IA",
    en: "Frequently Asked Questions about SEO & AI Audit",
    es: "Preguntas Frecuentes sobre la Auditoría SEO e IA"
  };

  return (
    <section className="container mx-auto px-4 py-12 max-w-4xl">
      <h2 className="text-2xl font-bold text-foreground text-center mb-8">
        {titles[language] || titles.fr}
      </h2>
      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, index) => (
          <AccordionItem 
            key={index} 
            value={`item-${index}`}
            className="border rounded-lg px-4 bg-card"
          >
            <AccordionTrigger className="text-left hover:no-underline">
              <span className="font-medium">{faq.question}</span>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
