import { memo, useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ArticleLayout, HtmlContentRenderer } from '@/components/Blog';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleBySlug } from '@/data/blogArticles';
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

function ArticlePageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const [dbArticle, setDbArticle] = useState<DbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [useDbContent, setUseDbContent] = useState(false);

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

  // Récupérer l'article statique pour les métadonnées
  const staticArticle = getArticleBySlug(slug);
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
