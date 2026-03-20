import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Loader2, CheckCircle2, AlertTriangle, Shield, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SupervisorLog {
  id: string;
  audit_id: string | null;
  analysis_summary: string;
  self_critique: string;
  cto_score: number | null;
  correction_count: number;
  functions_audited: string[];
  post_deploy_errors: number;
  status: string;
  resolved_at: string | null;
  metadata: any;
  created_at: string;
}

export function SupervisorErrorsRegistry() {
  const [logs, setLogs] = useState<SupervisorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('supervisor_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setLogs(data as any[]);
      setLoading(false);
    })();
  }, []);

  const markResolved = async (id: string) => {
    const { error } = await supabase
      .from('supervisor_logs' as any)
      .update({ status: 'resolved', resolved_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) { toast.error('Erreur de mise à jour'); return; }
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: 'resolved', resolved_at: new Date().toISOString() } : l));
    toast.success('Marqué comme résolu');
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);
  const openCount = logs.filter(l => l.status === 'open').length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4.5 w-4.5 text-primary" />
          Registre Supervisor
          <Badge variant="secondary" className="text-xs">{openCount} ouvert{openCount > 1 ? 's' : ''}</Badge>
          <div className="flex-1" />
          <div className="flex gap-1">
            {(['all', 'open', 'resolved'] as const).map(s => (
              <Button
                key={s}
                variant={filter === s ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'Tout' : s === 'open' ? 'Ouvert' : 'Résolu'}
              </Button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun log Supervisor.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => {
              const isExpanded = expandedId === log.id;
              const score = log.cto_score != null ? Number(log.cto_score) : null;
              return (
                <div
                  key={log.id}
                  className={cn(
                    "p-3 rounded-lg border text-sm space-y-1.5 cursor-pointer transition-colors hover:bg-muted/30",
                    log.status === 'resolved' ? 'opacity-50 bg-muted/30' : 'bg-card'
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      {log.status === 'open' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-medium truncate text-xs">{log.analysis_summary.substring(0, 80)}{log.analysis_summary.length > 80 ? '…' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {score !== null && (
                        <Badge className={cn(
                          "text-[10px]",
                          score >= 80 ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : score >= 50 ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                            : "bg-destructive/15 text-destructive border-destructive/30"
                        )}>{score}/100</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString('fr-FR')} {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{log.correction_count} corrections</Badge>
                    {log.post_deploy_errors > 0 && (
                      <Badge className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/30">{log.post_deploy_errors} erreurs post-deploy</Badge>
                    )}
                    {log.functions_audited?.map((fn, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">{fn}</Badge>
                    ))}
                  </div>

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t border-border/50 mt-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">{log.analysis_summary}</p>
                      <p className="text-[11px] text-muted-foreground italic">{log.self_critique}</p>
                      {log.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 text-emerald-500"
                          onClick={(e) => { e.stopPropagation(); markResolved(log.id); }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Résolu
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
