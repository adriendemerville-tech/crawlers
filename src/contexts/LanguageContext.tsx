import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'fr' | 'en' | 'es';

interface Translations {
  hero: {
    badge: {
      crawlers: string;
      geo: string;
      pagespeed: string;
      llm: string;
    };
    headline: {
      crawlers: string;
      crawlersHighlight: string;
      geo: string;
      geoHighlight: string;
      pagespeed: string;
      pagespeedHighlight: string;
      llm: string;
      llmHighlight: string;
    };
    subheadline: {
      crawlers: string;
      geo: string;
      pagespeed: string;
      llm: string;
    };
    button: {
      crawlers: string;
      geo: string;
      pagespeed: string;
      llm: string;
      loading: {
        crawlers: string;
        geo: string;
        pagespeed: string;
        llm: string;
      };
    };
    trust: {
      noSignup: string;
      instant: string;
      free: string;
    };
  };
  tabs: {
    crawlers: string;
    geo: string;
    pagespeed: string;
    llm: string;
  };
  results: {
    scanComplete: string;
    analysisComplete: string;
    botsChecked: string;
    geoScore: string;
    pageSpeedScore: string;
    allowed: string;
    blocked: string;
    unknown: string;
    howToFix: string;
    howToImprove: string;
    reason: string;
    line: string;
    addToRobots: string;
  };
  crawlers: {
    scanning: string;
    checkingRobots: string;
  };
  geo: {
    title: string;
    whatIsGeo: string;
    checksPassed: string;
  };
  llm: {
    title: string;
    overallVisibility: string;
    citationRate: string;
    citationRateDesc: string;
    coverage: string;
    invisibleList: string;
    visibleAllLlms: string;
    iterationDepth: string;
    avgPrompts: string;
    iterationExcellent: string;
    iterationModerate: string;
    iterationDeep: string;
    sentimentAnalysis: string;
    sentimentPositive: string;
    sentimentNeutral: string;
    sentimentNegative: string;
    sentimentPositiveDesc: string;
    sentimentNeutralDesc: string;
    sentimentNegativeDesc: string;
    recommendationStatus: string;
    llmsRecommend: string;
    notRecommended: string;
    llmsRecommendDesc: string;
    notRecommendedDesc: string;
    coreValueUnderstanding: string;
    hallucinationsDetected: string;
    detailedAnalysis: string;
    iterations: string;
    sentiment: string;
    recommends: string;
    notMentioned: string;
    llmsCite: string;
    positive: string;
    neutral: string;
    negative: string;
  };
  pagespeed: {
    title: string;
    mobile: string;
    desktop: string;
    coreWebVitals: string;
    performance: string;
    accessibility: string;
    bestPractices: string;
    seo: string;
    fcp: string;
    fcpDesc: string;
    lcp: string;
    lcpDesc: string;
    cls: string;
    clsDesc: string;
    tbt: string;
    tbtDesc: string;
    speedIndex: string;
    speedIndexDesc: string;
    tti: string;
    ttiDesc: string;
  };
  faq: {
    badge: string;
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  footer: {
    builtWith: string;
    tagline: string;
    poweredBy: string;
    alsoDiscover: string;
  };
  quota: {
    title: string;
    description: string;
    options: string;
    tryBotChecker: string;
    useOfficial: string;
    comeBack: string;
    retry: string;
  };
  news: {
    title: string;
    searchPlaceholder: string;
    refresh: string;
    newSource: string;
    noResults: string;
    sourcesCount: string;
    lastUpdate: string;
  };
  help: {
    learnMore: string;
    viewInLexicon: string;
  };
}

const translations: Record<Language, Translations> = {
  fr: {
    hero: {
      badge: {
        crawlers: 'Audit GEO gratuit — Janvier 2026',
        geo: 'Analyseur GEO',
        pagespeed: 'Analyse de Performance',
        llm: 'Visibilité ChatGPT',
      },
      headline: {
        crawlers: 'ChatGPT ignore-t-il',
        crawlersHighlight: 'votre site ?',
        geo: 'Optimisez pour',
        geoHighlight: "la découverte IA",
        pagespeed: 'Quelle est la vitesse de',
        pagespeedHighlight: 'votre site',
        llm: 'Êtes-vous invisible pour',
        llmHighlight: 'ChatGPT et Gemini',
      },
      subheadline: {
        crawlers: "",
        geo: "Mesurez votre score GEO et votre potentiel de citation par les moteurs génératifs. Optimisation Search Generative Experience incluse.",
        pagespeed: "Core Web Vitals + impact sur le crawling IA. Si votre site est lent, les LLM ne vous indexent pas.",
        llm: "Analysez votre visibilité ChatGPT, Claude et Gemini. Découvrez si votre marque est citée ou ignorée.",
      },
      button: {
        crawlers: 'Analyser Bots IA',
        geo: 'Analyser mon Score GEO',
        pagespeed: 'Tester la Vitesse',
        llm: 'Vérifier ma Visibilité IA',
        loading: {
          crawlers: 'Scan en cours...',
          geo: 'Analyse en cours...',
          pagespeed: 'Analyse en cours...',
          llm: 'Analyse en cours...',
        },
      },
      trust: {
        noSignup: '',
        instant: '',
        free: 'Audit Flash gratuit',
      },
    },
    tabs: {
      crawlers: 'Bots IA',
      geo: 'Score GEO',
      pagespeed: 'PageSpeed',
      llm: 'Visibilité LLM',
    },
    results: {
      scanComplete: 'Scan terminé !',
      analysisComplete: 'Analyse terminée !',
      botsChecked: 'bots IA vérifiés pour',
      geoScore: 'Score GEO',
      pageSpeedScore: 'Score PageSpeed',
      allowed: 'Autorisés',
      blocked: 'Bloqués',
      unknown: 'Inconnu',
      howToFix: 'Comment autoriser ce bot',
      howToImprove: 'Comment améliorer',
      reason: 'Raison',
      line: 'ligne',
      addToRobots: 'Ajoutez ceci à votre',
    },
    crawlers: {
      scanning: 'Scan du site en cours...',
      checkingRobots: 'Vérification du robots.txt, des balises meta et des en-têtes HTTP',
    },
    geo: {
      title: 'Analyse GEO',
      whatIsGeo: "Qu'est-ce que le GEO ? L'Optimisation pour Moteurs Génératifs mesure la qualité de structuration de votre contenu pour les systèmes IA comme ChatGPT, Claude et Gemini. Un score élevé signifie que les outils IA peuvent mieux comprendre et référencer votre contenu.",
      checksPassed: 'vérifications réussies',
    },
    llm: {
      title: 'Analyse de Visibilité LLM',
      overallVisibility: 'Visibilité Globale',
      citationRate: 'Taux de Citation',
      citationRateDesc: 'LLMs ayant mentionné ce domaine dans leurs réponses',
      coverage: 'couverture',
      invisibleList: 'Liste des "Invisibles"',
      visibleAllLlms: 'Visible sur tous les LLMs !',
      iterationDepth: 'Profondeur d\'Itération',
      avgPrompts: 'prompts en moy.',
      iterationExcellent: 'Excellent ! Les LLMs vous mentionnent immédiatement.',
      iterationModerate: 'Profondeur modérée. Améliorez vos signaux d\'autorité.',
      iterationDeep: 'Itération profonde nécessaire. Améliorez les données structurées.',
      sentimentAnalysis: 'Analyse de Sentiment',
      sentimentPositive: 'Positif',
      sentimentNeutral: 'Neutre',
      sentimentNegative: 'Négatif',
      sentimentPositiveDesc: 'Les LLMs parlent favorablement de votre marque et contenu.',
      sentimentNeutralDesc: 'Perception neutre. Opportunité de renforcer votre réputation.',
      sentimentNegativeDesc: 'Perceptions négatives détectées. Revoyez la qualité du contenu.',
      recommendationStatus: 'Statut de Recommandation',
      llmsRecommend: 'Les LLMs recommandent ce site',
      notRecommended: 'Non explicitement recommandé',
      llmsRecommendDesc: 'Votre site est activement recommandé par les LLMs.',
      notRecommendedDesc: 'Travaillez les signaux E-E-A-T pour obtenir des recommandations.',
      coreValueUnderstanding: 'Compréhension de la Valeur Clé',
      hallucinationsDetected: 'Hallucinations Potentielles Détectées',
      detailedAnalysis: 'Analyse LLM Détaillée',
      iterations: 'Itérations',
      sentiment: 'Sentiment',
      recommends: 'Recommande',
      notMentioned: 'Non mentionné par ce LLM',
      llmsCite: 'LLMs citent ce domaine',
      positive: 'Positif',
      neutral: 'Neutre',
      negative: 'Négatif',
    },
    pagespeed: {
      title: 'PageSpeed Insights',
      mobile: 'Mobile',
      desktop: 'Ordinateur',
      coreWebVitals: 'Core Web Vitals',
      performance: 'Performance',
      accessibility: 'Accessibilité',
      bestPractices: 'Bonnes Pratiques',
      seo: 'SEO',
      fcp: 'First Contentful Paint',
      fcpDesc: 'Temps jusqu\'au premier texte/image',
      lcp: 'Largest Contentful Paint',
      lcpDesc: 'Temps jusqu\'au plus grand élément',
      cls: 'Cumulative Layout Shift',
      clsDesc: 'Score de stabilité visuelle',
      tbt: 'Total Blocking Time',
      tbtDesc: 'Blocage du thread principal',
      speedIndex: 'Speed Index',
      speedIndexDesc: 'Vitesse de chargement du contenu',
      tti: 'Time to Interactive',
      ttiDesc: 'Temps avant interactivité complète',
    },
    faq: {
      badge: 'Questions Fréquentes',
      title: 'Tout ce qu\'il faut savoir avant de lancer votre audit',
      items: [
        {
          question: "Que contient l'audit SEO 200 points de Crawlers.fr ?",
          answer: "L'audit analyse 200 critères techniques répartis en 12 catégories : balises meta, vitesse, données structurées, maillage interne, accessibilité mobile, sécurité HTTPS, Core Web Vitals, sitemap, robots.txt, E-E-A-T, indexation et compatibilité LLM. Vous recevez un score global, des recommandations priorisées et du code correctif prêt à déployer."
        },
        {
          question: "Comment être cité par ChatGPT, Perplexity et Gemini ?",
          answer: "Il faut optimiser votre GEO (Generative Engine Optimization) : données structurées JSON-LD riches, contenu E-E-A-T vérifié, autorisation des crawlers IA dans votre robots.txt, et phrases « citables » dans votre contenu. Crawlers.fr mesure votre score GEO et votre Part de Voix LLM sur 4 modèles simultanément."
        },
        {
          question: "Combien de temps prend un audit complet ?",
          answer: "Moins de 5 minutes. Entrez votre URL, Crawlers.fr lance 7 algorithmes en parallèle : crawl technique, analyse PageSpeed, score GEO, visibilité LLM, données structurées, sécurité et E-E-A-T. Le rapport complet avec correctifs est disponible immédiatement."
        },
        {
          question: "Quelle est la différence entre SEO classique et GEO ?",
          answer: "Le SEO classique optimise votre positionnement sur Google. Le GEO optimise votre citabilité dans les réponses des IA génératives (ChatGPT, Perplexity, Gemini, Claude). En 2026, 40% des recherches passent par un moteur IA. Crawlers.fr est le premier outil francophone à couvrir les deux simultanément."
        },
        {
          question: "Pourquoi Crawlers.fr à 29€/mois au lieu de 200€+ ?",
          answer: "Nous appliquons le « dividende de l'IA » : les coûts d'infrastructure baissent structurellement grâce aux progrès des modèles. Plutôt que de maximiser nos marges, nous répercutons ces gains sur nos prix. Résultat : là où les outils traditionnels coûtaient plus d'une centaine d'euros en 2022, Crawlers rend un service équivalent pour 29 € par mois."
        }
      ],
    },
    footer: {
      builtWith: 'Créé avec',
      tagline: "pour l'ère de l'IA",
      poweredBy: 'Propulsé par',
      alsoDiscover: 'Découvrez aussi',
    },
    quota: {
      title: 'Quota Journalier Dépassé',
      description: "L'API PageSpeed Insights gratuite a atteint sa limite quotidienne. Elle se réinitialise généralement à minuit, heure du Pacifique.",
      options: 'Options :',
      tryBotChecker: "Essayez l'onglet Vérificateur de Bots IA (sans limite de quota)",
      useOfficial: 'Utilisez le site officiel PageSpeed Insights de Google',
      comeBack: 'Revenez demain quand le quota sera réinitialisé',
      retry: 'Réessayer',
    },
    news: {
      title: 'Veille SEO / LLM / GEO',
      searchPlaceholder: 'Rechercher un article...',
      refresh: 'Actualiser',
      newSource: 'Nouvelle source découverte :',
      noResults: 'Aucun article trouvé',
      sourcesCount: '{count} sources surveillées',
      lastUpdate: 'Dernière mise à jour',
    },
    help: {
      learnMore: 'En savoir plus',
      viewInLexicon: 'Voir dans le lexique',
    },
  },
  en: {
    hero: {
      badge: {
        crawlers: 'Free GEO Audit — January 2026',
        geo: 'GEO Analysis Tool',
        pagespeed: 'Performance Analysis Tool',
        llm: 'ChatGPT Visibility',
      },
      headline: {
        crawlers: 'Is ChatGPT ignoring',
        crawlersHighlight: 'your website?',
        geo: 'Optimize for',
        geoHighlight: 'AI discovery',
        pagespeed: 'How fast is',
        pagespeedHighlight: 'your website',
        llm: 'Are you invisible to',
        llmHighlight: 'ChatGPT & Gemini',
      },
      subheadline: {
        crawlers: 'Test your visibility in 30 seconds. <strong>Fix your code</strong> with our <strong>Expert Audit</strong>. Outperform the competition.',
        geo: 'Measure your GEO score and citation potential by generative engines. Search Generative Experience Optimization included.',
        pagespeed: 'Core Web Vitals + AI crawling impact. Slow sites don\'t get indexed by LLMs.',
        llm: 'Analyze your ChatGPT, Claude, and Gemini visibility. Discover if your brand is cited or ignored.',
      },
      button: {
        crawlers: 'Analyze AI Bots',
        geo: 'Analyze My GEO Score',
        pagespeed: 'Test Speed',
        llm: 'Check My AI Visibility',
        loading: {
          crawlers: 'Scanning...',
          geo: 'Analyzing...',
          pagespeed: 'Analyzing...',
          llm: 'Analyzing...',
        },
      },
      trust: {
        noSignup: '',
        instant: 'No consultant needed',
        free: '100% free GEO audit',
      },
    },
    tabs: {
      crawlers: 'AI Bots',
      geo: 'GEO Score',
      pagespeed: 'PageSpeed',
      llm: 'LLM Visibility',
    },
    results: {
      scanComplete: 'Scan complete!',
      analysisComplete: 'Analysis complete!',
      botsChecked: 'AI bots checked for',
      geoScore: 'GEO Score',
      pageSpeedScore: 'PageSpeed score',
      allowed: 'Allowed',
      blocked: 'Blocked',
      unknown: 'Unknown',
      howToFix: 'How to allow this bot',
      howToImprove: 'How to improve',
      reason: 'Reason',
      line: 'line',
      addToRobots: 'Add this to your',
    },
    crawlers: {
      scanning: 'Scanning website...',
      checkingRobots: 'Checking robots.txt, meta tags, and HTTP headers',
    },
    geo: {
      title: 'GEO Analysis',
      whatIsGeo: 'What is GEO? Generative Engine Optimization measures how well your content is structured for AI systems like ChatGPT, Claude, and Gemini. A higher score means AI tools can better understand and reference your content.',
      checksPassed: 'checks passed',
    },
    llm: {
      title: 'LLM Visibility Analysis',
      overallVisibility: 'Overall Visibility',
      citationRate: 'Citation Rate',
      citationRateDesc: 'LLMs that mentioned this domain in their responses',
      coverage: 'coverage',
      invisibleList: 'The "Invisible" List',
      visibleAllLlms: 'Visible across all LLMs!',
      iterationDepth: 'Iteration Depth',
      avgPrompts: 'avg. prompts',
      iterationExcellent: 'Excellent! LLMs mention you immediately.',
      iterationModerate: 'Moderate depth. Consider improving authority signals.',
      iterationDeep: 'Deep iteration needed. Improve structured data.',
      sentimentAnalysis: 'Sentiment Analysis',
      sentimentPositive: 'Positive',
      sentimentNeutral: 'Neutral',
      sentimentNegative: 'Negative',
      sentimentPositiveDesc: 'LLMs speak favorably about your brand and content.',
      sentimentNeutralDesc: 'Neutral perception. Opportunity to build stronger reputation.',
      sentimentNegativeDesc: 'Some negative perceptions detected. Review content quality.',
      recommendationStatus: 'Recommendation Status',
      llmsRecommend: 'LLMs recommend this site',
      notRecommended: 'Not explicitly recommended',
      llmsRecommendDesc: 'Your site is actively recommended by LLMs.',
      notRecommendedDesc: 'Work on E-E-A-T signals to gain recommendations.',
      coreValueUnderstanding: 'Core Value Understanding',
      hallucinationsDetected: 'Potential Hallucinations Detected',
      detailedAnalysis: 'Detailed LLM Analysis',
      iterations: 'Iterations',
      sentiment: 'Sentiment',
      recommends: 'Recommends',
      notMentioned: 'Not mentioned by this LLM',
      llmsCite: 'LLMs cite this domain',
      positive: 'Positive',
      neutral: 'Neutral',
      negative: 'Negative',
    },
    pagespeed: {
      title: 'PageSpeed Insights',
      mobile: 'Mobile',
      desktop: 'Desktop',
      coreWebVitals: 'Core Web Vitals',
      performance: 'Performance',
      accessibility: 'Accessibility',
      bestPractices: 'Best Practices',
      seo: 'SEO',
      fcp: 'First Contentful Paint',
      fcpDesc: 'Time to first text/image',
      lcp: 'Largest Contentful Paint',
      lcpDesc: 'Time to largest element',
      cls: 'Cumulative Layout Shift',
      clsDesc: 'Visual stability score',
      tbt: 'Total Blocking Time',
      tbtDesc: 'Main thread blocking',
      speedIndex: 'Speed Index',
      speedIndexDesc: 'How quickly content loads',
      tti: 'Time to Interactive',
      ttiDesc: 'Time until fully interactive',
    },
    faq: {
      badge: 'Frequently Asked Questions',
      title: 'Everything you need to know before running your audit',
      items: [
        {
          question: "What does the Crawlers.fr 200-point SEO audit include?",
          answer: "The audit analyzes 200 technical criteria across 12 categories: meta tags, speed, structured data, internal linking, mobile accessibility, HTTPS security, Core Web Vitals, sitemap, robots.txt, E-E-A-T, indexation and LLM compatibility. You get an overall score, prioritized recommendations and deploy-ready corrective code."
        },
        {
          question: "How to get cited by ChatGPT, Perplexity and Gemini?",
          answer: "You need to optimize your GEO (Generative Engine Optimization): rich JSON-LD structured data, verified E-E-A-T content, AI crawler authorization in your robots.txt, and 'citable' phrases in your content. Crawlers.fr measures your GEO score and LLM Share of Voice across 4 models simultaneously."
        },
        {
          question: "How long does a full audit take?",
          answer: "Under 5 minutes. Enter your URL, Crawlers.fr runs 7 algorithms in parallel: technical crawl, PageSpeed analysis, GEO score, LLM visibility, structured data, security and E-E-A-T. The full report with fixes is available immediately."
        },
        {
          question: "What's the difference between traditional SEO and GEO?",
          answer: "Traditional SEO optimizes your ranking on Google. GEO optimizes your citability in generative AI responses (ChatGPT, Perplexity, Gemini, Claude). In 2026, 40% of searches go through an AI engine. Crawlers.fr is the first French-language tool covering both simultaneously."
        },
        {
          question: "Why is Crawlers.fr €29/month instead of €200+?",
          answer: "We apply the 'AI dividend': infrastructure costs are structurally declining thanks to model improvements. Rather than maximizing margins, we pass these savings on to pricing. Result: an audit that cost €2,000 at an agency is now accessible at €29/month, unlimited audits included."
        }
      ],
    },
    footer: {
      builtWith: 'Built with',
      tagline: 'for the AI era',
      poweredBy: 'Powered by',
      alsoDiscover: 'Also discover',
    },
    quota: {
      title: 'Daily Quota Exceeded',
      description: "The free PageSpeed Insights API has reached its daily limit. This typically resets at midnight Pacific Time.",
      options: 'Options:',
      tryBotChecker: 'Try the AI Bot Checker tab instead (no quota limits)',
      useOfficial: "Use Google's official PageSpeed Insights website directly",
      comeBack: 'Come back tomorrow when the quota resets',
      retry: 'Try Again',
    },
    news: {
      title: 'SEO / LLM / GEO News',
      searchPlaceholder: 'Search articles...',
      refresh: 'Refresh',
      newSource: 'New source discovered:',
      noResults: 'No articles found',
      sourcesCount: '{count} sources monitored',
      lastUpdate: 'Last update',
    },
    help: {
      learnMore: 'Learn more',
      viewInLexicon: 'View in glossary',
    },
  },
  es: {
    hero: {
      badge: {
        crawlers: 'Auditoría GEO gratis — Enero 2026',
        geo: 'Analizador GEO',
        pagespeed: 'Análisis de Rendimiento',
        llm: 'Visibilidad ChatGPT',
      },
      headline: {
        crawlers: '¿ChatGPT ignora',
        crawlersHighlight: 'tu sitio web?',
        geo: 'Optimiza para',
        geoHighlight: 'el descubrimiento IA',
        pagespeed: '¿Qué tan rápido es',
        pagespeedHighlight: 'tu sitio web',
        llm: '¿Eres invisible para',
        llmHighlight: 'ChatGPT y Gemini',
      },
      subheadline: {
        crawlers: 'Prueba tu visibilidad en 30 segundos. <strong>Corrige el código</strong> de tu sitio con nuestra <strong>Auditoría experta</strong>. Supera a la competencia.',
        geo: 'Mide tu puntuación GEO y potencial de citación por motores generativos. Optimización Search Generative Experience incluida.',
        pagespeed: 'Core Web Vitals + impacto en crawling IA. Los sitios lentos no son indexados por los LLM.',
        llm: 'Analiza tu visibilidad en ChatGPT, Claude y Gemini. Descubre si tu marca es citada o ignorada.',
      },
      button: {
        crawlers: 'Analizar Bots IA',
        geo: 'Analizar Mi Puntuación GEO',
        pagespeed: 'Probar Velocidad',
        llm: 'Verificar Mi Visibilidad IA',
        loading: {
          crawlers: 'Escaneando...',
          geo: 'Analizando...',
          pagespeed: 'Analizando...',
          llm: 'Analizando...',
        },
      },
      trust: {
        noSignup: '',
        instant: 'Sin necesidad de consultor',
        free: 'Auditoría GEO 100% gratis',
      },
    },
    tabs: {
      crawlers: 'Bots IA',
      geo: 'Puntuación GEO',
      pagespeed: 'PageSpeed',
      llm: 'Visibilidad LLM',
    },
    results: {
      scanComplete: '¡Escaneo completo!',
      analysisComplete: '¡Análisis completo!',
      botsChecked: 'bots IA verificados para',
      geoScore: 'Puntuación GEO',
      pageSpeedScore: 'Puntuación PageSpeed',
      allowed: 'Permitidos',
      blocked: 'Bloqueados',
      unknown: 'Desconocido',
      howToFix: 'Cómo permitir este bot',
      howToImprove: 'Cómo mejorar',
      reason: 'Razón',
      line: 'línea',
      addToRobots: 'Añade esto a tu',
    },
    crawlers: {
      scanning: 'Escaneando sitio web...',
      checkingRobots: 'Verificando robots.txt, meta tags y cabeceras HTTP',
    },
    geo: {
      title: 'Análisis GEO',
      whatIsGeo: '¿Qué es GEO? La Optimización para Motores Generativos mide qué tan bien está estructurado tu contenido para sistemas de IA como ChatGPT, Claude y Gemini. Una puntuación alta significa que las herramientas de IA pueden entender y referenciar mejor tu contenido.',
      checksPassed: 'verificaciones pasadas',
    },
    llm: {
      title: 'Análisis de Visibilidad LLM',
      overallVisibility: 'Visibilidad General',
      citationRate: 'Tasa de Citación',
      citationRateDesc: 'LLMs que mencionaron este dominio en sus respuestas',
      coverage: 'cobertura',
      invisibleList: 'Lista de "Invisibles"',
      visibleAllLlms: '¡Visible en todos los LLMs!',
      iterationDepth: 'Profundidad de Iteración',
      avgPrompts: 'prompts prom.',
      iterationExcellent: '¡Excelente! Los LLMs te mencionan inmediatamente.',
      iterationModerate: 'Profundidad moderada. Mejora las señales de autoridad.',
      iterationDeep: 'Se necesita iteración profunda. Mejora los datos estructurados.',
      sentimentAnalysis: 'Análisis de Sentimiento',
      sentimentPositive: 'Positivo',
      sentimentNeutral: 'Neutro',
      sentimentNegative: 'Negativo',
      sentimentPositiveDesc: 'Los LLMs hablan favorablemente de tu marca y contenido.',
      sentimentNeutralDesc: 'Percepción neutra. Oportunidad de construir una reputación más fuerte.',
      sentimentNegativeDesc: 'Se detectaron percepciones negativas. Revisa la calidad del contenido.',
      recommendationStatus: 'Estado de Recomendación',
      llmsRecommend: 'Los LLMs recomiendan este sitio',
      notRecommended: 'No recomendado explícitamente',
      llmsRecommendDesc: 'Tu sitio es recomendado activamente por los LLMs.',
      notRecommendedDesc: 'Trabaja en las señales E-E-A-T para obtener recomendaciones.',
      coreValueUnderstanding: 'Comprensión del Valor Central',
      hallucinationsDetected: 'Alucinaciones Potenciales Detectadas',
      detailedAnalysis: 'Análisis LLM Detallado',
      iterations: 'Iteraciones',
      sentiment: 'Sentimiento',
      recommends: 'Recomienda',
      notMentioned: 'No mencionado por este LLM',
      llmsCite: 'LLMs citan este dominio',
      positive: 'Positivo',
      neutral: 'Neutro',
      negative: 'Negativo',
    },
    pagespeed: {
      title: 'PageSpeed Insights',
      mobile: 'Móvil',
      desktop: 'Escritorio',
      coreWebVitals: 'Core Web Vitals',
      performance: 'Rendimiento',
      accessibility: 'Accesibilidad',
      bestPractices: 'Mejores Prácticas',
      seo: 'SEO',
      fcp: 'First Contentful Paint',
      fcpDesc: 'Tiempo hasta el primer texto/imagen',
      lcp: 'Largest Contentful Paint',
      lcpDesc: 'Tiempo hasta el elemento más grande',
      cls: 'Cumulative Layout Shift',
      clsDesc: 'Puntuación de estabilidad visual',
      tbt: 'Total Blocking Time',
      tbtDesc: 'Bloqueo del hilo principal',
      speedIndex: 'Speed Index',
      speedIndexDesc: 'Qué tan rápido carga el contenido',
      tti: 'Time to Interactive',
      ttiDesc: 'Tiempo hasta la interactividad completa',
    },
    faq: {
      badge: 'Preguntas Frecuentes',
      title: 'Todo lo que necesitas saber antes de lanzar tu auditoría',
      items: [
        {
          question: "¿Qué incluye la auditoría SEO de 200 puntos de Crawlers.fr?",
          answer: "La auditoría analiza 200 criterios técnicos en 12 categorías: meta tags, velocidad, datos estructurados, enlazado interno, accesibilidad móvil, seguridad HTTPS, Core Web Vitals, sitemap, robots.txt, E-E-A-T, indexación y compatibilidad LLM. Recibes una puntuación global, recomendaciones priorizadas y código correctivo listo para implementar."
        },
        {
          question: "¿Cómo ser citado por ChatGPT, Perplexity y Gemini?",
          answer: "Necesitas optimizar tu GEO (Generative Engine Optimization): datos estructurados JSON-LD ricos, contenido E-E-A-T verificado, autorización de crawlers IA en tu robots.txt, y frases 'citables' en tu contenido. Crawlers.fr mide tu puntuación GEO y tu Cuota de Voz LLM en 4 modelos simultáneamente."
        },
        {
          question: "¿Cuánto tiempo toma una auditoría completa?",
          answer: "Menos de 5 minutos. Ingresa tu URL, Crawlers.fr ejecuta 7 algoritmos en paralelo: crawl técnico, análisis PageSpeed, puntuación GEO, visibilidad LLM, datos estructurados, seguridad y E-E-A-T. El informe completo con correcciones está disponible de inmediato."
        },
        {
          question: "¿Cuál es la diferencia entre SEO clásico y GEO?",
          answer: "El SEO clásico optimiza tu posicionamiento en Google. El GEO optimiza tu citabilidad en las respuestas de IA generativa (ChatGPT, Perplexity, Gemini, Claude). En 2026, el 40% de las búsquedas pasan por un motor IA. Crawlers.fr es la primera herramienta francófona que cubre ambos simultáneamente."
        },
        {
          question: "¿Por qué Crawlers.fr cuesta 29€/mes en vez de 200€+?",
          answer: "Aplicamos el 'dividendo de la IA': los costos de infraestructura bajan estructuralmente gracias a los avances de los modelos. En lugar de maximizar márgenes, trasladamos estos ahorros a nuestros precios. Resultado: una auditoría que costaba 2.000€ en agencia ahora es accesible a 29€/mes, auditorías ilimitadas incluidas."
        }
      ],
    },
    footer: {
      builtWith: 'Creado con',
      tagline: 'para la era de la IA',
      poweredBy: 'Impulsado por',
      alsoDiscover: 'Descubre también',
    },
    quota: {
      title: 'Cuota Diaria Excedida',
      description: 'La API gratuita de PageSpeed Insights ha alcanzado su límite diario. Generalmente se restablece a medianoche, hora del Pacífico.',
      options: 'Opciones:',
      tryBotChecker: 'Prueba la pestaña Verificador de Bots IA (sin límites de cuota)',
      useOfficial: 'Usa el sitio oficial de PageSpeed Insights de Google',
      comeBack: 'Vuelve mañana cuando se restablezca la cuota',
      retry: 'Reintentar',
    },
    news: {
      title: 'Noticias SEO / LLM / GEO',
      searchPlaceholder: 'Buscar artículos...',
      refresh: 'Actualizar',
      newSource: 'Nueva fuente descubierta:',
      noResults: 'No se encontraron artículos',
      sourcesCount: '{count} fuentes monitoreadas',
      lastUpdate: 'Última actualización',
    },
    help: {
      learnMore: 'Más información',
      viewInLexicon: 'Ver en el glosario',
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectDefaultLanguage(): Language {
  const saved = localStorage.getItem('app-language');
  if (saved === 'fr' || saved === 'en' || saved === 'es') return saved;

  const browserLang = (navigator.language || '').toLowerCase();
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('es')) return 'es';
  return 'fr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectDefaultLanguage);

  const setLanguage = (lang: Language) => {
    localStorage.setItem('app-language', lang);
    setLanguageState(lang);
  };

  // Dynamically update <html lang> so crawlers detect the active language
  useEffect(() => {
    const langMap: Record<Language, string> = { fr: 'fr', en: 'en', es: 'es' };
    document.documentElement.lang = langMap[language];
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}