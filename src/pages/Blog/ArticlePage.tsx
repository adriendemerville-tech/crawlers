import { memo, useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArticleLayout, HtmlContentRenderer } from '@/components/Blog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleBySlug, blogArticles } from '@/data/blogArticles';
import { articleContent } from '@/data/articleContents';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface DbArticle {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  status: string;
}

// Métadonnées SEO spécifiques par article (pour override le head)
const ARTICLE_SEO_OVERRIDES: Record<string, {
  title: string;
  description: string;
  ogTitle?: string;
}> = {
  'bloquer-autoriser-gptbot': {
    title: "Guide 2026 : Maîtriser GPTBot et les Crawlers IA | Crawlers.fr",
    description: "Guide complet : Comment configurer robots.txt pour GPTBot, ClaudeBot et Google-Extended. Avantages et risques pour votre SEO et GEO.",
    ogTitle: "Guide GPTBot & Crawlers IA 2026"
  },
  'crawler-definition-seo-geo': {
    title: "Un crawler c'est quoi ? Définition, rôle en SEO et GEO | Crawlers.fr",
    description: "Découvrez ce qu'est un crawler web : son histoire, son rôle crucial pour le SEO et le GEO, et pourquoi les crawlers IA changent la donne en 2026.",
    ogTitle: "Crawler Web : Définition Complète 2026"
  },
  'guide-visibilite-technique-ia': {
    title: "Robots.txt, JSON-LD, Sitemaps : Guide Technique Visibilité IA 2026 | Crawlers.fr",
    description: "Le guide ultime pour optimiser votre infrastructure technique : robots.txt, JSON-LD et sitemaps. Soyez visible sur Google ET sur les IA génératives.",
    ogTitle: "Guide Technique Visibilité IA 2026"
  },
  'comprendre-geo-vs-seo': {
    title: "GEO vs SEO : Comprendre le Generative Engine Optimization | Crawlers.fr",
    description: "Le SEO consistait à être trouvé. Le GEO consiste à être cité. Découvrez comment adapter votre stratégie pour ChatGPT, Gemini et Perplexity.",
    ogTitle: "GEO vs SEO : Le Match 2026"
  },
  'vendre-audit-ia-clients': {
    title: "Consultants : Comment vendre des audits GEO à vos clients | Crawlers.fr",
    description: "Feuille de route pour intégrer l'offre Visibilité IA à votre catalogue de services. Argumentaire, pricing et livrables pour audits GEO.",
    ogTitle: "Vendre des Audits GEO : Guide Consultant"
  },
  'site-invisible-chatgpt-solutions': {
    title: "Site invisible sur ChatGPT ? 3 erreurs techniques à corriger | Crawlers.fr",
    description: "Votre site n'apparaît pas dans les réponses de ChatGPT ? Découvrez les 3 erreurs techniques fatales et comment les corriger immédiatement.",
    ogTitle: "Invisible sur ChatGPT ? Voici pourquoi"
  },
  'google-sge-seo-preparation': {
    title: "Google SGE : Préparer son SEO à la Search Generative Experience | Crawlers.fr",
    description: "La SGE de Google change les règles du jeu SEO. Découvrez comment adapter votre stratégie pour gagner la position Zéro en 2026.",
    ogTitle: "Google SGE : Guide de Préparation SEO"
  },
  'mission-mise-aux-normes-ia': {
    title: "Consultants : Vendre une mission Mise aux normes IA (GEO) | Crawlers.fr",
    description: "Ne vendez plus du vent, vendez de la sécurité infrastructurelle. Comment pitcher et pricer une mission de conformité IA en 2026.",
    ogTitle: "Mission Mise aux Normes IA : Guide"
  },
  'json-ld-chatgpt-visibility': {
    title: "JSON-LD : Le secret pour être cité par ChatGPT et les IA | Crawlers.fr",
    description: "Le JSON-LD est la langue maternelle des LLM. Apprenez à structurer vos données pour maximiser vos citations dans les réponses IA.",
    ogTitle: "JSON-LD : Booster sa Visibilité IA"
  },
  'perplexity-ai-seo-strategy': {
    title: "Perplexity AI : Stratégie SEO pour être cité en source | Crawlers.fr",
    description: "Comment optimiser votre site pour apparaître comme source dans les réponses Perplexity. Stratégies GEO spécifiques 2026.",
    ogTitle: "Perplexity AI : Stratégie de Citation"
  },
  'llms-txt-specification': {
    title: "llms.txt : La nouvelle spécification pour les crawlers IA | Crawlers.fr",
    description: "Découvrez llms.txt, le nouveau standard qui permet de communiquer avec les LLM. Comment l'implémenter et pourquoi c'est crucial pour le GEO.",
    ogTitle: "llms.txt : Guide d'Implémentation"
  },
  'ai-plugin-json-chatgpt': {
    title: "ai-plugin.json : Rendre son site accessible à ChatGPT Plugins | Crawlers.fr",
    description: "Guide technique pour créer votre fichier ai-plugin.json et rendre votre site compatible avec l'écosystème ChatGPT Plugins.",
    ogTitle: "ai-plugin.json : Guide ChatGPT Plugins"
  },
};

const SITE_URL = 'https://crawlers.fr';

/**
 * Force les métadonnées dans le <head> via manipulation directe du DOM
 * Cela garantit que les balises sont correctement mises à jour même si Helmet a des conflits
 */
function forceMetaTags(slug: string, title: string, description: string, ogTitle?: string) {
  const canonicalUrl = `${SITE_URL}/blog/${slug}`;
  
  // 1. FORCE document.title
  document.title = title;
  
  // 2. FORCE meta description
  let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
  if (metaDesc) {
    metaDesc.content = description;
  } else {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    metaDesc.content = description;
    document.head.appendChild(metaDesc);
  }
  
  // 3. FORCE canonical - CRITIQUE pour éviter le duplicate content
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (canonical) {
    canonical.href = canonicalUrl;
  } else {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = canonicalUrl;
    document.head.appendChild(canonical);
  }
  
  // 4. FORCE Open Graph title
  let ogTitleMeta = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
  if (ogTitleMeta) {
    ogTitleMeta.content = ogTitle || title;
  } else {
    ogTitleMeta = document.createElement('meta');
    ogTitleMeta.setAttribute('property', 'og:title');
    ogTitleMeta.content = ogTitle || title;
    document.head.appendChild(ogTitleMeta);
  }
  
  // 5. FORCE Open Graph description
  let ogDescMeta = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
  if (ogDescMeta) {
    ogDescMeta.content = description;
  } else {
    ogDescMeta = document.createElement('meta');
    ogDescMeta.setAttribute('property', 'og:description');
    ogDescMeta.content = description;
    document.head.appendChild(ogDescMeta);
  }
  
  // 6. FORCE Open Graph URL
  let ogUrlMeta = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
  if (ogUrlMeta) {
    ogUrlMeta.content = canonicalUrl;
  } else {
    ogUrlMeta = document.createElement('meta');
    ogUrlMeta.setAttribute('property', 'og:url');
    ogUrlMeta.content = canonicalUrl;
    document.head.appendChild(ogUrlMeta);
  }
  
  // 7. FORCE Twitter title
  let twitterTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement;
  if (twitterTitle) {
    twitterTitle.content = ogTitle || title;
  } else {
    twitterTitle = document.createElement('meta');
    twitterTitle.name = 'twitter:title';
    twitterTitle.content = ogTitle || title;
    document.head.appendChild(twitterTitle);
  }
  
  // 8. FORCE Twitter description
  let twitterDesc = document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement;
  if (twitterDesc) {
    twitterDesc.content = description;
  } else {
    twitterDesc = document.createElement('meta');
    twitterDesc.name = 'twitter:description';
    twitterDesc.content = description;
    document.head.appendChild(twitterDesc);
  }
}

function ArticlePageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const [dbArticle, setDbArticle] = useState<DbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [useDbContent, setUseDbContent] = useState(false);

  // Récupérer l'article statique pour les métadonnées
  const staticArticle = getArticleBySlug(slug || '');
  
  // useEffect pour forcer les métadonnées au montage
  useEffect(() => {
    if (!slug) return;
    
    // Récupérer les métadonnées spécifiques ou construire à partir des données statiques
    const seoOverride = ARTICLE_SEO_OVERRIDES[slug];
    
    if (seoOverride) {
      // Utiliser les métadonnées optimisées manuellement
      forceMetaTags(slug, seoOverride.title, seoOverride.description, seoOverride.ogTitle);
    } else if (staticArticle) {
      // Fallback sur les données de l'article statique
      const title = `${staticArticle.title[language] || staticArticle.title.fr} | Crawlers.fr`;
      const description = staticArticle.description[language] || staticArticle.description.fr;
      forceMetaTags(slug, title, description);
    }
    
    // Cleanup: on ne restore pas les anciennes valeurs car la navigation SPA gère ça
    return () => {
      // Optionnel: reset au démontage si nécessaire
    };
  }, [slug, language, staticArticle]);

  useEffect(() => {
    async function fetchDbArticle() {
      if (!slug) return;
      
      try {
        const { data, error } = await supabase
          .from('blog_articles')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .single();

        if (data && !error) {
          setDbArticle(data);
          // Utiliser le contenu DB UNIQUEMENT si:
          // 1. Il n'y a pas de contenu statique JSX riche disponible
          // 2. ET le contenu DB est substantiel (plus de 500 caractères)
          // Le contenu statique JSX est TOUJOURS prioritaire car il contient les composants riches
          const hasStaticContent = !!articleContent[slug];
          if (!hasStaticContent && data.content && data.content.length > 500) {
            setUseDbContent(true);
          }
        }
      } catch (e) {
        console.log('Article not found in DB, using static content');
      } finally {
        setLoading(false);
      }
    }

    fetchDbArticle();
  }, [slug]);

  if (!slug) {
    return <Navigate to="/blog" replace />;
  }

  const staticContent = articleContent[slug];

  // Si chargement en cours
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Si aucun article trouvé (ni en DB ni en statique)
  if (!staticArticle && !dbArticle) {
    return <Navigate to="/blog" replace />;
  }

  // Déterminer les données à utiliser
  const title = dbArticle?.title || staticArticle?.title[language] || staticArticle?.title.fr || '';
  const description = dbArticle?.excerpt || staticArticle?.description[language] || staticArticle?.description.fr || '';
  const author = 'Adrien';
  const date = dbArticle?.published_at || dbArticle?.created_at || staticArticle?.date || new Date().toISOString();
  const heroImage = dbArticle?.image_url || staticArticle?.heroImage || '';
  const heroAlt = staticArticle?.heroAlt[language] || staticArticle?.heroAlt?.fr || title;
  const sources = staticArticle?.sources || [];

  // Déterminer le contenu à afficher
  const renderContent = () => {
    // Priorité 1: Contenu DB si substantiel et disponible
    if (useDbContent && dbArticle?.content) {
      return <HtmlContentRenderer html={dbArticle.content} />;
    }
    
    // Priorité 2: Contenu statique JSX (riche avec composants)
    if (staticContent) {
      return staticContent[language] || staticContent.fr;
    }
    
    // Priorité 3: Contenu DB basique (fallback)
    if (dbArticle?.content) {
      return <HtmlContentRenderer html={dbArticle.content} />;
    }

    // Pas de contenu disponible
    return <p>Contenu non disponible</p>;
  };

  return (
    <ArticleLayout
      title={title}
      description={description}
      author={author}
      date={date}
      heroImage={heroImage}
      heroAlt={heroAlt}
      sources={sources}
      slug={slug}
    >
      {renderContent()}
    </ArticleLayout>
  );
}

export default memo(ArticlePageComponent);
