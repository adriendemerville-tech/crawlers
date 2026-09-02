import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Rocket } from 'lucide-react';

interface TrialApplication {
  id: string;
  user_id: string | null;
  siret: string;
  legal_name: string | null;
  creation_date: string | null;
  status: string;
  verification_details: unknown;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Attente', color: 'text-amber-500' },
  review: { label: 'Revue manuelle', color: 'text-violet-500' },
  approved: { label: 'Activé', color: 'text-emerald-500' },
  rejected: { label: 'Refusé', color: 'text-red-500' },
};

/** Extract the last human-readable message from verification_details JSON. */
function lastMessage(details: unknown): string {
  if (!details || typeof details !== 'object') return '—';
  const d = details as Record<string, unknown>;
  const kbis = (d['kbis'] ?? {}) as Record<string, unknown>;
  const reason = (kbis['reason'] ?? d['reason']) as string | null | undefined;
  if (reason) return reason;
  if (kbis['ok'] === true) return 'Kbis conforme (SIRET et raison sociale vérifiés).';
  const source = d['source'];
  return typeof source === 'string' ? `Vérifié via ${source}` : '—';
}

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export function StartupTrialsTab() {
  const [rows, setRows] = useState<TrialApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('startup_trial_applications')
      .select('id, user_id, siret, legal_name, creation_date, status, verification_details, trial_started_at, trial_expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) console.error('startup trials fetch failed', error.message);
    setRows((data as TrialApplication[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const visible = statusFilter ? rows.filter(r => r.status === statusFilter) : rows;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'review', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`rounded-lg border p-3 text-center transition-colors ${statusFilter === s ? 'border-foreground' : 'border-border'} bg-muted/30`}
          >
            <div className={`text-2xl font-bold ${STATUS_META[s].color}`}>{counts[s] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{STATUS_META[s].label}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Rocket className="h-4 w-4 text-violet-500" />
          Demandes offre jeune entreprise
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchRows} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Aucune demande</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs py-1.5">Statut</TableHead>
                <TableHead className="text-xs py-1.5">SIRET</TableHead>
                <TableHead className="text-xs py-1.5">Entreprise</TableHead>
                <TableHead className="text-xs py-1.5">Demande</TableHead>
                <TableHead className="text-xs py-1.5">Fin d’essai</TableHead>
                <TableHead className="text-xs py-1.5">Dernier message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(r => {
                const meta = STATUS_META[r.status] ?? { label: r.status, color: 'text-muted-foreground' };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="py-2">
                      <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                    </TableCell>
                    <TableCell className="py-2 text-xs font-mono">{r.siret}</TableCell>
                    <TableCell className="py-2 text-xs">
                      <div>{r.legal_name ?? '—'}</div>
                      <div className="text-[10px] text-muted-foreground">Créée le {fmt(r.creation_date)}</div>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{fmt(r.created_at)}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{fmt(r.trial_expires_at)}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground max-w-[280px]">
                      {lastMessage(r.verification_details)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-right">
        200 dernières demandes • Source : annuaire officiel des entreprises + contrôle Kbis automatique
      </div>
    </div>
  );
}
