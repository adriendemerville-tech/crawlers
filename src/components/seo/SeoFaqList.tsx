/**
 * Liste de questions/réponses lisible par les crawlers.
 *
 * Contrairement à un accordéon Radix (qui ne monte le contenu qu'à
 * l'ouverture), <details> garde la réponse dans le DOM servi : elle est donc
 * indexable par Google et extractible par les LLM.
 */
export interface SeoFaqItem {
  question: string;
  answer: React.ReactNode;
}

interface SeoFaqListProps {
  items: SeoFaqItem[];
  /** Ouvre le premier élément par défaut. */
  defaultOpenFirst?: boolean;
  className?: string;
}

export function SeoFaqList({ items, defaultOpenFirst = true, className = '' }: SeoFaqListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => (
        <details
          key={item.question}
          open={defaultOpenFirst && index === 0}
          className="group rounded-lg border border-border bg-card px-5 py-4"
        >
          <summary className="cursor-pointer list-none marker:content-none">
            <h3 className="inline text-base font-medium text-foreground">{item.question}</h3>
          </summary>
          <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
