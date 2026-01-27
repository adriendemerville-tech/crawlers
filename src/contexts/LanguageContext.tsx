import { createContext, useContext, useState, ReactNode } from 'react';

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
        crawlers: 'Partenaire pédagogue de votre référencement',
        geo: 'Analyseur GEO',
        pagespeed: 'Analyse de Performance',
        llm: 'Vérification LLM',
      },
      headline: {
        crawlers: 'Votre site est-il prêt pour',
        crawlersHighlight: "l'ère de l'IA",
        geo: 'Optimisez pour',
        geoHighlight: "la découverte IA",
        pagespeed: 'Quelle est la vitesse de',
        pagespeedHighlight: 'votre site',
        llm: 'Êtes-vous visible dans',
        llmHighlight: 'les LLMs',
      },
      subheadline: {
        crawlers: "Interrogez gratuitement toutes les intelligences artificielles grand public en une seule fois. Vérifiez instantanément si les crawlers IA majeurs peuvent accéder à votre contenu. Outil de référence 2026 en France.",
        geo: "Mesurez votre score d'Optimisation pour Moteurs Génératifs 2026. Obtenez des recommandations actionnables pour améliorer votre visibilité IA en France et en Europe.",
        pagespeed: "Obtenez des insights PageSpeed détaillés avec les Core Web Vitals 2026. Comprenez performance, accessibilité, SEO et bonnes pratiques pour votre site en France.",
        llm: "Analysez comment GPT-4, Claude, Gemini et Perplexity perçoivent et recommandent votre site en 2026. Découvrez votre réputation IA en France.",
      },
      button: {
        crawlers: 'Vérifier les Bots',
        geo: 'Analyser GEO',
        pagespeed: 'Analyser Vitesse',
        llm: 'Analyser LLM',
        loading: {
          crawlers: 'Scan en cours...',
          geo: 'Analyse en cours...',
          pagespeed: 'Analyse en cours...',
          llm: 'Analyse en cours...',
        },
      },
      trust: {
        noSignup: '',
        instant: 'Résultats instantanés',
        free: '100% gratuit',
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
      title: 'Tout savoir sur les crawlers IA et le GEO',
      items: [
        {
          question: "Qu'est-ce qu'un crawler IA et pourquoi est-ce important ?",
          answer: "Un crawler IA est un robot qui parcourt le web pour collecter des données destinées à entraîner des modèles de langage (LLM) comme ChatGPT, Claude ou Gemini. Si votre site est accessible à ces crawlers, votre contenu peut être cité et référencé dans les réponses des assistants IA, générant du trafic qualifié."
        },
        {
          question: "Qu'est-ce que le score GEO et comment l'améliorer ?",
          answer: "Le score GEO (Generative Engine Optimization) mesure l'optimisation de votre site pour les moteurs de recherche génératifs. Pour l'améliorer : ajoutez des données structurées JSON-LD, optimisez vos balises meta, utilisez une hiérarchie H1/H2 claire, et assurez-vous que votre sitemap est accessible."
        },
        {
          question: 'Comment bloquer ou autoriser les bots IA sur mon site ?',
          answer: "Modifiez votre fichier robots.txt à la racine de votre site. Pour bloquer GPTBot : ajoutez 'User-agent: GPTBot' suivi de 'Disallow: /'. Pour l'autoriser : utilisez 'Allow: /' à la place. Répétez pour chaque bot (ClaudeBot, Google-Extended, etc.)."
        },
        {
          question: 'Quels sont les principaux crawlers IA à surveiller ?',
          answer: "Les principaux crawlers IA sont : GPTBot et ChatGPT-User (OpenAI), ClaudeBot (Anthropic), Google-Extended (Google AI), PerplexityBot (Perplexity), CCBot (Common Crawl) et Applebot-Extended (Apple Intelligence). Chacun a ses propres règles de respect du robots.txt."
        },
        {
          question: "Pourquoi mon score PageSpeed affecte-t-il ma visibilité IA ?",
          answer: "Un site lent peut empêcher les crawlers IA de charger correctement votre contenu. Les Core Web Vitals (LCP, FID, CLS) influencent non seulement le SEO classique mais aussi la capacité des IA à analyser votre site. Un bon score PageSpeed garantit une meilleure indexation."
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
        crawlers: 'AI Bot Verification Tool',
        geo: 'GEO Analysis Tool',
        pagespeed: 'Performance Analysis Tool',
        llm: 'LLM Visibility Check',
      },
      headline: {
        crawlers: 'Is your site ready for the',
        crawlersHighlight: 'AI era',
        geo: 'Optimize for',
        geoHighlight: 'AI discovery',
        pagespeed: 'How fast is',
        pagespeedHighlight: 'your website',
        llm: 'Are you visible in',
        llmHighlight: 'LLMs',
      },
      subheadline: {
        crawlers: 'Query all major public AI systems at once for free. Instantly verify if AI crawlers can access your content. 2026 reference tool for Great Britain and USA.',
        geo: 'Measure your Generative Engine Optimization score 2026. Get actionable recommendations to improve AI visibility in Great Britain and USA.',
        pagespeed: 'Get detailed PageSpeed Insights with Core Web Vitals 2026. Understand performance, accessibility, SEO and best practices for Great Britain and USA.',
        llm: 'Analyze how GPT-4, Claude, Gemini and Perplexity perceive and recommend your site in 2026. Discover your AI reputation in Great Britain and USA.',
      },
      button: {
        crawlers: 'Check Bots',
        geo: 'Analyze GEO',
        pagespeed: 'Analyze Speed',
        llm: 'Analyze LLM',
        loading: {
          crawlers: 'Scanning...',
          geo: 'Analyzing...',
          pagespeed: 'Analyzing...',
          llm: 'Analyzing...',
        },
      },
      trust: {
        noSignup: '',
        instant: 'Instant results',
        free: '100% free',
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
      title: 'Everything about AI crawlers and GEO',
      items: [
        {
          question: 'What is an AI crawler and why does it matter?',
          answer: 'An AI crawler is a bot that crawls the web to collect data for training language models (LLMs) like ChatGPT, Claude, or Gemini. If your site is accessible to these crawlers, your content can be cited and referenced in AI assistant responses, driving qualified traffic.'
        },
        {
          question: 'What is the GEO score and how can I improve it?',
          answer: 'The GEO score (Generative Engine Optimization) measures how well your site is optimized for generative search engines. To improve it: add JSON-LD structured data, optimize your meta tags, use a clear H1/H2 hierarchy, and ensure your sitemap is accessible.'
        },
        {
          question: 'How do I block or allow AI bots on my site?',
          answer: "Edit your robots.txt file at your site root. To block GPTBot: add 'User-agent: GPTBot' followed by 'Disallow: /'. To allow it: use 'Allow: /' instead. Repeat for each bot (ClaudeBot, Google-Extended, etc.)."
        },
        {
          question: 'What are the main AI crawlers to monitor?',
          answer: 'The main AI crawlers are: GPTBot and ChatGPT-User (OpenAI), ClaudeBot (Anthropic), Google-Extended (Google AI), PerplexityBot (Perplexity), CCBot (Common Crawl), and Applebot-Extended (Apple Intelligence). Each has its own robots.txt compliance rules.'
        },
        {
          question: 'Why does my PageSpeed score affect AI visibility?',
          answer: 'A slow site can prevent AI crawlers from properly loading your content. Core Web Vitals (LCP, FID, CLS) affect not only classic SEO but also the ability of AI to analyze your site. A good PageSpeed score ensures better indexation.'
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
        crawlers: 'Verificador de Bots IA',
        geo: 'Analizador GEO',
        pagespeed: 'Análisis de Rendimiento',
        llm: 'Verificación LLM',
      },
      headline: {
        crawlers: '¿Está tu sitio listo para',
        crawlersHighlight: 'la era de la IA',
        geo: 'Optimiza para',
        geoHighlight: 'el descubrimiento IA',
        pagespeed: '¿Qué tan rápido es',
        pagespeedHighlight: 'tu sitio web',
        llm: '¿Eres visible en',
        llmHighlight: 'los LLMs',
      },
      subheadline: {
        crawlers: 'Consulta gratis todas las inteligencias artificiales públicas de una sola vez. Verifica instantáneamente si los crawlers IA pueden acceder a tu contenido. Herramienta de referencia 2026 para España, México y Argentina.',
        geo: 'Mide tu puntuación de Optimización para Motores Generativos 2026. Obtén recomendaciones accionables para mejorar tu visibilidad IA en España, México y Argentina.',
        pagespeed: 'Obtén información detallada de PageSpeed con Core Web Vitals 2026. Entiende rendimiento, accesibilidad, SEO y mejores prácticas para España, México y Argentina.',
        llm: 'Analiza cómo GPT-4, Claude, Gemini y Perplexity perciben y recomiendan tu sitio en 2026. Descubre tu reputación IA en España, México y Argentina.',
      },
      button: {
        crawlers: 'Verificar Bots',
        geo: 'Analizar GEO',
        pagespeed: 'Analizar Velocidad',
        llm: 'Analizar LLM',
        loading: {
          crawlers: 'Escaneando...',
          geo: 'Analizando...',
          pagespeed: 'Analizando...',
          llm: 'Analizando...',
        },
      },
      trust: {
        noSignup: '',
        instant: 'Resultados instantáneos',
        free: '100% gratis',
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
      title: 'Todo sobre los crawlers de IA y GEO',
      items: [
        {
          question: '¿Qué es un crawler de IA y por qué es importante?',
          answer: 'Un crawler de IA es un bot que recorre la web para recopilar datos destinados a entrenar modelos de lenguaje (LLM) como ChatGPT, Claude o Gemini. Si tu sitio es accesible para estos crawlers, tu contenido puede ser citado y referenciado en las respuestas de los asistentes de IA, generando tráfico cualificado.'
        },
        {
          question: '¿Qué es la puntuación GEO y cómo puedo mejorarla?',
          answer: 'La puntuación GEO (Generative Engine Optimization) mide qué tan optimizado está tu sitio para los motores de búsqueda generativos. Para mejorarla: añade datos estructurados JSON-LD, optimiza tus meta tags, usa una jerarquía H1/H2 clara, y asegúrate de que tu sitemap sea accesible.'
        },
        {
          question: '¿Cómo bloqueo o permito bots de IA en mi sitio?',
          answer: "Edita tu archivo robots.txt en la raíz de tu sitio. Para bloquear GPTBot: añade 'User-agent: GPTBot' seguido de 'Disallow: /'. Para permitirlo: usa 'Allow: /' en su lugar. Repite para cada bot (ClaudeBot, Google-Extended, etc.)."
        },
        {
          question: '¿Cuáles son los principales crawlers de IA a monitorear?',
          answer: 'Los principales crawlers de IA son: GPTBot y ChatGPT-User (OpenAI), ClaudeBot (Anthropic), Google-Extended (Google AI), PerplexityBot (Perplexity), CCBot (Common Crawl) y Applebot-Extended (Apple Intelligence). Cada uno tiene sus propias reglas de cumplimiento del robots.txt.'
        },
        {
          question: '¿Por qué mi puntuación PageSpeed afecta mi visibilidad IA?',
          answer: 'Un sitio lento puede impedir que los crawlers de IA carguen correctamente tu contenido. Los Core Web Vitals (LCP, FID, CLS) afectan no solo el SEO clásico sino también la capacidad de la IA para analizar tu sitio. Una buena puntuación PageSpeed garantiza una mejor indexación.'
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr');

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