// Module « Concurrence » de la console : suivi de plusieurs URL du domaine
// sélectionné, analysées avec les outils de la matrice de concurrence.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RefreshCw, Trash2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { MatrixReportView } from '@/components/CompetitorMatrix/MatrixReportView';
import { STEP_LABEL, type MatrixJobState } from '@/lib/competitorMatrix/types';
import { advanceCompetitorMatrix } from '@/lib/competitorMatrix/matrix.functions';
import {
  deleteConsoleMatrix, getConsoleMatrix, listConsoleMatrices, startConsoleMatrix,
} from '@/lib/competitorMatrix/console.functions';

interface Row {
  id: string;
  targetUrl: string;
  domain: string;
  status: string;
  step: string;
  progress: number;
  createdAt: string;
  hasMatrix: boolean;
  competitorCount: number;
  error: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  running: 'En cours',
  done: 'Terminée',
  error: 'Échec',
  pending: 'En attente',
};

export function CompetitionTab({ externalDomain }: { externalDomain: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [rivals, setRivals] = useState('');
  const [job, setJob] = useState<MatrixJobState | null>(null);
  const [openJob, setOpenJob] = useState<MatrixJobState | null>(null);
  const failures = useRef(0);

  const refresh = useCallback(async () => {
    if (!externalDomain) { setRows([]); return; }
    setLoading(true);
    try {
      const res = await listConsoleMatrices({ data: { domain: externalDomain } });
      setRows(res.rows as Row[]);
    } catch {
      toast.error('Chargement des analyses impossible');
    } finally {
      setLoading(false);
    }
  }, [externalDomain]);

  useEffect(() => { void refresh(); setJob(null); setOpenJob(null); setUrl(''); }, [refresh]);

  // Une étape par appel : on relance tant que l'analyse tourne.
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    let cancelled = false;
    const delay = failures.current > 0 ? Math.min(8000, 1500 * failures.current) : 800;
    const timer = setTimeout(async () => {
      try {
        const res = await advanceCompetitorMatrix({ data: { jobId: job.id } });
        if (cancelled) return;
        failures.current = 0;
        if ('error' in res) { toast.error(res.message ?? 'Erreur inattendue'); setJob(null); void refresh(); }
        else {
          setJob(res.job);
          if (res.job.status !== 'running') void refresh();
        }
      } catch {
        if (cancelled) return;
        failures.current += 1;
        if (failures.current >= 5) {
          toast.error('Analyse interrompue. Réessayez dans quelques minutes.');
          setJob(null);
          return;
        }
        setJob({ ...job });
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [job, refresh]);

  const launch = useCallback(async (targetUrl: string) => {
    if (!externalDomain) return;
    const competitors = rivals.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);
    try {
      const res = await startConsoleMatrix({ data: { url: targetUrl, domain: externalDomain, competitors } });
      if ('error' in res) { toast.error(res.message ?? 'Erreur inattendue'); return; }
      setOpenJob(null);
      setJob(res.job);
      void refresh();
    } catch {
      toast.error('Impossible de démarrer l’analyse');
    }
  }, [externalDomain, rivals, refresh]);

  const open = useCallback(async (id: string) => {
    const res = await getConsoleMatrix({ data: { jobId: id } });
    if ('error' in res) { toast.error(res.message); return; }
    setOpenJob(res.job);
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await deleteConsoleMatrix({ data: { jobId: id } });
    if ('error' in res) { toast.error(res.message); return; }
    void refresh();
  }, [refresh]);

  if (!externalDomain) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Sélectionnez un domaine dans le sélecteur en haut pour suivre sa concurrence.
        </CardContent>
      </Card>
    );
  }

  if (openJob) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setOpenJob(null)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Retour
          </Button>
          <span className="truncate text-sm text-muted-foreground">{openJob.targetUrl}</span>
        </div>
        <MatrixReportView job={openJob} />
      </div>
    );
  }

  const running = job?.status === 'running';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Concurrence</h2>
        <p className="text-sm text-muted-foreground">
          Suivez plusieurs URL de <strong>{externalDomain}</strong> avec les outils de la matrice de concurrence :
          concurrents détectés, 20 requêtes de marché, positions Google, AI Overviews et citations LLM.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">URL à suivre</span>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`${externalDomain}/page`}
                inputMode="url"
                disabled={running}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Concurrents connus (optionnel, 3 max)</span>
              <Input
                value={rivals}
                onChange={(e) => setRivals(e.target.value)}
                placeholder="concurrent1.fr, concurrent2.fr"
                disabled={running}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => launch(url)} disabled={running || !url.trim()}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {running ? 'Analyse en cours…' : 'Lancer la matrice'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </Button>
          </div>

          {running && job && (
            <div className="space-y-2" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {STEP_LABEL[job.step]} — {job.progress} %
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {job?.status === 'done' && job.matrix && (
        <MatrixReportView job={job} />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="text-sm font-semibold">Analyses passées</h3>
            <p className="text-xs text-muted-foreground">
              Toutes les matrices générées pour ce domaine, y compris depuis l’outil public.
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              Aucune URL suivie pour ce domaine. Lancez une première matrice ci-dessus.
            </p>
          ) : (

            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.targetUrl}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString('fr-FR')} · {r.competitorCount} concurrents
                      {r.error ? ` · ${r.error}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {STATUS_LABEL[r.status] ?? r.status}
                    {r.status === 'running' ? ` ${r.progress} %` : ''}
                  </Badge>
                  {r.hasMatrix && (
                    <Button variant="outline" size="sm" onClick={() => void open(r.id)}>Voir le rapport</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void launch(r.targetUrl)} disabled={running}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Relancer
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void remove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
