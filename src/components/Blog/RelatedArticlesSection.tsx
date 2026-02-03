import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleLinks, type InternalLink, type LexiqueLink } from '@/data/blogInternalLinks';

interface RelatedArticlesSectionProps {
  currentSlug: string;
}

const translations = {
  fr: {
    relatedArticles: 'Articles connexes',
    lexiqueTerms: 'Définitions du Lexique SEO/GEO',
    readMore: 'Lire l\'article',
    seeDefinition: 'Voir la définition',
  },
  en: {
    relatedArticles: 'Related Articles',
    lexiqueTerms: 'SEO/GEO Glossary Definitions',
    readMore: 'Read article',
    seeDefinition: 'See definition',
  },
  es: {
    relatedArticles: 'Artículos relacionados',
    lexiqueTerms: 'Definiciones del Lexique SEO/GEO',
    readMore: 'Leer artículo',
    seeDefinition: 'Ver definición',
  },
};

function RelatedArticleCard({ article, lang }: { article: InternalLink; lang: 'fr' | 'en' | 'es' }) {
  const t = translations[lang];
  
  return (
    <Link
      to={`/blog/${article.slug}`}
      className="group block p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
            {article.title[lang]}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {article.description[lang]}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-3 group-hover:gap-2 transition-all">
            {t.readMore}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function LexiqueTermCard({ term, lang }: { term: LexiqueLink; lang: 'fr' | 'en' | 'es' }) {
  const t = translations[lang];
  
  return (
    <Link
      to={`/lexique#${term.anchor}`}
      className="group flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-muted/30 hover:border-primary/30 hover:bg-muted/50 transition-all duration-200"
    >
      <div className="p-2 rounded-md bg-accent/10 text-accent shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
          {term.term}
        </span>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {term.description[lang]}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}

function RelatedArticlesSectionComponent({ currentSlug }: RelatedArticlesSectionProps) {
  const { language } = useLanguage();
  const lang = (language as 'fr' | 'en' | 'es') || 'fr';
  const t = translations[lang];
  
  const links = getArticleLinks(currentSlug);
  
  if (!links) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-border">
      {/* Related Articles */}
      {links.relatedArticles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            {t.relatedArticles}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {links.relatedArticles.map((article) => (
              <RelatedArticleCard key={article.slug} article={article} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Lexique Terms */}
      {links.lexiqueTerms.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" />
            {t.lexiqueTerms}
          </h2>
          <div className="grid gap-2">
            {links.lexiqueTerms.map((term) => (
              <LexiqueTermCard key={term.anchor} term={term} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export const RelatedArticlesSection = memo(RelatedArticlesSectionComponent);
