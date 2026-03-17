// Shared translations for edge functions
export type Language = 'fr' | 'en' | 'es';

export interface GeoFactorTranslations {
  name: string;
  description: string;
  recommendation?: string;
}

export interface GeoTranslations {
  factors: {
    aiBots: {
      name: string;
      description: string;
      recommendation: (blockedBots: string) => string;
    };
    metaDescription: {
      name: string;
      description: string;
      recommendation: string;
    };
    structuredData: {
      name: string;
      description: string;
      recommendation: string;
    };
    contentStructure: {
      name: string;
      description: string;
      spaWarning: (framework: string) => string;
      addH1: string;
      moreHeadings: string;
      moreContent: string;
      lowWordCountSPA: string;
    };
    imageAlt: {
      name: string;
      description: string;
      recommendation: (count: number) => string;
    };
    socialMeta: {
      name: string;
      description: string;
      addOg: string;
      addTwitter: string;
      addBoth: string;
    };
    sitemap: {
      name: string;
      description: string;
      recommendation: string;
    };
    canonical: {
      name: string;
      description: string;
      recommendation: string;
      noCanonical: string;
      found: string;
    };
    intentInTitle: {
      name: string;
      description: string;
      recommendation: string;
    };
    faqOrSummary: {
      name: string;
      description: string;
      recommendation: string;
    };
  };
  details: {
    botsAllowed: (allowed: number, total: number) => string;
    noMetaDescription: string;
    noStructuredData: string;
    foundTypes: (types: string) => string;
    noImages: string;
    imagesWithAlt: (withAlt: number, total: number) => string;
    sitemapFound: string;
    noSitemap: string;
  };
}

export interface LLMTranslations {
  coreValueSummary: {
    basedOn: (count: number) => string;
    positivePerception: string;
    negativePerception: string;
    neutralPerception: string;
    lowVisibility: (domain: string) => string;
  };
  unableToRetrieve: (domain: string) => string;
}

const geoTranslations: Record<Language, GeoTranslations> = {
  fr: {
    factors: {
      aiBots: {
        name: 'Accès Crawlers IA',
        description: 'Les principaux bots IA peuvent accéder à votre contenu',
        recommendation: (bots) => `Autorisez les bots bloqués dans robots.txt : ${bots}`,
      },
      metaDescription: {
        name: 'Meta Description',
        description: 'Description meta de qualité pour les résumés IA',
        recommendation: 'Ajoutez une meta description descriptive (50-160 caractères) résumant le contenu de votre page',
      },
      structuredData: {
        name: 'Données Structurées (JSON-LD)',
        description: 'Balisage Schema.org pour la compréhension IA',
        recommendation: 'Ajoutez des données structurées JSON-LD (Organization, Article, Product, FAQ, etc.) pour aider les IA à comprendre votre contenu',
      },
      contentStructure: {
        name: 'Structure du Contenu',
        description: 'Titres clairs et contenu suffisant',
        spaWarning: (fw) => `${fw} détecté sans SSR - les crawlers IA peuvent ne pas voir le contenu dynamique. Envisagez SSR/SSG`,
        addH1: 'Ajoutez un titre H1 unique',
        moreHeadings: 'Utilisez plus de hiérarchie de titres (H2, H3)',
        moreContent: 'Ajoutez plus de contenu (visez 300+ mots)',
        lowWordCountSPA: 'Faible nombre de mots détecté - cela peut être dû au rendu côté client',
      },
      imageAlt: {
        name: 'Texte Alt des Images',
        description: 'Texte alt descriptif pour les images',
        recommendation: (count) => `Ajoutez un texte alt descriptif à ${count} image(s)`,
      },
      socialMeta: {
        name: 'Balises Meta Sociales',
        description: 'Open Graph et Twitter Cards',
        addOg: 'les balises Open Graph',
        addTwitter: 'les balises Twitter Card',
        addBoth: 'Ajoutez les balises Open Graph et Twitter Card',
      },
      sitemap: {
        name: 'Sitemap XML',
        description: 'Sitemap déclaré dans robots.txt',
        recommendation: 'Ajoutez une directive Sitemap dans votre fichier robots.txt pointant vers votre sitemap XML',
      },
      canonical: {
        name: 'URL Canonique',
        description: 'Balise canonical pour éviter le contenu dupliqué',
        recommendation: 'Ajoutez une balise <link rel="canonical" href="..."> dans votre section <head> pour indiquer la version préférée de cette page',
        noCanonical: 'Aucune balise canonical trouvée dans <head>',
        found: 'Balise canonical trouvée',
      },
      intentInTitle: {
        name: 'Intention dans le Titre',
        description: 'Le mot-clé principal ou l\'intention est visible dans le titre et la première phrase',
        recommendation: 'Placez votre mot-clé principal dans le titre (H1 ou <title>) et dans la première phrase du contenu pour maximiser la pertinence IA',
      },
      faqOrSummary: {
        name: 'FAQ ou Résumé en Début',
        description: 'Présence d\'une FAQ ou d\'un résumé en haut de page (TL;DR)',
        recommendation: 'Ajoutez une section FAQ (avec balisage Schema FAQ) ou un résumé (TL;DR) en début d\'article pour faciliter l\'extraction par les IA',
      },
    },
    details: {
      botsAllowed: (allowed, total) => `${allowed}/${total} bots IA autorisés`,
      noMetaDescription: 'Aucune meta description trouvée',
      noStructuredData: 'Aucune donnée structurée trouvée',
      foundTypes: (types) => `Types trouvés : ${types}`,
      noImages: 'Aucune image trouvée',
      imagesWithAlt: (withAlt, total) => `${withAlt}/${total} images ont un texte alt`,
      sitemapFound: 'Sitemap trouvé dans robots.txt',
      noSitemap: 'Aucune référence sitemap dans robots.txt',
    },
  },
  en: {
    factors: {
      aiBots: {
        name: 'AI Crawlers Access',
        description: 'Major AI bots can access your content',
        recommendation: (bots) => `Allow blocked bots in robots.txt: ${bots}`,
      },
      metaDescription: {
        name: 'Meta Description',
        description: 'Quality meta description for AI summaries',
        recommendation: 'Add a descriptive meta description (50-160 characters) that summarizes your page content',
      },
      structuredData: {
        name: 'Structured Data (JSON-LD)',
        description: 'Schema.org markup for AI understanding',
        recommendation: 'Add JSON-LD structured data (Organization, Article, Product, FAQ, etc.) to help AI understand your content',
      },
      contentStructure: {
        name: 'Content Structure',
        description: 'Clear headings and sufficient content',
        spaWarning: (fw) => `Detected ${fw} without SSR - AI crawlers may not see dynamic content. Consider using SSR/SSG`,
        addH1: 'Add a single H1 heading',
        moreHeadings: 'Use more heading hierarchy (H2, H3)',
        moreContent: 'Add more content (aim for 300+ words)',
        lowWordCountSPA: 'Low word count detected - this may be due to client-side rendering',
      },
      imageAlt: {
        name: 'Image Alt Text',
        description: 'Descriptive alt text for images',
        recommendation: (count) => `Add descriptive alt text to ${count} image(s)`,
      },
      socialMeta: {
        name: 'Social Meta Tags',
        description: 'Open Graph and Twitter Cards',
        addOg: 'Open Graph tags',
        addTwitter: 'Twitter Card tags',
        addBoth: 'Add Open Graph and Twitter Card tags',
      },
      sitemap: {
        name: 'XML Sitemap',
        description: 'Sitemap declared in robots.txt',
        recommendation: 'Add a Sitemap directive to your robots.txt file pointing to your XML sitemap',
      },
      canonical: {
        name: 'Canonical URL',
        description: 'Canonical tag to avoid duplicate content',
        recommendation: 'Add a <link rel="canonical" href="..."> tag in your <head> section to indicate the preferred version of this page',
        noCanonical: 'No canonical tag found in <head>',
        found: 'Canonical tag found',
      },
      intentInTitle: {
        name: 'Intent in Title',
        description: 'Main keyword or intent visible in title and first sentence',
        recommendation: 'Place your main keyword in the title (H1 or <title>) and first sentence to maximize AI relevance',
      },
      faqOrSummary: {
        name: 'FAQ or Summary at Top',
        description: 'FAQ section or summary (TL;DR) at the top of the page',
        recommendation: 'Add a FAQ section (with Schema FAQ markup) or a summary (TL;DR) at the beginning of your article for easier AI extraction',
      },
    },
    details: {
      botsAllowed: (allowed, total) => `${allowed}/${total} AI bots allowed`,
      noMetaDescription: 'No meta description found',
      noStructuredData: 'No structured data found',
      foundTypes: (types) => `Found types: ${types}`,
      noImages: 'No images found',
      imagesWithAlt: (withAlt, total) => `${withAlt}/${total} images have alt text`,
      sitemapFound: 'Sitemap found in robots.txt',
      noSitemap: 'No sitemap reference in robots.txt',
    },
  },
  es: {
    factors: {
      aiBots: {
        name: 'Acceso de Crawlers IA',
        description: 'Los principales bots de IA pueden acceder a su contenido',
        recommendation: (bots) => `Autorice los bots bloqueados en robots.txt: ${bots}`,
      },
      metaDescription: {
        name: 'Meta Descripción',
        description: 'Meta descripción de calidad para resúmenes de IA',
        recommendation: 'Agregue una meta descripción descriptiva (50-160 caracteres) que resuma el contenido de su página',
      },
      structuredData: {
        name: 'Datos Estructurados (JSON-LD)',
        description: 'Marcado Schema.org para comprensión de IA',
        recommendation: 'Agregue datos estructurados JSON-LD (Organization, Article, Product, FAQ, etc.) para ayudar a la IA a entender su contenido',
      },
      contentStructure: {
        name: 'Estructura del Contenido',
        description: 'Encabezados claros y contenido suficiente',
        spaWarning: (fw) => `${fw} detectado sin SSR - los crawlers de IA pueden no ver el contenido dinámico. Considere usar SSR/SSG`,
        addH1: 'Agregue un encabezado H1 único',
        moreHeadings: 'Use más jerarquía de encabezados (H2, H3)',
        moreContent: 'Agregue más contenido (apunte a 300+ palabras)',
        lowWordCountSPA: 'Bajo conteo de palabras detectado - esto puede deberse al renderizado del lado del cliente',
      },
      imageAlt: {
        name: 'Texto Alt de Imágenes',
        description: 'Texto alt descriptivo para imágenes',
        recommendation: (count) => `Agregue texto alt descriptivo a ${count} imagen(es)`,
      },
      socialMeta: {
        name: 'Etiquetas Meta Sociales',
        description: 'Open Graph y Twitter Cards',
        addOg: 'etiquetas Open Graph',
        addTwitter: 'etiquetas Twitter Card',
        addBoth: 'Agregue etiquetas Open Graph y Twitter Card',
      },
      sitemap: {
        name: 'Sitemap XML',
        description: 'Sitemap declarado en robots.txt',
        recommendation: 'Agregue una directiva Sitemap a su archivo robots.txt apuntando a su sitemap XML',
      },
      canonical: {
        name: 'URL Canónica',
        description: 'Etiqueta canonical para evitar contenido duplicado',
        recommendation: 'Agregue una etiqueta <link rel="canonical" href="..."> en su sección <head> para indicar la versión preferida de esta página',
        noCanonical: 'No se encontró etiqueta canonical en <head>',
        found: 'Etiqueta canonical encontrada',
      },
      intentInTitle: {
        name: 'Intención en el Título',
        description: 'La palabra clave principal o intención visible en el título y primera frase',
        recommendation: 'Coloque su palabra clave principal en el título (H1 o <title>) y en la primera frase del contenido para maximizar la relevancia IA',
      },
      faqOrSummary: {
        name: 'FAQ o Resumen al Inicio',
        description: 'Sección FAQ o resumen (TL;DR) al inicio de la página',
        recommendation: 'Agregue una sección FAQ (con marcado Schema FAQ) o un resumen (TL;DR) al inicio de su artículo para facilitar la extracción por IA',
      },
    },
    details: {
      botsAllowed: (allowed, total) => `${allowed}/${total} bots de IA permitidos`,
      noMetaDescription: 'No se encontró meta descripción',
      noStructuredData: 'No se encontraron datos estructurados',
      foundTypes: (types) => `Tipos encontrados: ${types}`,
      noImages: 'No se encontraron imágenes',
      imagesWithAlt: (withAlt, total) => `${withAlt}/${total} imágenes tienen texto alt`,
      sitemapFound: 'Sitemap encontrado en robots.txt',
      noSitemap: 'Sin referencia de sitemap en robots.txt',
    },
  },
};

const llmTranslations: Record<Language, LLMTranslations> = {
  fr: {
    coreValueSummary: {
      basedOn: (count) => `Basé sur ${count} citation(s) LLM :`,
      positivePerception: 'La perception globale des modèles IA est favorable.',
      negativePerception: 'Certains modèles IA expriment des préoccupations concernant ce domaine.',
      neutralPerception: 'La perception des modèles IA est mitigée ou neutre.',
      lowVisibility: (domain) => `${domain} a une faible visibilité parmi les principaux LLM. Envisagez d'améliorer votre présence en ligne, vos données structurées et l'autorité de votre contenu pour être reconnu par les modèles IA.`,
    },
    unableToRetrieve: (domain) => `Impossible de récupérer des informations sur ${domain} depuis ce modèle.`,
  },
  en: {
    coreValueSummary: {
      basedOn: (count) => `Based on ${count} LLM citation(s):`,
      positivePerception: 'The overall perception across AI models is favorable.',
      negativePerception: 'Some AI models express concerns about this domain.',
      neutralPerception: 'The perception across AI models is mixed or neutral.',
      lowVisibility: (domain) => `${domain} has low visibility across major LLMs. Consider improving your online presence, structured data, and content authority to be recognized by AI models.`,
    },
    unableToRetrieve: (domain) => `Unable to retrieve information about ${domain} from this model.`,
  },
  es: {
    coreValueSummary: {
      basedOn: (count) => `Basado en ${count} cita(s) de LLM:`,
      positivePerception: 'La percepción general de los modelos de IA es favorable.',
      negativePerception: 'Algunos modelos de IA expresan preocupaciones sobre este dominio.',
      neutralPerception: 'La percepción de los modelos de IA es mixta o neutral.',
      lowVisibility: (domain) => `${domain} tiene baja visibilidad en los principales LLM. Considere mejorar su presencia en línea, datos estructurados y autoridad de contenido para ser reconocido por los modelos de IA.`,
    },
    unableToRetrieve: (domain) => `No se puede recuperar información sobre ${domain} de este modelo.`,
  },
};

export function getGeoTranslations(lang: Language): GeoTranslations {
  return geoTranslations[lang] || geoTranslations.fr;
}

export function getLLMTranslations(lang: Language): LLMTranslations {
  return llmTranslations[lang] || llmTranslations.fr;
}

export function parseLanguage(lang: string | null | undefined): Language {
  if (lang === 'en' || lang === 'es' || lang === 'fr') {
    return lang;
  }
  return 'fr';
}
