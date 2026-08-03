import { memo, lazy, Suspense } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Navigate } from '@/lib/router-compat';
import { GuideTemplate } from '@/components/Guide/GuideTemplate';
import { Header } from '@/components/Header';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const routeApi = getRouteApi('/guide/$slug');

function GuideLandingPageComponent() {
  const { guide } = routeApi.useLoaderData();

  if (!guide) {
    return <Navigate to="/404" replace />;
  }

  return (
    <>
      <Header />
      <GuideTemplate guide={guide} />
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}

export default memo(GuideLandingPageComponent);
