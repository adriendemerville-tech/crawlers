import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, RefreshCw, Terminal, Layers, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { listMyMarinaAudits, getMyMarinaReportUrl } from '@/lib/marina/myAudits.functions';
import { normalizeScanMode } from '@/lib/marina/scanMode';

type Audit = Awaited<ReturnType<typeof listMyMarinaAudits>>[number];

const STATUS_LABEL: Record<string, string> = {
  completed: 'Terminé',
  partial: 'Partiel',
  processing: 'En cours',
  pending: 'En attente',
  failed: 'Échec',
};

interface AuditGroup {
  key: string;
  main: Audit;
  items: Audit[];
}

/**
 * Regroupe les jobs d'un même audit multipages en une seule entrée.
 * - Priorité au marqueur `batchId` posé au lancement.
 * - Repli pour les lots antérieurs : jobs consécutifs du même domaine, lancés
 *   à moins de 5 minutes d'intervalle et portant des URLs distinctes.
 */
function groupAudits(audits: Audit[]): AuditGroup[] {
  const groups: AuditGroup[] = [];
  const byBatch = new Map<string, AuditGroup>();

  for (const a of audits) {
    if (a.batchId) {
      const existing = byBatch.get(a.batchId);
      if (existing) { existing.items.push(a); continue; }
      const g: AuditGroup = { key: a.batchId, main: a, items: [a] };
      byBatch.set(a.batchId, g);
      groups.push(g);
      continue;
    }

    const last = groups[groups.length - 1];
    const lastItem = last?.items[last.items.length - 1];
    const sameDomain = lastItem && !lastItem.batchId && lastItem.domain === a.domain;
    const closeInTime =
      lastItem && Math.abs(new Date(lastItem.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
    const distinctUrl = lastItem && last.items.every(i => (i.url || '') !== (a.url || ''));

    if (sameDomain && closeInTime && distinctUrl) last.items.push(a);
    else groups.push({ key: a.id, main: a, items: [a] });
  }

  return groups;
}


  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAudits(await listMyMarinaAudits());
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de charger vos audits');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReport = async (jobId: string) => {
    setOpeningId(jobId);
    try {
      const { url } = await getMyMarinaReportUrl({ data: { jobId } });
      if (url) window.open(url, '_blank', 'noopener');
      else toast.error('Rapport indisponible pour cet audit');
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de l\'ouverture du rapport');
    }
    setOpeningId(null);
  };

  return (
    <section className="py-16 border-b border-border">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Mes audits Marina</h2>
            <p className="text-sm text-muted-foreground">
              Tous vos rapports, lancés depuis cette page ou via l'API Marina.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement de vos audits…
          </div>
        ) : audits.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <FileText className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aucun audit pour l'instant. Lancez votre premier rapport depuis le champ URL en haut de page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {audits.map(a => {
              const scanMode = normalizeScanMode(a.scanMode);
              return (
              <Card key={a.id}>
                <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{a.domain || a.url || '—'}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABEL[a.status] || a.status}
                        {a.status === 'processing' ? ` · ${a.progress}%` : ''}
                      </Badge>
                      {a.viaApi && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Terminal className="w-3 h-3" /> API
                        </Badge>
                      )}
                      {a.multipage && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Layers className="w-3 h-3" /> Multipages
                        </Badge>
                      )}
                      {scanMode && (
                        <Badge variant="outline" className="text-[10px] capitalize">{scanMode}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.createdAt).toLocaleString('fr-FR')}
                      {a.globalScore !== null ? ` · score ${a.globalScore}/100` : ''}
                      {a.error ? ` · ${a.error}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!a.hasReport || openingId === a.id}
                    onClick={() => openReport(a.id)}
                  >
                    {openingId === a.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <ExternalLink className="w-3.5 h-3.5" />}
                    Voir le rapport
                  </Button>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
