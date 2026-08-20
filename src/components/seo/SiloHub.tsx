import { Link } from '@/lib/router-compat';
import { ArrowRight } from 'lucide-react';
import { SILO_LIST } from '@/data/silos';

/**
 * Hub des 4 piliers, affiché sur la home. La home ne vise plus « crawlers »
 * elle-même : elle vise la marque et l'offre, et transmet l'autorité aux
 * piliers de chaque silo.
 */
export function SiloHub() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-3">
          Les quatre piliers de la plateforme
        </h2>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          Chaque pilier regroupe les pages de référence sur une intention de recherche
          précise, du crawl technique à la visibilité dans les moteurs IA.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {SILO_LIST.map((silo) => (
            <article key={silo.id} className="rounded-2xl border border-border bg-card/40 p-6">
              <Link
                to={silo.pillar.to}
                className="group flex items-start justify-between gap-4 no-underline"
              >
                <h3 className="text-lg font-semibold text-foreground group-hover:underline">
                  {silo.pillar.label}
                </h3>
                <ArrowRight className="h-4 w-4 mt-1 shrink-0 text-foreground/60" />
              </Link>
              <p className="text-xs text-muted-foreground mt-2 mb-4">{silo.intent}</p>
              <ul className="space-y-2 list-none p-0 m-0">
                {silo.satellites.map((s) => (
                  <li key={s.to}>
                    <Link
                      to={s.to}
                      className="text-sm text-foreground/75 hover:text-foreground no-underline"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
