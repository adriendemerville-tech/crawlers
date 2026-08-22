import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertTriangle, Loader2, MapPin, Star, Link2, History } from 'lucide-react';
import { auditGmbFromUrl, listGmbUrlAudits, getGmbUrlAudit } from '@/lib/gmb/urlAudit.functions';
import type { GmbListingAudit } from '@/lib/gmb/listingAudit';

interface HistoryRow {
  id: string;
  source_url: string;
  place_name: string | null;
  place_address: string | null;
  score: number | null;
  grade: string | null;
  created_at: string;
}

const gradeTone = (percent: number) =>
  percent >= 75 ? 'text-primary' : percent >= 50 ? 'text-amber-500' : 'text-destructive';

export function GmbUrlAuditTab() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<GmbListingAudit | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const refreshHistory = () => {
    listGmbUrlAudits()
      .then((r) => setHistory((r.audits ?? []) as HistoryRow[]))
      .catch(() => setHistory([]));
  };

  useEffect(refreshHistory, []);

  const run = async () => {
    if (url.trim().length < 4) {
      toast.error("Collez un lien Google (share.google, Maps) ou saisissez « Nom Ville ».");
      return;
    }
    setLoading(true);
    setAudit(null);
    try {
      const res = await auditGmbFromUrl({ data: { url: url.trim() } });
      setAudit(res.audit as GmbListingAudit);
      refreshHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Audit impossible');
    } finally {
      setLoading(false);
    }
  };

  const reopen = async (id: string) => {
    try {
      const row = await getGmbUrlAudit({ data: { id } });
      setAudit((row as { result: GmbListingAudit }).result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Audit introuvable');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Auditer une fiche à partir de son URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
              placeholder="https://share.google/… ou https://www.google.com/maps/place/… ou « Nom Ville »"
              className="flex-1"
            />
            <Button variant="outline" onClick={() => void run()} disabled={loading} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Auditer'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aucune connexion à la fiche n'est nécessaire : l'audit s'appuie sur les données publiques Google
            et sur le site web déclaré. Les métriques non observables publiquement (impressions, clics,
            taux de réponse aux avis) sont écartées du score au lieu d'être estimées.
          </p>
        </CardContent>
      </Card>

      {audit && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-primary">
                  <span className={`text-2xl font-bold ${gradeTone(audit.percent)}`}>{audit.percent}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold">{audit.place.name ?? 'Fiche sans nom'}</h3>
                  <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {audit.place.formatted_address ?? 'adresse absente'}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      {audit.place.rating ? audit.place.rating.toFixed(1) : '—'} / 5
                    </span>
                    <span className="text-muted-foreground">{audit.place.reviews_count ?? 0} avis</span>
                    <Badge variant="outline" className="text-xs">Note {audit.grade}</Badge>
                    <span className="text-muted-foreground">{audit.total}/{audit.max} points mesurés</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {audit.gates.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Pourquoi c'est prioritaire
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...audit.gates].sort((a, b) => a.rank - b.rank).map((g, i) => (
                  <div key={`${g.axis}-${i}`} className="text-xs">
                    <p className="font-medium">{g.reason}</p>
                    <p className="text-muted-foreground">{g.evidence}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {audit.blocks.map((b) => (
              <Card key={b.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{b.label}</h4>
                    <Badge variant="outline" className="text-xs">
                      {b.unmeasurable ? 'non mesurable' : `${b.score}/${b.max}`}
                    </Badge>
                  </div>
                  {b.unmeasurable ? (
                    <p className="text-xs text-muted-foreground">
                      Bloc exclu du score : la fiche ne déclare aucun site web à comparer.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {b.items.map((item) => (
                        <div key={item.field} className="flex items-start gap-2 text-xs">
                          <CheckCircle2
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              item.points >= item.max ? 'text-primary' : 'text-muted-foreground/30'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <span className={item.points >= item.max ? '' : 'text-muted-foreground'}>
                              {item.label}
                            </span>
                            <p className="text-[11px] text-muted-foreground">Mesuré : {item.measured}</p>
                            {item.fix && (
                              <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">{item.fix}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-muted-foreground">{item.points}/{item.max}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {audit.priorities.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Plan d'action, par ordre d'entrée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {audit.priorities.map((p) => (
                  <div key={p.rank} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-mono text-muted-foreground">{p.rank}.</span>
                    <div className="min-w-0">
                      <p>{p.label}</p>
                      <p className="text-muted-foreground">{p.why}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4" />
              Audits précédents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => void reopen(h.id)}
                className="flex w-full items-center justify-between gap-3 rounded border border-border px-2 py-1.5 text-left text-xs hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate">
                  {h.place_name ?? h.source_url}
                  {h.place_address ? <span className="text-muted-foreground"> — {h.place_address}</span> : null}
                </span>
                <span className={`shrink-0 font-semibold ${gradeTone(h.score ?? 0)}`}>{h.score ?? '—'}/100</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
