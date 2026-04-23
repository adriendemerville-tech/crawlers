/**
 * MatriceCompare — Sprint 7
 * Compare deux audits matriciels (delta de scores).
 * Routes: /matrice/compare?a=<auditIdA>&b=<auditIdB>
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useMatriceAudits, type MatrixAuditFull } from '@/hooks/useMatriceAudits';
import { MatriceDeltaView } from '@/components/Matrice/MatriceDeltaView';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function MatriceCompare() {
  const [searchParams] = useSearchParams();
  const aId = searchParams.get('a');
  const bId = searchParams.get('b');
  const { user, loading: authLoading } = useAuth();
  const { getAudit } = useMatriceAudits();

  const [auditA, setAuditA] = useState<MatrixAuditFull | null>(null);
  const [auditB, setAuditB] = useState<MatrixAuditFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    if (!aId || !bId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [a, b] = await Promise.all([getAudit(aId), getAudit(bId)]);
      if (!a || !b) toast.error('Un des audits est introuvable');
      // Sort chronologically (older = A)
      if (a && b && new Date(a.created_at) > new Date(b.created_at)) {
        setAuditA(b);
        setAuditB(a);
      } else {
        setAuditA(a);
        setAuditB(b);
      }
      setLoading(false);
    })();
  }, [aId, bId, user, authLoading, getAudit]);

  return (
    <>
      <Helmet>
        <title>Comparaison d'audits matriciels — Crawlers.fr</title>
        <meta name="description" content="Comparez deux audits matriciels et visualisez les progressions et régressions par famille de critères." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm">
              <Link to="/matrice/historique" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Retour à l'historique
              </Link>
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-violet" />
            </div>
          )}

          {!loading && (!auditA || !auditB) && (
            <div className="border-2 border-dashed border-brand-violet rounded-md p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Impossible de charger les audits demandés.
              </p>
            </div>
          )}

          {!loading && auditA && auditB && (
            <>
              <header className="mb-6">
                <h1 className="text-2xl font-bold text-foreground mb-2">Comparaison d'audits</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">A : </span>
                    {auditA.label} <span className="font-mono text-xs">({new Date(auditA.created_at).toLocaleDateString('fr-FR')})</span>
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">B : </span>
                    {auditB.label} <span className="font-mono text-xs">({new Date(auditB.created_at).toLocaleDateString('fr-FR')})</span>
                  </span>
                </div>
              </header>

              <section className="border-2 border-brand-violet rounded-md p-4 bg-transparent">
                <MatriceDeltaView
                  resultsA={auditA.results}
                  resultsB={auditB.results}
                  labelA={auditA.label}
                  labelB={auditB.label}
                />
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
