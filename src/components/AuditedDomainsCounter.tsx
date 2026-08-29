import { useEffect, useState } from 'react';
import { getAuditedDomainsCount } from '@/lib/auditedDomains.functions';

interface Props {
  /** Phrase courte affichée sous le chiffre. */
  label?: string;
  className?: string;
}

/**
 * Preuve sociale : nombre de noms de domaine réellement audités par Crawlers.
 * Le total affiché = X (compteur réel SQL) + 1000, jamais en dessous de 1000.
 */
export function AuditedDomainsCounter({
  label = 'noms de domaine audités par Crawlers',
  className = '',
}: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuditedDomainsCount()
      .then((res) => { if (!cancelled) setCount(res.count); })
      .catch(() => { /* compteur purement décoratif : un échec reste silencieux */ });
    return () => { cancelled = true; };
  }, []);

  const BASE_OFFSET = 1000;

  // Le bloc est toujours rendu (hauteur réservée) : seul le chiffre s'actualise,
  // ce qui évite tout décalage visuel après l'hydratation.
  const total = BASE_OFFSET + Math.max(count ?? 0, 0);


  return (
    <div className={`mx-auto max-w-2xl px-4 py-8 text-center ${className}`}>
      <p
        className="text-3xl font-extrabold tabular-nums text-foreground sm:text-4xl"
        aria-live="polite"
      >
        {total.toLocaleString('fr-FR')}{count === null ? '+' : ''}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export default AuditedDomainsCounter;
