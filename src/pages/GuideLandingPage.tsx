import { memo, lazy, Suspense } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Link, Navigate } from '@/lib/router-compat';
import { GuideTemplate } from '@/components/Guide/GuideTemplate';
import { Header } from '@/components/Header';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const routeApi = getRouteApi('/guide/$slug');

function GuideLandingPageComponent(): React.ReactElement {
  const data = routeApi.useLoaderData() as {
    guide: GuideData | null;
    siblings: { slug: string; title: string }[];
  };
  const { guide, siblings } = data;

  if (!guide) {
    return <Navigate to="/404" replace />;
  }

  return (
    <>
      <Header />
      <GuideTemplate guide={guide} />

      {/* Maillage croisé entre guides métiers (rendu côté serveur) */}
      {siblings && siblings.length > 0 && (
        <nav
          aria-label="Autres guides métiers"
          className="mx-auto max-w-4xl px-4 pb-16"
        >
          <h2 className="mb-4 text-xl font-bold text-foreground">
            Autres guides SEO &amp; GEO par métier
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link
                  to={`/guide/${s.slug}`}
                  className="block rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link to="/guides" className="text-primary hover:underline">
              Voir tous les guides SEO &amp; GEO par métier
            </Link>
          </p>
        </nav>
      )}

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}

export default memo(GuideLandingPageComponent);
