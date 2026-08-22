import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeHtmlDeterministic } from '@/lib/security/sanitizeHtml';
import {
  getMarketplaceRevisions,
  proposeMarketplaceRevision,
  decideMarketplaceRevision,
  openMarketplaceDispute,
} from '@/lib/marketplace/marketplace.functions';

interface RevisionView {
  id: string;
  round_index: number;
  role: 'buyer' | 'seller';
  html_before: string;
  html_after: string;
  paragraph_excerpt: string | null;
  status: string;
  created_at: string;
  feedback: { author_role: string; verdict: string; comment: string | null; created_at: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposée',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

/**
 * Prévisualisation d'insertion (L3.10) : diff avant/après, paragraphe mis en
 * évidence, bascule mobile/bureau, panneau de feedback et historique des tours.
 */
export function LinkInsertionPreview({
  orderId,
  role,
}: {
  orderId: string;
  role: 'buyer' | 'seller';
}) {
  const fetchRevisions = useServerFn(getMarketplaceRevisions);
  const propose = useServerFn(proposeMarketplaceRevision);
  const decide = useServerFn(decideMarketplaceRevision);
  const dispute = useServerFn(openMarketplaceDispute);

  const [revisions, setRevisions] = useState<RevisionView[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [draftBefore, setDraftBefore] = useState('');
  const [draftAfter, setDraftAfter] = useState('');
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await fetchRevisions({ data: { orderId } })) as {
        revisions: RevisionView[];
        rounds_remaining: number;
      };
      setRevisions(res.revisions);
      setRemaining(res.rounds_remaining);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Historique indisponible');
    } finally {
      setLoading(false);
    }
  }, [fetchRevisions, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitProposal = async () => {
    setBusy(true);
    try {
      await propose({
        data: {
          orderId,
          htmlBefore: draftBefore,
          htmlAfter: draftAfter,
          paragraphExcerpt: draftAfter.replace(/<[^>]+>/g, '').slice(0, 300),
        },
      });
      toast.success('Proposition envoyée');
      setDraftAfter('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Proposition refusée');
    } finally {
      setBusy(false);
    }
  };

  const runVerdict = async (revisionId: string, verdict: 'accepted' | 'rejected') => {
    setBusy(true);
    try {
      await decide({ data: { revisionId, verdict, comment: comment || null } });
      toast.success(verdict === 'accepted' ? 'Insertion validée' : 'Insertion refusée');
      setComment('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verdict refusé');
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    setBusy(true);
    try {
      await dispute({ data: { orderId, reason: 'content_refused', detail: comment || undefined } });
      toast.success('Litige ouvert : arbitrage sous 5 jours ouvrés');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Litige refusé');
    } finally {
      setBusy(false);
    }
  };

  const latest = revisions[revisions.length - 1] ?? null;
  const frame = viewport === 'mobile' ? 'max-w-[380px]' : 'max-w-full';

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-medium">Prévisualisation de l'insertion</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{remaining} tour(s) de révision restant(s)</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewport(viewport === 'desktop' ? 'mobile' : 'desktop')}
            >
              {viewport === 'desktop' ? 'Vue mobile' : 'Vue bureau'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Chargement de l'historique…</p>
        ) : (
          <>
            {latest && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-muted-foreground">Avant</p>
                  <div
                    className={`prose prose-sm dark:prose-invert rounded-md border border-border p-3 ${frame}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlDeterministic(latest.html_before) }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">Après — paragraphe modifié en surbrillance</p>
                  <div
                    className={`prose prose-sm dark:prose-invert rounded-md border border-primary p-3 ring-1 ring-primary/40 ${frame}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlDeterministic(latest.html_after) }}
                  />
                </div>
              </div>
            )}

            {latest && latest.role !== role && latest.status === 'proposed' && (
              <div className="space-y-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Votre retour sur cette insertion (optionnel)"
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => runVerdict(latest.id, 'accepted')}>
                    Valider l'insertion
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => runVerdict(latest.id, 'rejected')}>
                    Demander une correction
                  </Button>
                </div>
              </div>
            )}

            {remaining > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-muted-foreground">
                  Proposer une insertion — le compteur de tours est partagé avec le Studio.
                </p>
                <Textarea
                  value={draftBefore}
                  onChange={(e) => setDraftBefore(e.target.value)}
                  placeholder="Paragraphe actuel de la page hôte (HTML)"
                  rows={3}
                />
                <Textarea
                  value={draftAfter}
                  onChange={(e) => setDraftAfter(e.target.value)}
                  placeholder="Paragraphe proposé, lien inclus (HTML)"
                  rows={4}
                />
                <Button variant="outline" size="sm" disabled={busy || draftAfter.length < 10} onClick={submitProposal}>
                  Envoyer la proposition
                </Button>
              </div>
            ) : (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-muted-foreground">
                  Plafond de révisions atteint : la seule issue est un arbitrage.
                </p>
                <Button variant="outline" size="sm" disabled={busy} onClick={escalate}>
                  Ouvrir un litige
                </Button>
              </div>
            )}

            {revisions.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-muted-foreground">Historique</p>
                <ul className="space-y-2">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Tour {r.round_index}</Badge>
                      <span>{r.role === 'buyer' ? 'Acheteur' : 'Vendeur'}</span>
                      <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      {r.feedback.map((f, i) => (
                        <span key={i} className="text-muted-foreground">
                          — {f.comment ?? f.verdict}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default LinkInsertionPreview;
