import { memo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArticleLayout } from '@/components/Blog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleBySlug } from '@/data/blogArticles';
import { articleContent } from '@/data/articleContents';

function ArticlePageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();

  if (!slug) {
    return <Navigate to="/blog" replace />;
  }

  const article = getArticleBySlug(slug);

  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  const content = articleContent[slug];

  if (!content) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <ArticleLayout
      title={article.title[language] || article.title.fr}
      description={article.description[language] || article.description.fr}
      author={article.author}
      date={article.date}
      heroImage={article.heroImage}
      heroAlt={article.heroAlt[language] || article.heroAlt.fr}
      sources={article.sources}
    >
      {content[language] || content.fr}
    </ArticleLayout>
  );
}

export default memo(ArticlePageComponent);
