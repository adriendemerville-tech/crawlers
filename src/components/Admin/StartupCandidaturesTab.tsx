import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { decideStartupCandidature, listStartupCandidatures } from '@/lib/startupTrial.functions';

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-amber-500' },
  approved: { label: 'Validée', color: 'text-emerald-500' },
  rejected: { label: 'Refusée', color: 'text-red-500' },
};

const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—');

export function StartupCandidaturesTab() {
  const list = useServerFn(listStartupCandidatures);
  const decide = useServerFn(decideStartupCandidature);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery({ queryKey: ['admin', 'startup-candidatures'], queryFn: () => list() });
  const rows = query.data ?? [];

  const mutation = useMutation({
    mutationFn: (input: { id: string; decision: 'approve' | 'reject'; reason?: string }) => decide({ data: input }),
    onSuccess: (result, input) => {
      const msg = input.decision === 'reject'
        ? 'Candidature refusée.'
        : result.mode === 'activated' ? 'Validée : Pro Agency activé 12 mois.' : 'Validée : lien d’inscription envoyé.';
      toast.success(result.emailQueued ? `${msg} Email envoyé.` : `${msg} Email non envoyé.`);
      setRejecting(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'startup-candidatures'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const counts = rows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {[null, 'pending', 'approved', 'rejected'].map((s) => (
            <Button key={s ?? 'all'} size="sm" variant="outline" className={`h-7 text-xs ${statusFilter === s ? 'border-foreground' : ''}`} onClick={() => setStatusFilter(s)}>
              {s ? STATUS_META[s].label : 'Toutes'} ({s ? counts[s] ?? 0 : rows.length})
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Rafraîchir">
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : query.error ? (
        <p className="text-sm text-destructive">{(query.error as Error).message}</p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucune candidature.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>SIRET</TableHead>
                <TableHead>Kbis</TableHead>
                <TableHead>Activité</TableHead>
                <TableHead>Création</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Soumise</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const meta = STATUS_META[r.status] ?? { label: r.status, color: 'text-muted-foreground' };
                const busy = mutation.isPending && mutation.variables?.id === r.id;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">{r.company_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.siret}</TableCell>
                    <TableCell>
                      {r.kbis_url ? (
                        <a href={r.kbis_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                          <FileText className="h-3.5 w-3.5" />PDF
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="max-w-[200px] text-xs">{r.activity}</TableCell>
                    <TableCell className="text-xs">{fmt(r.creation_date)}</TableCell>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell className="text-xs">{fmt(r.submitted_at)}</TableCell>
                    <TableCell className={`text-xs font-medium ${meta.color}`}>
                      {meta.label}
                      {r.decided_at && <span className="block font-normal text-muted-foreground">{fmt(r.decided_at)}</span>}
                      {r.rejection_reason && <span className="block font-normal text-muted-foreground">{r.rejection_reason}</span>}
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      {r.status === 'pending' && (
                        rejecting === r.id ? (
                          <div className="space-y-2">
                            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Motif (optionnel)" className="min-h-[60px] text-xs" />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => mutation.mutate({ id: r.id, decision: 'reject', reason: reason.trim() || undefined })}>
                                {busy && <Loader2 className="h-3 w-3 animate-spin" />}Confirmer
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setRejecting(null); setReason(''); }}>Annuler</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => mutation.mutate({ id: r.id, decision: 'approve' })}>
                              {busy && <Loader2 className="h-3 w-3 animate-spin" />}Valider
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => { setRejecting(r.id); setReason(''); }}>Refuser</Button>
                          </div>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
