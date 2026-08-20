/**
 * ContentFreshnessQueue — File de travail éditoriale (fraîcheur du contenu)
 *
 * L'audit hebdomadaire ne modifie jamais un article : il alimente cette file.
 * L'admin arbitre : générer un brouillon IA, relire, puis valider.
 * C'est la validation — et elle seule — qui met à jour l'article, sa date de
 * modification, et déclenche IndexNow + Google Indexing (le flux RSS et le
 * sitemap étant dynamiques, ils reflètent la mise à jour aussitôt).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  RefreshCw, Sparkles, Check, X, ExternalLink, ChevronDown, ChevronUp,
  Clock, LinkIcon, TrendingDown, CalendarClock,
} from 'lucide-react';

type Status = 'pending' | 'draft_ready' | 'approved' | 'dismissed';

interface Reason { code: string; severity: 'critical' | 'warning' | 'info'; label: string; detail?: string }

interface QueueItem {
  id: string;
  slug: string;
  url: string;
  title: string;
  status: Status;
  priority_score: number;
  staleness_days: number | null;
  reasons: Reason[] | null;
  outdated_years: string[] | null;
  dead_links: { url: string; status: number | null }[] | null;
  gsc_signals: Record<string, number | string> | null;
  draft_content: string | null;
  draft_summary: { type: string; detail: string }[] | null;
  draft_model: string | null;
  draft_generated_at: string | null;
  detected_at: string;
  reviewed_at: string | null;
  published_at: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'À traiter',
  draft_ready: 'Brouillon prêt',
  approved: 'Publié',
  dismissed: 'Écarté',
};

const REASON_ICON: Record<string, typeof Clock> = {
  stale_6m: CalendarClock,
  stale_12m: CalendarClock,
  outdated_year: Clock,
  stale_figures: Clock,
  dead_links: LinkIcon,
  gsc_ctr_decline: TrendingDown,
  gsc_position_decline: TrendingDown,
};

export function ContentFreshnessQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Status | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('content_freshness_queue')
      .select('*')
      .order('priority_score', { ascending: false })
      .limit(200);
    if (error) toast.error(`Chargement impossible : ${error.message}`);
    setItems((data as unknown as QueueItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('content-freshness', { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    return data;
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await call({ action: 'scan' });
      toast.success(`Audit terminé : ${res.queued} article(s) à réviser sur ${res.articles_scanned} analysés`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const act = async (id: string, action: 'draft' | 'approve' | 'dismiss', content?: string) => {
    setBusyId(id);
    try {
      await call({ action, item_id: id, ...(content ? { content } : {}) });
      toast.success(
        action === 'draft' ? 'Brouillon généré — à relire avant validation'
          : action === 'approve' ? 'Article mis à jour et soumis à l\'indexation'
          : 'Élément écarté',
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Fraîcheur du contenu</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit hebdomadaire (lundi 07h00 UTC). Aucun article n'est modifié automatiquement :
              la validation humaine est ce qui déclenche la mise à jour, la date de modification,
              IndexNow et le flux RSS.
            </p>
          </div>
          <Button variant="outline" onClick={runScan} disabled={scanning} className="shrink-0">
            <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Audit en cours' : 'Lancer un audit'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(['pending', 'draft_ready', 'approved', 'dismissed', 'all'] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant="outline"
                onClick={() => setFilter(k)}
                className={filter === k ? 'border-primary text-primary' : ''}
              >
                {k === 'all' ? 'Tout' : STATUS_LABEL[k]}
                <span className="ml-2 opacity-60">{counts[k] ?? 0}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun article dans cette catégorie.
          </CardContent>
        </Card>
      )}

      {!loading && filtered.map((item) => {
        const isOpen = expanded === item.id;
        const reasons = item.reasons ?? [];
        return (
          <Card key={item.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
                    <Badge variant="outline">Priorité {item.priority_score}</Badge>
                    {item.staleness_days !== null && (
                      <Badge variant="outline">{Math.round(item.staleness_days / 30)} mois</Badge>
                    )}
                  </div>
                  <h3 className="mt-2 truncate font-medium">{item.title}</h3>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  >
                    {item.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.status !== 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => act(item.id, 'draft')}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {item.draft_content ? 'Régénérer' : 'Proposer un brouillon'}
                    </Button>
                  )}
                  {item.status === 'draft_ready' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => act(item.id, 'approve', editedDraft[item.id])}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Valider et publier
                    </Button>
                  )}
                  {item.status !== 'approved' && item.status !== 'dismissed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => act(item.id, 'dismiss')}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Écarter
                    </Button>
                  )}
                </div>
              </div>

              <ul className="space-y-1">
                {reasons.map((r, idx) => {
                  const Icon = REASON_ICON[r.code] ?? Clock;
                  return (
                    <li key={`${r.code}-${idx}`} className="flex items-start gap-2 text-sm">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${r.severity === 'critical' ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <span>
                        {r.label}
                        {r.detail && <span className="block text-xs text-muted-foreground">{r.detail}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {item.gsc_signals && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border p-3 text-xs text-muted-foreground">
                  <span>Clics 28 j : {String(item.gsc_signals.clicks_28d)}</span>
                  <span>Impressions : {String(item.gsc_signals.impressions_28d)}</span>
                  <span>CTR : {String(item.gsc_signals.ctr_28d)} %</span>
                  <span>Position : {String(item.gsc_signals.position_28d)}</span>
                  <span>Δ CTR : {String(item.gsc_signals.ctr_delta_points)} pt</span>
                  <span>Δ position : {String(item.gsc_signals.position_delta)}</span>
                  <span className="w-full">{String(item.gsc_signals.provenance)}</span>
                </div>
              )}

              {item.draft_content && (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExpanded(isOpen ? null : item.id);
                      if (!isOpen && editedDraft[item.id] === undefined) {
                        setEditedDraft((p) => ({ ...p, [item.id]: item.draft_content ?? '' }));
                      }
                    }}
                  >
                    {isOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                    Brouillon proposé{item.draft_model ? ` (${item.draft_model})` : ''}
                  </Button>

                  {isOpen && (
                    <div className="space-y-2">
                      {!!item.draft_summary?.length && (
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {item.draft_summary.map((c, i) => (
                            <li key={i}><span className="font-medium">{c.type}</span> — {c.detail}</li>
                          ))}
                        </ul>
                      )}
                      <Textarea
                        value={editedDraft[item.id] ?? item.draft_content ?? ''}
                        onChange={(e) => setEditedDraft((p) => ({ ...p, [item.id]: e.target.value }))}
                        rows={18}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Vous pouvez corriger le HTML avant validation : c'est ce contenu qui sera publié.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default ContentFreshnessQueue;
