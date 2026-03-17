import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, Globe, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InjectionError {
  id: string;
  rule_id: string;
  domain_id: string;
  user_id: string;
  error_type: string;
  error_details: any;
  domain: string;
  url_pattern: string;
  payload_type: string;
  resolved_at: string | null;
  created_at: string;
}

const ERROR_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  not_found: { label: 'Non trouvé', color: 'text-destructive' },
  fetch_failed: { label: 'Fetch échoué', color: 'text-amber-600 dark:text-amber-400' },
  deploy_fail: { label: 'Déploiement KO', color: 'text-destructive' },
  stale_ping: { label: 'Ping ancien', color: 'text-amber-600 dark:text-amber-400' },
};

export function InjectionErrorsRegistry() {
  const [errors, setErrors] = useState<InjectionError[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const fetchErrors = async () => {
    let query = supabase
      .from('injection_error_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter === 'open') {
      query = query.is('resolved_at', null);
    } else if (filter === 'resolved') {
      query = query.not('resolved_at', 'is', null);
    }

    const { data } = await query;
    setErrors((data || []) as InjectionError[]);
  };

  useEffect(() => {
    setLoading(true);
    fetchErrors().finally(() => setLoading(false));
  }, [filter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchErrors();
    setRefreshing(false);
  };

  const handleResolve = async (id: string) => {
    await supabase
      .from('injection_error_logs' as any)
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved_at: new Date().toISOString() } : e));
  };

  const openCount = errors.filter(e => !e.resolved_at).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Erreurs d'Injection
            </CardTitle>
            <CardDescription>Erreurs détectées lors des tests de vérification d'injection</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs">{openCount} ouvert{openCount > 1 ? 'es' : 'e'}</Badge>
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        <div className="flex gap-1 mt-2">
          {(['open', 'all', 'resolved'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2.5"
              onClick={() => setFilter(f)}
            >
              {f === 'open' ? 'Ouvertes' : f === 'resolved' ? 'Résolues' : 'Toutes'}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {errors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune erreur d'injection</p>
          </div>
        ) : (
          errors.map(err => {
            const typeInfo = ERROR_TYPE_LABELS[err.error_type] || { label: err.error_type, color: 'text-muted-foreground' };
            const details = err.error_details || {};

            return (
              <div
                key={err.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  err.resolved_at ? 'bg-muted/20 opacity-60' : 'bg-card hover:bg-accent/30'
                }`}
              >
                <div className="mt-0.5">
                  {err.resolved_at ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{err.domain}</span>
                    <Badge variant="outline" className="text-[9px]">{err.url_pattern}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{err.payload_type}</Badge>
                    <span className={`text-[10px] font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                  </div>

                  {details.url && (
                    <p className="text-[10px] text-muted-foreground truncate">{details.url}</p>
                  )}
                  {details.error && (
                    <p className="text-[10px] text-destructive/80">{details.error}</p>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(err.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                    {details.status > 0 && <span>HTTP {details.status}</span>}
                    {err.resolved_at && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Résolu le {format(new Date(err.resolved_at), 'dd MMM HH:mm', { locale: fr })}
                      </span>
                    )}
                  </div>
                </div>

                {!err.resolved_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] shrink-0"
                    onClick={() => handleResolve(err.id)}
                  >
                    Résoudre
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
