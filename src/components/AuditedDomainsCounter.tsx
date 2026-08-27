import { useEffect, useState } from 'react';
import { getAuditedDomainsCount } from '@/lib/auditedDomains.functions';

interface Props {
  /** Phrase courte affichée sous le chiffre. */
  label?: string;
  className?: string;
}

/**
 * Preuve sociale : nombre de noms de domaine réellement audités par Crawlers.
 * Tant que le chiffre n'est pas chargé, rien n'est affiché — on ne montre
 * jamais un compteur factice ni une valeur arrondie à la main.
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

  if (count === null || count <= 0) return null;

  return (
    <div className={`mx-auto max-w-2xl px-4 py-8 text-center ${className}`}>
      <p
        className="text-3xl font-extrabold tabular-nums text-foreground sm:text-4xl"
        aria-live="polite"
      >
        {count.toLocaleString('fr-FR')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export default AuditedDomainsCounter;
