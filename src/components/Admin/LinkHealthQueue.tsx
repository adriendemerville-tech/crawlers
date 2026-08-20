/**
 * LinkHealthQueue — File de travail « Santé des liens »
 *
 * Le contrôle automatique (quotidien) ne modifie jamais une page : il liste
 * ici les pages dont un lien interne ou sortant est cassé, triées par
 * priorité (lien interne cassé > lien sortant cassé). L'admin corrige puis
 * revérifie, ou écarte le constat.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  scanLinkHealth,
  recheckLinkHealthItem,
  dismissLinkHealthItem,
} from '@/lib/linkHealth/linkHealth.functions';
import {
  RefreshCw, Radar, X, ExternalLink, ChevronDown, ChevronUp, Link2Off, ServerCrash,
} from 'lucide-react';

type Status = 'pending' | 'resolved' | 'dismissed';

interface BrokenLink {
  url: string;
  status: number | null;
  anchor?: string;
  reason?: string;
  /** Verdict du juge unique partagé : même mot pour la même valeur, partout. */
  verdict?: 'hard_broken' | 'soft_broken' | 'blocked' | 'ok';
  label?: string;
  explanation?: string;
}

interface QueueItem {
  id: string;
  url: string;
  domain: string | null;
  title: string | null;
  status: Status;
  severity: 'critical' | 'warning' | 'info';
  priority_score: number;
  links_checked: number;
  broken_count: number;
  internal_broken: BrokenLink[] | null;
  external_broken: BrokenLink[] | null;
  soft_broken: BrokenLink[] | null;
  blocked_links: BrokenLink[] | null;
  soft_broken_count: number | null;
  blocked_count: number | null;
  consecutive_failures: number | null;
  fetch_error: string | null;
  first_detected_at: string | null;
  last_checked_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'À traiter',
  resolved: 'Sain',
  dismissed: 'Écarté',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusCode(link: BrokenLink) {
  return link.status === null ? 'injoignable' : String(link.status);
}

export function LinkHealthQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('link_health_queue')
      .select('*')
      .order('priority_score', { ascending: false })
      .order('last_checked_at', { ascending: false })
      .limit(300);
    if (error) toast.error(`Chargement impossible : ${error.message}`);
    setItems((data as unknown as QueueItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await scanLinkHealth({ data: { limit: 12 } });
      toast.success(
        `${res.pages_scanned} page(s) vérifiées · ${res.pages_with_issues} avec liens cassés · ${res.broken_links} lien(s) en défaut`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scan impossible');
    } finally {
      setScanning(false);
    }
  };

  const recheck = async (id: string) => {
    setBusyId(id);
    try {
      const res = await recheckLinkHealthItem({ data: { itemId: id } });
      toast[res.resolved ? 'success' : 'info'](
        res.resolved ? 'Page saine, constat clos' : `${res.broken_count} lien(s) toujours cassé(s)`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Vérification impossible');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      await dismissLinkHealthItem({ data: { itemId: id } });
      toast.success('Constat écarté');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === 'pending');
    return {
      pending: pending.length,
      brokenLinks: pending.reduce((s, i) => s + i.broken_count, 0),
      internal: pending.reduce((s, i) => s + (i.internal_broken?.length ?? 0), 0),
      checked: items.length,
    };
  }, [items]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2Off className="h-4 w-4" />
              Santé des liens
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrôle automatique quotidien des liens internes et sortants. Aucune page n'est
              modifiée : les pages en défaut arrivent ici pour arbitrage.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2">Recharger</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void runScan()} disabled={scanning}>
              <Radar className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
              <span className="ml-2">{scanning ? 'Vérification…' : 'Vérifier un lot'}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Pages à traiter', value: counts.pending },
              { label: 'Liens cassés', value: counts.brokenLinks },
              { label: 'dont internes', value: counts.internal },
              { label: 'Pages suivies', value: counts.checked },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border p-3">
                <div className="text-xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['pending', 'resolved', 'dismissed', 'all'] as const).map((f) => (
              <Button
                key={f}
                variant="outline"
                size="sm"
                onClick={() => setFilter(f)}
                className={filter === f ? 'border-primary' : ''}
              >
                {f === 'all' ? 'Tout' : STATUS_LABEL[f]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune page dans cette vue.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const open = expanded === item.id;
            const internal = item.internal_broken ?? [];
            const external = item.external_broken ?? [];
            const soft = item.soft_broken ?? [];
            const blocked = item.blocked_links ?? [];
            return (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
                        {item.fetch_error ? (
                          <Badge variant="outline" className="gap-1">
                            <ServerCrash className="h-3 w-3" />
                            Page injoignable
                          </Badge>
                        ) : null}
                        {internal.length > 0 ? (
                          <Badge variant="outline">{internal.length} cassé(s) interne(s)</Badge>
                        ) : null}
                        {external.length > 0 ? (
                          <Badge variant="outline">{external.length} cassé(s) sortant(s)</Badge>
                        ) : null}
                        {soft.length > 0 ? (
                          <Badge variant="outline" title="5xx / 429 / délai dépassé : confirmé au 2e constat consécutif">
                            {soft.length} instable(s)
                          </Badge>
                        ) : null}
                        {blocked.length > 0 ? (
                          <Badge variant="outline" title="401/403/405/999 : la cible refuse les robots, ce n'est pas un défaut du site">
                            {blocked.length} non vérifiable(s)
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          priorité {item.priority_score} · {item.links_checked} lien(s) vérifiés ·
                          vu le {formatDate(item.last_checked_at)}
                          {item.consecutive_failures && item.consecutive_failures > 1
                            ? ` · ${item.consecutive_failures} constats consécutifs`
                            : ''}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">
                        {item.title || item.url}
                      </p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {item.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(internal.length > 0 ||
                        external.length > 0 ||
                        soft.length > 0 ||
                        blocked.length > 0 ||
                        item.fetch_error) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpanded(open ? null : item.id)}
                        >
                          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <span className="ml-2">Détail</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void recheck(item.id)}
                        disabled={busyId === item.id}
                      >
                        <RefreshCw className={`h-4 w-4 ${busyId === item.id ? 'animate-spin' : ''}`} />
                        <span className="ml-2">Revérifier</span>
                      </Button>
                      {item.status === 'pending' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void dismiss(item.id)}
                          disabled={busyId === item.id}
                        >
                          <X className="h-4 w-4" />
                          <span className="ml-2">Écarter</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {open ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-3 text-sm">
                      {item.fetch_error ? (
                        <p className="text-muted-foreground">
                          Chargement de la page en échec : <span className="font-mono text-xs">{item.fetch_error}</span>
                        </p>
                      ) : null}
                      {[
                        { label: 'Liens cassés — internes', links: internal },
                        { label: 'Liens cassés — sortants', links: external },
                        { label: 'Liens instables (à confirmer)', links: soft },
                        { label: 'Non vérifiables (protection serveur)', links: blocked },
                      ]
                        .filter((g) => g.links.length > 0)
                        .map((g) => (
                          <div key={g.label}>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {g.label}
                            </p>
                            <ul className="space-y-1">
                              {g.links.map((l) => (
                                <li key={l.url} className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[11px]"
                                    title={l.explanation || undefined}
                                  >
                                    {statusCode(l)}
                                  </Badge>
                                  <a
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all text-xs underline-offset-2 hover:underline"
                                  >
                                    {l.url}
                                  </a>
                                  {l.anchor ? (
                                    <span className="text-xs text-muted-foreground">
                                      ancre « {l.anchor} »
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      {item.first_detected_at ? (
                        <p className="text-xs text-muted-foreground">
                          Première détection le {formatDate(item.first_detected_at)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
