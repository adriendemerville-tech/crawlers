import { Link } from '@/lib/router-compat';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { SILOS, type Silo } from '@/data/silos';

interface SiloNavProps {
  silo: Silo['id'];
  /** Page courante : elle est masquée de la liste pour éviter l'auto-lien */
  currentPath?: string;
  /** Titre de la section (H2) */
  heading?: string;
  className?: string;
}

/**
 * Bloc de maillage interne de silo : lien montant vers le pilier + liens
 * latéraux vers les satellites. Utilisé par les piliers et leurs satellites
 * pour maintenir une architecture en silos explicite (post-audit Semrush).
 */
export function SiloNav({ silo, currentPath, heading, className = '' }: SiloNavProps) {
  const data = SILOS[silo];
  if (!data) return null;

  const isPillar = currentPath === data.pillar.to;
  const satellites = data.satellites.filter((s) => s.to !== currentPath);

  return (
    <section className={`rounded-2xl border border-border bg-card/40 p-6 md:p-8 ${className}`}>
      <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-1">
        {heading ?? (isPillar ? 'Dans ce silo' : 'Remonter au pilier')}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">Intention couverte : {data.intent}</p>

      {!isPillar && (
        <Link
          to={data.pillar.to}
          className="flex items-center justify-between gap-4 rounded-xl border border-primary/40 p-4 mb-4 no-underline hover:border-primary transition-colors"
        >
          <span>
            <span className="block font-semibold text-foreground">{data.pillar.label}</span>
            {data.pillar.note && (
              <span className="block text-xs text-muted-foreground mt-1">{data.pillar.note}</span>
            )}
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-foreground/60" />
        </Link>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
        {satellites.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 no-underline hover:border-foreground/40 transition-colors"
            >
              <span className="font-medium text-foreground text-sm">{link.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-foreground/60" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
