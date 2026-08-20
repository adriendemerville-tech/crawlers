/**
 * Bloc citable réutilisable (GEO / LLM).
 *
 * Rendu SSR sous forme de <blockquote class="citable-passage"> : c'est le
 * format que les moteurs génératifs extraient le plus facilement.
 * Le texte doit être dérivé du contenu réel de la page, jamais inventé.
 */
interface CitablePassageProps {
  /** Phrase autoportante, factuelle, citable telle quelle. */
  children: React.ReactNode;
  /** Libellé de source affiché sous la citation (optionnel). */
  source?: string;
  className?: string;
}

export function CitablePassage({ children, source, className = '' }: CitablePassageProps) {
  return (
    <blockquote
      className={`citable-passage border-l-2 border-primary/60 bg-card/60 px-5 py-4 text-base leading-relaxed text-foreground ${className}`}
    >
      <p className="m-0">{children}</p>
      {source ? (
        <footer className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{source}</footer>
      ) : null}
    </blockquote>
  );
}
