import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ExpertAuditDashboard, ExpertAuditContent, ExpertAuditFAQ } from '@/components/ExpertAudit';

// Lazy load the NewsCarousel
const NewsCarousel = lazy(() => import('@/components/NewsCarousel').then(m => ({ default: m.NewsCarousel })));

const ExpertAudit = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1" role="main" aria-label="Audit Expert SEO & IA">
        <ExpertAuditDashboard />
        <ExpertAuditContent />
        <ExpertAuditFAQ />
        <Suspense fallback={<div className="h-96 animate-pulse bg-muted/30" />}>
          <NewsCarousel />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default ExpertAudit;
