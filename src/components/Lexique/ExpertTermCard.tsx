import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ExpertTerm, expertCategories } from '@/data/expertTerms';
import { cn } from '@/lib/utils';

interface ExpertTermCardProps {
  term: ExpertTerm;
  language: string;
}

export function ExpertTermCard({ term, language }: ExpertTermCardProps) {
  const category = expertCategories[term.category];
  const categoryLabel = category.label[language as keyof typeof category.label] || category.label.fr;

  return (
    <Link
      to={`/lexique/${term.slug}`}
      className={cn(
        "group relative block rounded-xl border bg-card p-5 transition-all duration-300",
        "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1",
        "border-border/50 hover:border-primary/30"
      )}
    >
      {/* Category Badge */}
      <div className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium mb-3",
        category.bgColor, category.textColor, category.borderColor, "border"
      )}>
        {categoryLabel}
      </div>

      {/* Term Name */}
      <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors font-mono">
        {term.term}
      </h3>

      {/* Micro Definition */}
      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
        {term.microDefinition}
      </p>

      {/* Arrow indicator */}
      <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink className="h-4 w-4 text-primary" />
      </div>
    </Link>
  );
}
