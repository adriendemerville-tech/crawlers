import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ListTodo, Play, Trash2, Search, Bot, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type AgentType = 'seo' | 'cto' | 'ux';

interface AgentDirective {
  id: string;
  directive_text: string;
  status: string;
  created_at: string;
  target_url: string | null;
  agent: AgentType;
  target_detail: string | null;
}

const AGENT_CONFIG: Record<AgentType, { label: string; icon: typeof Search; table: string; targetField: string; color: string }> = {
  seo: { label: 'SEO', icon: Search, table: 'agent_seo_directives', targetField: 'target_slug', color: 'text-green-500' },
  cto: { label: 'CTO', icon: Bot, table: 'agent_cto_directives', targetField: 'target_function', color: 'text-blue-500' },
  ux: { label: 'UX', icon: Palette, table: 'agent_ux_directives', targetField: 'target_component', color: 'text-purple-500' },
};

export function AgentTaskPlanRegistry() {
  const [directives, setDirectives] = useState<AgentDirective[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const results: AgentDirective[] = [];

      for (const [agent, cfg] of Object.entries(AGENT_CONFIG) as [AgentType, typeof AGENT_CONFIG[AgentType]][]) {
        const { data } = await supabase
          .from(cfg.table as any)
          .select(`id, directive_text, status, created_at, target_url, ${cfg.targetField}`)
          .in('status', ['pending', 'in_progress', 'queued'])
          .order('created_at', { ascending: false })
          .limit(30);

        if (data) {
          results.push(...(data as any[]).map((d: any) => ({
            id: d.id,
            directive_text: d.directive_text,
            status: d.status,
            created_at: d.created_at,
            target_url: d.target_url,
            agent,
            target_detail: d[cfg.targetField] || null,
          })));
        }
      }

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDirectives(results);
    } catch (e) {
      console.error('Load directives error:', e);
    } finally {
      setLoading(false);
    }
  };

  const forceDirective = async (d: AgentDirective) => {
    setProcessingId(d.id);
    const cfg = AGENT_CONFIG[d.agent];
    try {
      await supabase
        .from(cfg.table as any)
        .update({ status: 'pending', consumed_at: null } as any)
        .eq('id', d.id);

      // Fire-and-forget: trigger dispatcher immediately
      supabase.functions.invoke('dispatch-agent-directives', { body: {} }).catch(() => {});

      toast({ title: '⚡ Tâche forcée', description: 'La directive a été remise en file et le dispatcher déclenché.' });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const deleteDirective = async (d: AgentDirective) => {
    setProcessingId(d.id);
    const cfg = AGENT_CONFIG[d.agent];
    try {
      await supabase
        .from(cfg.table as any)
        .delete()
        .eq('id', d.id);
      toast({ title: '🗑️ Tâche supprimée' });
      setDirectives(prev => prev.filter(x => x.id !== d.id));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const AgentIcon = ({ agent }: { agent: AgentType }) => {
    const cfg = AGENT_CONFIG[agent];
    const Icon = cfg.icon;
    return <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Plan de tâches agents</CardTitle>
          </div>
          {directives.length > 0 && (
            <Badge variant="secondary">{directives.length} en cours</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : directives.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche en attente.</p>
        ) : (
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {directives.map((d) => (
              <div
                key={`${d.agent}-${d.id}`}
                className="group relative flex items-start gap-2 py-2.5 px-2 rounded-md border border-transparent hover:border-border/60 hover:bg-muted/30 transition-all"
              >
                <AgentIcon agent={d.agent} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{d.directive_text}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {AGENT_CONFIG[d.agent].label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(d.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                    {d.target_detail && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{d.target_detail}</span>
                    )}
                    <Badge variant={d.status === 'in_progress' ? 'default' : 'secondary'} className="text-[10px]">
                      {d.status}
                    </Badge>
                  </div>
                </div>

                {/* Hover action buttons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Forcer la tâche"
                    disabled={processingId === d.id}
                    onClick={() => forceDirective(d)}
                  >
                    {processingId === d.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Supprimer la tâche"
                    disabled={processingId === d.id}
                    onClick={() => deleteDirective(d)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
