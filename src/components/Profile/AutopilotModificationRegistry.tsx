import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, ExternalLink, CheckCircle2, Undo2, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ModificationRegistryProps {
  trackedSiteId: string | null;
}

interface ModLog {
  id: string;
  phase: string;
  action_type: string;
  page_url: string | null;
  description: string | null;
  status: string;
  cycle_number: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  applied: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Appliqué' },
  rolled_back: { icon: Undo2, color: 'text-amber-500', label: 'Rollback' },
  failed: { icon: AlertCircle, color: 'text-destructive', label: 'Échec' },
  simulated: { icon: Eye, color: 'text-blue-500', label: 'Simulé' },
};

const PHASE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnostic',
  prescription: 'Prescription',
  implementation: 'Implémentation',
};

export function AutopilotModificationRegistry({ trackedSiteId }: ModificationRegistryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !trackedSiteId) { setLogs([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('autopilot_modification_log')
        .select('id, phase, action_type, page_url, description, status, cycle_number, created_at')
        .eq('tracked_site_id', trackedSiteId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs((data as ModLog[]) ?? []);
      setLoading(false);
    })();
  }, [user, trackedSiteId]);

  if (!trackedSiteId || (logs.length === 0 && !loading)) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Registre des modifications Autopilote
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {loading ? (
          <p className="text-xs text-muted-foreground animate-pulse">Chargement…</p>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-1">
              {logs.map(log => {
                const statusCfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.applied;
                const StatusIcon = statusCfg.icon;
                return (
                  <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <StatusIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${statusCfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{PHASE_LABELS[log.phase] ?? log.phase}</Badge>
                        <span className="text-xs font-medium">{log.action_type}</span>
                        <span className="text-[10px] text-muted-foreground">Cycle #{log.cycle_number}</span>
                      </div>
                      {log.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.description}</p>}
                      {log.page_url && (
                        <a href={log.page_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                          {log.page_url.replace(/^https?:\/\//, '').slice(0, 60)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
