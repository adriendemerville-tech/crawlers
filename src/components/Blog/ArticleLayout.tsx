import { memo, ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { AuthorBio } from './AuthorBio';
import { SourcesSection } from './SourcesSection';
import { RelatedArticlesSection } from './RelatedArticlesSection';
import { ResponsiveHeroImage } from './ResponsiveHeroImage';
import { useLanguage } from '@/contexts/LanguageContext';
interface ArticleLayoutProps {
  title: string;
  description: string;
  author?: string;
  date: string;
  heroImage: string;
  heroAlt: string;
  children: ReactNode;
  sources?: Array<{ title: string; url: string }>;
  slug?: string;
}

const SITE_URL = 'https://crawlers.fr';

function ArticleLayoutComponent({
  title,
  description,
  author = 'Adrien',
  date,
  heroImage,
  heroAlt,
  children,
  sources = [],
  slug = '',
}: ArticleLayoutProps) {
  const { language } = useLanguage();

  const formattedDate = new Date(date).toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  // Canonical URL — ALWAYS point to the clean URL without ?lang= to avoid duplicate content
  const canonicalUrl = slug 
    ? `${SITE_URL}/blog/${slug}`
    : `${SITE_URL}/blog`;

  // Hreflang alternates
  const hreflangFr = slug ? `${SITE_URL}/blog/${slug}` : `${SITE_URL}/blog`;
  const hreflangEn = slug ? `${SITE_URL}/blog/${slug}?lang=en` : `${SITE_URL}/blog?lang=en`;
  const hreflangEs = slug ? `${SITE_URL}/blog/${slug}?lang=es` : `${SITE_URL}/blog?lang=es`;

  // JSON-LD Article schema
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    image: heroImage,
    author: {
      '@type': 'Person',
      name: author,
      url: `${SITE_URL}/auteur/${author.toLowerCase()}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Crawlers.fr',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
    datePublished: date,
    dateModified: date,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    inLanguage: language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
    keywords: 'SEO, GEO, audit technique, visibilité IA, ChatGPT, Google SGE, JSON-LD, robots.txt',
  };

  // BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <>
      <Helmet>
        {/* Title & Description */}
        <title>{title} | Crawlers AI</title>
        <meta name="description" content={description} />

        {/* Canonical & Hreflang */}
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="fr" href={hreflangFr} />
        <link rel="alternate" hrefLang="en" href={hreflangEn} />
        <link rel="alternate" hrefLang="es" href={hreflangEs} />
        <link rel="alternate" hrefLang="x-default" href={hreflangFr} />

        {/* Robots */}
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-image-preview:large" />
        <meta name="bingbot" content="index, follow" />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={heroImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={heroAlt} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />
        <meta property="og:locale:alternate" content="fr_FR" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:locale:alternate" content="es_ES" />

        {/* Article specific OG */}
        <meta property="article:published_time" content={date} />
        <meta property="article:modified_time" content={date} />
        <meta property="article:author" content={author} />
        <meta property="article:section" content="SEO & GEO" />
        <meta property="article:tag" content="SEO" />
        <meta property="article:tag" content="GEO" />
        <meta property="article:tag" content="IA" />
        <meta property="article:tag" content="ChatGPT" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={heroImage} />
        <meta name="twitter:image:alt" content={heroAlt} />
        <meta name="twitter:site" content="@crawlers_fr" />
        <meta name="twitter:creator" content="@crawlers_fr" />

        {/* Author */}
        <meta name="author" content={author} />

        {/* GEO Meta Tags */}
        <meta name="geo.region" content="FR" />
        <meta name="geo.placename" content="France" />
        <meta name="geo.position" content="48.8566;2.3522" />
        <meta name="ICBM" content="48.8566, 2.3522" />

        {/* Additional SEO */}
        <meta name="revisit-after" content="7 days" />
        <meta name="rating" content="general" />
        <meta name="distribution" content="global" />

        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main>
          <article className="pb-16">
          {/* Hero Section */}
          <figure className="relative w-full h-[300px] sm:h-[400px] lg:h-[500px] overflow-hidden">
            <picture>
              <ResponsiveHeroImage
                src={heroImage}
                alt={heroAlt}
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </figure>

          {/* Content Container */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-32 relative z-10">
            {/* Header */}
            <header className="mb-8">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-4">
                {title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{author}</span>
                <span className="text-muted-foreground/50">•</span>
                <time dateTime={date}>{formattedDate}</time>
              </div>
            </header>

            {/* Article Content */}
            <div className="prose prose-lg prose-slate dark:prose-invert max-w-none
              prose-headings:font-bold prose-headings:text-foreground
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
              prose-li:text-muted-foreground
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground
              prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
            ">
              {children}
            </div>

            {/* Sources */}
            {sources.length > 0 && <SourcesSection sources={sources} />}

            {/* CTA Section */}
            <div className="my-10 p-6 md:p-8 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <p className="text-xl font-semibold text-foreground mb-2">
                Prêt à optimiser votre visibilité IA ?
              </p>
              <p className="text-sm text-foreground/70 mb-5 max-w-md mx-auto">
                Découvrez si votre site est bien référencé par ChatGPT, Gemini et Perplexity.
              </p>
              <Button asChild size="lg" variant="hero">
                <Link to="/audit-expert">
                  Lancer mon audit expert
                </Link>
              </Button>
            </div>

            {/* Related Articles & Lexique Links */}
            {slug && <RelatedArticlesSection currentSlug={slug} />}

            {/* Author Bio */}
            <AuthorBio author={author} />
          </div>
        </article>
        </main>

        <Footer />
      </div>
    </>
  );
}

export const ArticleLayout = memo(ArticleLayoutComponent);
