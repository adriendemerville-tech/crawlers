import { useState, useEffect, useCallback } from 'react';
import { CocoonErrorsRegistry } from './CocoonErrorsRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, Info, Flame, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SilentError {
  id: string;
  created_at: string;
  function_name: string;
  operation: string;
  error_message: string;
  severity: string;
  impact: string;
  context: Record<string, unknown>;
}

const severityConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Critique', color: 'bg-destructive text-destructive-foreground', icon: Flame },
  high: { label: 'Élevé', color: 'bg-destructive/80 text-destructive-foreground', icon: AlertTriangle },
  medium: { label: 'Moyen', color: 'bg-warning text-warning-foreground', icon: AlertTriangle },
  low: { label: 'Faible', color: 'bg-muted text-muted-foreground', icon: Info },
};

const impactLabels: Record<string, string> = {
  'crawl_stuck': 'Crawl bloqué',
  'quota_bypass': 'Quota non comptabilisé',
  'data_loss': 'Perte de données',
  'tracking_miss': 'Tracking manqué',
  'none': 'Aucun impact',
};

export function SilentErrorsRegistry() {
  const [errors, setErrors] = useState<SilentError[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterFunction, setFilterFunction] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('analytics_events')
        .select('*')
        .eq('event_type', 'silent_error')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data } = await query;

      if (data) {
        const parsed: SilentError[] = data.map((e: any) => {
          const d = e.event_data as Record<string, unknown>;
          return {
            id: e.id,
            created_at: e.created_at,
            function_name: (d?.function_name as string) || 'unknown',
            operation: (d?.operation as string) || 'unknown',
            error_message: (d?.error_message as string) || '',
            severity: (d?.severity as string) || 'low',
            impact: (d?.impact as string) || 'none',
            context: d || {},
          };
        });

        setErrors(parsed);
        setStats({
          total: parsed.length,
          critical: parsed.filter(e => e.severity === 'critical').length,
          high: parsed.filter(e => e.severity === 'high').length,
          medium: parsed.filter(e => e.severity === 'medium').length,
          low: parsed.filter(e => e.severity === 'low').length,
        });
      }
    } catch (err) {
      console.error('Failed to fetch silent errors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const uniqueFunctions = [...new Set(errors.map(e => e.function_name))].sort();

  const filteredErrors = errors.filter(e => {
    if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
    if (filterFunction !== 'all' && e.function_name !== filterFunction) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </Card>
        <Card className="p-3 text-center border-destructive/30">
          <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
          <div className="text-xs text-destructive/70">Critiques</div>
        </Card>
        <Card className="p-3 text-center border-destructive/20">
          <div className="text-2xl font-bold text-destructive/80">{stats.high}</div>
          <div className="text-xs text-muted-foreground">Élevés</div>
        </Card>
        <Card className="p-3 text-center border-warning/30">
          <div className="text-2xl font-bold text-warning">{stats.medium}</div>
          <div className="text-xs text-muted-foreground">Moyens</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{stats.low}</div>
          <div className="text-xs text-muted-foreground">Faibles</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="outline" size="sm" onClick={fetchErrors} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Sévérité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
              <SelectItem value="high">Élevé</SelectItem>
              <SelectItem value="medium">Moyen</SelectItem>
              <SelectItem value="low">Faible</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={filterFunction} onValueChange={setFilterFunction}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Fonction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fonctions</SelectItem>
            {uniqueFunctions.map(fn => (
              <SelectItem key={fn} value={fn}>{fn}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchErrors} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      {/* Error list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Registre des erreurs silencieuses ({filteredErrors.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Erreurs capturées par le backend qui étaient auparavant avalées par .catch(() =&gt; {'{}'})
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {filteredErrors.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {loading ? 'Chargement...' : 'Aucune erreur silencieuse enregistrée 🎉'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredErrors.map((error) => {
                  const sev = severityConfig[error.severity] || severityConfig.low;
                  const SevIcon = sev.icon;
                  return (
                    <div key={error.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {error.function_name}
                            </Badge>
                            <Badge className={`text-[10px] ${sev.color}`}>
                              <SevIcon className="h-2.5 w-2.5 mr-0.5" />
                              {sev.label}
                            </Badge>
                            {error.impact !== 'none' && (
                              <Badge variant="destructive" className="text-[10px]">
                                {impactLabels[error.impact] || error.impact}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-foreground font-medium">
                            {error.operation}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate">
                            {error.error_message}
                          </p>
                        </div>
                        <time className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {format(parseISO(error.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </time>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
