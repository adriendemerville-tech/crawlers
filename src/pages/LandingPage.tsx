import { memo, useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface LandingDraft {
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  content: string;
  target_keyword: string | null;
  published_at: string | null;
}

function LandingPageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const [landing, setLanding] = useState<LandingDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    
    const fetchLanding = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('seo_page_drafts' as any)
        .select('title, slug, meta_title, meta_description, content, target_keyword, published_at')
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('page_type', 'landing')
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setLanding(data as unknown as LandingDraft);
      }
      setLoading(false);
    };

    fetchLanding();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !landing) {
    return <Navigate to="/404" replace />;
  }

  const canonicalUrl = `https://crawlers.fr/landing/${landing.slug}`;

  return (
    <>
      <Helmet>
        <title>{landing.meta_title || landing.title}</title>
        <meta name="description" content={landing.meta_description || ''} />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={landing.meta_title || landing.title} />
        <meta property="og:description" content={landing.meta_description || ''} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="min-h-screen bg-background">
        <article className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {landing.title}
            </h1>
            {landing.target_keyword && (
              <p className="mt-3 text-lg text-muted-foreground">
                {landing.meta_description}
              </p>
            )}
          </header>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown>{landing.content}</ReactMarkdown>
          </div>
        </article>
      </main>
    </>
  );
}

export default memo(LandingPageComponent);
