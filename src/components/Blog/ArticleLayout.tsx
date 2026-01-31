import { memo, ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AuthorBio } from './AuthorBio';
import { SourcesSection } from './SourcesSection';
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
}

function ArticleLayoutComponent({
  title,
  description,
  author = 'Adrien',
  date,
  heroImage,
  heroAlt,
  children,
  sources = [],
}: ArticleLayoutProps) {
  const { language } = useLanguage();

  const formattedDate = new Date(date).toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <>
      <Helmet>
        <title>{title} | Crawlers AI</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={heroImage} />
        <meta property="og:type" content="article" />
        <meta name="author" content={author} />
        <meta property="article:published_time" content={date} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <article className="pb-16">
          {/* Hero Section */}
          <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[500px] overflow-hidden">
            <img
              src={heroImage}
              alt={heroAlt}
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </div>

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

            {/* Author Bio */}
            <AuthorBio author={author} />
          </div>
        </article>

        <Footer />
      </div>
    </>
  );
}

export const ArticleLayout = memo(ArticleLayoutComponent);
