import { memo } from 'react';
import { getRouteApi } from '@tanstack/react-router';

import { ArticleLayout, HtmlContentRenderer } from '@/components/Blog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleBySlug } from '@/data/blogArticles';
import { articleContent } from '@/data/articleContents';

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
  title_en: string | null;
  title_es: string | null;
  excerpt_en: string | null;
  excerpt_es: string | null;
  content_en: string | null;
  content_es: string | null;
}

export { ARTICLE_SEO_OVERRIDES } from "./articleSeoOverrides";

const routeApi = getRouteApi('/blog/$slug');

function ArticlePageComponent() {
  const { slug } = routeApi.useParams();
  const loaderData = routeApi.useLoaderData();
  const { language } = useLanguage();

  const staticArticle = getArticleBySlug(slug || '');
  const dbArticle = (loaderData?.db as DbArticle | null) ?? null;

  // Le cas « slug inconnu » est traité côté loader (notFound), jamais ici :
  // un <Navigate> rendu pendant le SSR bloquait la réponse ~45 s.
  if (!staticArticle && !dbArticle) {
    return null;
  }


  const staticContent = articleContent[slug];
  // DB body wins only when there is no rich JSX content and the row is substantial
  const useDbContent = !staticContent && !!dbArticle?.content && dbArticle.content.length > 500;

  const getDbTranslated = (field: 'title' | 'excerpt' | 'content') => {
    if (!dbArticle) return null;
    if (language === 'en') return (dbArticle as any)[`${field}_en`] || dbArticle[field];
    if (language === 'es') return (dbArticle as any)[`${field}_es`] || dbArticle[field];
    return dbArticle[field];
  };

  const title = getDbTranslated('title') || staticArticle?.title[language] || staticArticle?.title.fr || '';
  const description = getDbTranslated('excerpt') || staticArticle?.description[language] || staticArticle?.description.fr || '';
  const author = 'Adrien';
  const date = dbArticle?.published_at || dbArticle?.created_at || staticArticle?.date || new Date().toISOString();
  const updatedAt = (loaderData?.updatedAt as string | null) ?? null;
  const heroImage = dbArticle?.image_url || staticArticle?.heroImage || '';
  // Alt descriptif : jamais le seul titre brut pour les articles issus du CMS.
  const heroAlt =
    staticArticle?.heroAlt[language] ||
    staticArticle?.heroAlt?.fr ||
    (title
      ? language === 'en'
        ? `Illustration for the article: ${title}`
        : language === 'es'
          ? `Ilustración del artículo: ${title}`
          : `Illustration de l'article : ${title}`
      : '');
  // Légende du hero : l'accroche de l'article, sinon l'alt.
  const heroCaption = description || heroAlt;

  const sources = staticArticle?.sources || [];

  const renderContent = () => {
    const translatedDbContent = getDbTranslated('content');

    if (useDbContent && translatedDbContent) {
      return <HtmlContentRenderer html={translatedDbContent} imageAltFallback={heroAlt} />;
    }
    if (staticContent) {
      return staticContent[language] || staticContent.fr;
    }
    if (translatedDbContent) {
      return <HtmlContentRenderer html={translatedDbContent} imageAltFallback={heroAlt} />;
    }
    return <p>Contenu non disponible</p>;
  };

  return (
    <ArticleLayout
      title={title}
      description={description}
      author={author}
      date={date}
      updatedAt={updatedAt}
      heroImage={heroImage}
      heroAlt={heroAlt}
      heroCaption={heroCaption}

      sources={sources}
      slug={slug}
    >
      {renderContent()}
    </ArticleLayout>
  );
}

export default memo(ArticlePageComponent);
