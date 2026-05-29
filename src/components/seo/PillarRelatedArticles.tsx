import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { articleInternalLinks } from '@/data/blogInternalLinks';

interface PillarRelatedArticlesProps {
  /** Blog slugs to surface as related articles for this pillar */
  slugs: string[];
  /** Section title — defaults to "Articles connexes" */
  title?: string;
}

/**
 * Renders a "Articles connexes" block on a pillar page that links to
 * 2-3 blog articles. Reuses titles/descriptions from blogInternalLinks (FR).
 */
function PillarRelatedArticlesComponent({ slugs, title = 'Articles connexes' }: PillarRelatedArticlesProps) {
  const articles = slugs
    .map((slug) => {
      const entry = articleInternalLinks[slug];
      // Prefer self-entry; otherwise look up via first related article that matches
      if (entry?.relatedArticles?.[0] && slug in articleInternalLinks) {
        // Re-derive title/desc from any entry referencing this slug
        for (const links of Object.values(articleInternalLinks)) {
          const found = links.relatedArticles.find((a) => a.slug === slug);
          if (found) return found;
        }
      }
      // Fallback: minimal card with slug as title
      return {
        slug,
        title: { fr: slug.replace(/-/g, ' '), en: slug, es: slug },
        description: { fr: '', en: '', es: '' },
      };
    });

  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="pillar-related-heading" className="container mx-auto px-4 py-12 mt-12 border-t border-border">
      <h2 id="pillar-related-heading" className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            to={`/blog/${article.slug}`}
            className="group block p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <p className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
              {article.title.fr}
            </p>
            {article.description.fr && (
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {article.description.fr}
              </p>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
              Lire l'article
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export const PillarRelatedArticles = memo(PillarRelatedArticlesComponent);
