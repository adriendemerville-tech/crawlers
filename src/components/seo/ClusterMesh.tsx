import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface ClusterLink {
  href: string;
  label: string;
  description?: string;
}

interface ClusterMeshProps {
  /** Current page URL path, e.g. "/audit-semantique" */
  currentPath: string;
  /** Current page H1 / breadcrumb leaf label */
  currentLabel: string;
  /** Pillar page of the cluster */
  pillar: ClusterLink;
  /** Sister pages of the same cluster (exclude current) */
  sisters: ClusterLink[];
}

const BASE = 'https://crawlers.fr';

/**
 * Renders BreadcrumbList JSON-LD + a visible "Cluster" footer linking
 * to the pilier page and 2-3 sister pages. Drop into any cluster page.
 */
export function ClusterMesh({ currentPath, currentLabel, pillar, sisters }: ClusterMeshProps) {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: pillar.label, item: `${BASE}${pillar.href}` },
      { '@type': 'ListItem', position: 3, name: currentLabel, item: `${BASE}${currentPath}` },
    ],
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      {/* Visible breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="container mx-auto px-4 pt-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link to="/" className="hover:text-foreground">Accueil</Link></li>
          <li><ChevronRight className="h-3 w-3 inline" /></li>
          <li><Link to={pillar.href} className="hover:text-foreground">{pillar.label}</Link></li>
          <li><ChevronRight className="h-3 w-3 inline" /></li>
          <li className="text-foreground" aria-current="page">{currentLabel}</li>
        </ol>
      </nav>

      {/* Cluster mesh footer */}
      <section aria-labelledby="cluster-mesh-heading" className="container mx-auto px-4 py-12 mt-12 border-t border-border">
        <h2 id="cluster-mesh-heading" className="text-2xl font-semibold mb-6">
          Continuer dans ce cluster
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to={pillar.href}
            className="group rounded-lg border border-primary/40 p-5 hover:border-primary transition-colors"
          >
            <div className="text-xs uppercase tracking-wide text-primary mb-2">Page pilier</div>
            <div className="font-semibold mb-1 group-hover:text-primary">{pillar.label}</div>
            {pillar.description && (
              <div className="text-sm text-muted-foreground">{pillar.description}</div>
            )}
          </Link>
          {sisters.slice(0, 2).map((s) => (
            <Link
              key={s.href}
              to={s.href}
              className="group rounded-lg border border-border p-5 hover:border-foreground transition-colors"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Cluster</div>
              <div className="font-semibold mb-1 group-hover:text-foreground">{s.label}</div>
              {s.description && (
                <div className="text-sm text-muted-foreground">{s.description}</div>
              )}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
