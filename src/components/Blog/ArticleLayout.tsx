import { memo, ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from '@/lib/router-compat';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { AuthorBio } from './AuthorBio';
import { SourcesSection } from './SourcesSection';
import { RelatedArticlesSection } from './RelatedArticlesSection';
import { ResponsiveHeroImage } from './ResponsiveHeroImage';
import { buildImageSrcSet, buildImageUrl } from '@/lib/blog/imageUrl';
import { formatUpdatedDate } from '@/lib/blog/lastUpdated';

import { useLanguage } from '@/contexts/LanguageContext';
interface ArticleLayoutProps {
  title: string;
  description: string;
  author?: string;
  date: string;
  /** Jour ISO (YYYY-MM-DD) : renseigné uniquement en cas de révision réelle */
  updatedAt?: string | null;
  heroImage: string;
  heroAlt: string;
  /** Légende visible sous/au-dessus du hero (contexte éditorial). Défaut : heroAlt */
  heroCaption?: string;

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
  updatedAt = null,
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

  // Title, description, canonical, og/twitter tags and JSON-LD are rendered
  // server-side by the /blog/$slug route head() — never duplicate them here.




  return (
    <>
      <Helmet>
        {/* Preload hero image for faster LCP */}
        {heroImage && buildImageSrcSet(heroImage) && (
          <link
            rel="preload"
            as="image"
            href={buildImageUrl(heroImage, { width: 828, quality: 75 })}
            imageSrcSet={buildImageSrcSet(heroImage, [
              { width: 640, quality: 75 },
              { width: 828, quality: 75 },
              { width: 1200, quality: 80 },
            ])}
            imageSizes="100vw"
          />
        )}

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
            {/* Légende visible : contexte de l'illustration pour les lecteurs et les moteurs */}
            <figcaption className="absolute top-4 left-4 sm:top-6 sm:left-6 max-w-[85%] sm:max-w-md rounded-md border border-border/60 bg-background/75 px-2.5 py-1 text-xs leading-snug text-muted-foreground backdrop-blur-sm">
              {heroCaption || heroAlt}
            </figcaption>
          </figure>


          {/* Content Container */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-32 relative z-10">
            {/* Breadcrumb visible */}
            <nav aria-label="Fil d'Ariane" className="mb-6 text-sm">
              <ol className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <li>
                  <Link to="/" className="hover:text-foreground transition-colors">
                    {language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home'}
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground/50">/</li>
                <li>
                  <Link to="/blog" className="hover:text-foreground transition-colors">
                    Blog
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground/50">/</li>
                <li aria-current="page" className="text-foreground truncate max-w-[60vw]">
                  {title}
                </li>
              </ol>
            </nav>

            {/* Header */}
            <header className="mb-8">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-4">
                {title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link to={`/auteur/${author.toLowerCase().includes('adrien') ? 'adrien-de-volontat' : author.toLowerCase().replace(/\s+/g, '-')}`} rel="author" className="font-medium text-foreground hover:text-primary transition-colors">
                  {author === 'Adrien' ? 'Adrien de Volontat' : author}
                </Link>
                <span className="text-muted-foreground/50">•</span>
                <time dateTime={date}>{formattedDate}</time>
                {updatedAt && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span>
                      {language === 'fr'
                        ? 'Mis à jour le '
                        : language === 'es'
                          ? 'Actualizado el '
                          : 'Updated on '}
                      <time dateTime={updatedAt}>{formatUpdatedDate(updatedAt, language)}</time>
                    </span>
                  </>
                )}
              </div>
            </header>

            {/* Chapeau citable : résumé autoportant, format privilégié par les moteurs génératifs */}
            {description && (
              <blockquote className="citable-passage mb-8 border-l-4 border-primary/40 bg-primary/5 rounded-r-lg px-5 py-4 text-base text-foreground/90 leading-relaxed not-italic">
                {description}
              </blockquote>
            )}

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
