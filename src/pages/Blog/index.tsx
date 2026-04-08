import { memo, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Calendar, ArrowRight, User, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { blogArticles } from '@/data/blogArticles';
import { supabase } from '@/integrations/supabase/client';

interface DbArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  title_en: string | null;
  title_es: string | null;
  excerpt_en: string | null;
  excerpt_es: string | null;
}

const translations = {
  fr: {
    title: 'Blog & Ressources',
    subtitle: 'Guides, tutoriels et actualités sur le SEO, le GEO et l\'optimisation pour les moteurs IA.',
    readMore: 'Lire l\'article',
    metaTitle: 'Blog SEO & GEO | Ressources Crawlers AI',
    metaDescription: 'Découvrez nos articles et guides sur le SEO, le GEO et l\'optimisation de visibilité pour les moteurs de recherche IA comme ChatGPT et Perplexity.',
    generatedBadge: 'Veille auto',
  },
  en: {
    title: 'Blog & Resources',
    subtitle: 'Guides, tutorials and news about SEO, GEO and AI search engine optimization.',
    readMore: 'Read article',
    metaTitle: 'SEO & GEO Blog | Crawlers AI Resources',
    metaDescription: 'Discover our articles and guides on SEO, GEO and visibility optimization for AI search engines like ChatGPT and Perplexity.',
    generatedBadge: 'Auto-generated',
  },
  es: {
    title: 'Blog y Recursos',
    subtitle: 'Guías, tutoriales y noticias sobre SEO, GEO y optimización para motores de búsqueda IA.',
    readMore: 'Leer artículo',
    metaTitle: 'Blog SEO y GEO | Recursos Crawlers AI',
    metaDescription: 'Descubre nuestros artículos y guías sobre SEO, GEO y optimización de visibilidad para motores de búsqueda IA como ChatGPT y Perplexity.',
    generatedBadge: 'Auto-generado',
  },
};

function BlogIndexComponent() {
  const { language } = useLanguage();
  useCanonicalHreflang('/blog');
  const t = translations[language] || translations.fr;
  const [dbArticles, setDbArticles] = useState<DbArticle[]>([]);

  // Fetch dynamic articles from database
  useEffect(() => {
    async function fetchDbArticles() {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('id, slug, title, excerpt, image_url, published_at, created_at, title_en, title_es, excerpt_en, excerpt_es')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        // Filter out articles that already exist as static articles
        const staticSlugs = new Set(blogArticles.map(a => a.slug));
        setDbArticles(data.filter(a => !staticSlugs.has(a.slug)));
      }
    }
    fetchDbArticles();
  }, []);

  // ItemList schema for blog listing
  useEffect(() => {
    const allArticleSlugs = [
      ...blogArticles.map(a => ({ slug: a.slug, name: a.title[language] || a.title.fr })),
      ...dbArticles.map(a => ({ slug: a.slug, name: a.title })),
    ];
    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": t.metaTitle,
      "description": t.metaDescription,
      "url": "https://crawlers.fr/blog",
      "mainEntity": {
        "@type": "ItemList",
        "itemListElement": allArticleSlugs.map((article, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "url": `https://crawlers.fr/blog/${article.slug}`,
          "name": article.name,
        })),
      },
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'blog-index');
    script.textContent = JSON.stringify(itemListSchema);
    document.head.appendChild(script);
    return () => { document.querySelectorAll('script[data-schema="blog-index"]').forEach(el => el.remove()); };
  }, [language, t, dbArticles]);

  return (
    <>
      <Helmet>
        <title>Blog Crawlers.fr — Actualités SEO, GEO et IA | Crawlers.fr</title>
        <meta name="description" content="Blog Crawlers.fr — actualités SEO, GEO et visibilité IA. Guides pratiques, études de cas, veille algorithmique Google et LLMs." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/blog" />
        <meta property="og:title" content="Blog Crawlers.fr — Actualités SEO, GEO et IA | Crawlers.fr" />
        <meta property="og:description" content="Blog Crawlers.fr — actualités SEO, GEO et visibilité IA. Guides pratiques, études de cas, veille algorithmique Google et LLMs." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Blog Crawlers.fr — Actualités SEO, GEO et IA | Crawlers.fr" />
        <meta name="twitter:description" content="Blog Crawlers.fr — actualités SEO, GEO et visibilité IA. Guides pratiques, études de cas, veille algorithmique Google et LLMs." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {t.title}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t.subtitle}
              </p>
            </div>

            {/* Guide SEO/GEO Banner */}
            <div className="mb-8 p-4 rounded-lg border border-primary/20 bg-primary/5 text-center">
              <Link to="/guide-audit-seo" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <ArrowRight className="h-4 w-4" />
                {language === 'es' ? '📘 Leer nuestro Guía Completa del Audit SEO/GEO en 2026' : language === 'en' ? '📘 Read our Complete SEO/GEO Audit Guide for 2026' : '📘 Lire notre Guide Complet de l\'Audit SEO/GEO en 2026'}
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Static articles — reverse chronological */}
              {[...blogArticles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((article) => (
                <Link key={article.slug} to={`/blog/${article.slug}`} className="group">
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30">
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={article.heroImage.includes('unsplash.com') 
                          ? `${article.heroImage.replace(/[?&]w=\d+/, '').replace(/[?&]q=\d+/, '')}${article.heroImage.includes('?') ? '&' : '?'}w=640&q=75&auto=format`
                          : article.heroImage}
                        alt={article.heroAlt[language] || article.heroAlt.fr}
                        width={640}
                        height={360}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {article.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(article.date).toLocaleDateString(
                            language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
                            { month: 'short', day: 'numeric', year: 'numeric' }
                          )}
                        </span>
                      </div>
                      <h2 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {article.title[language] || article.title.fr}
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {article.description[language] || article.description.fr}
                      </p>
                      <div className="flex items-center gap-1 text-sm font-medium text-primary">
                        {t.readMore}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}

              {/* Dynamic DB articles */}
              {dbArticles.map((article) => (
                <Link key={article.slug} to={`/blog/${article.slug}`} className="group">
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 relative">
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={article.image_url || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80'}
                        alt={(language === 'en' ? article.title_en : language === 'es' ? article.title_es : null) || article.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <Badge className="absolute top-3 left-3 bg-primary/90 text-primary-foreground border-0 gap-1">
                        <Sparkles className="h-3 w-3" />
                        {t.generatedBadge}
                      </Badge>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Crawlers.fr
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(article.published_at || article.created_at).toLocaleDateString(
                            language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
                            { month: 'short', day: 'numeric', year: 'numeric' }
                          )}
                        </span>
                      </div>
                      <h2 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {(language === 'en' ? article.title_en : language === 'es' ? article.title_es : null) || article.title}
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {(language === 'en' ? article.excerpt_en : language === 'es' ? article.excerpt_es : null) || article.excerpt || ''}
                      </p>
                      <div className="flex items-center gap-1 text-sm font-medium text-primary">
                        {t.readMore}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default memo(BlogIndexComponent);
