import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function CtoAgentToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetchState();
  }, []);

  async function fetchState() {
    try {
      const [configRes, logsRes] = await Promise.all([
        supabase.from('system_config' as any).select('value').eq('key', 'cto_agent_enabled').single(),
        supabase.from('cto_agent_logs' as any).select('decision'),
      ]);

      if (configRes.data) {
        setEnabled((configRes.data as any).value?.enabled === true);
      }

      if (logsRes.data) {
        const logs = logsRes.data as any[];
        setStats({
          total: logs.length,
          approved: logs.filter(l => l.decision === 'approved').length,
          rejected: logs.filter(l => l.decision === 'rejected').length,
        });
      }
    } catch (e) {
      console.error('Error fetching CTO agent state:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(checked: boolean) {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('system_config' as any)
        .update({ value: { enabled: checked }, updated_at: new Date().toISOString() } as any)
        .eq('key', 'cto_agent_enabled');

      if (error) throw error;

      setEnabled(checked);
      toast({
        title: checked ? 'Agent CTO activé' : 'Agent CTO désactivé',
        description: checked
          ? "L'agent analysera les prochains audits en arrière-plan."
          : "L'agent ne sera plus déclenché après les audits.",
      });
    } catch (e) {
      console.error('Error toggling CTO agent:', e);
      toast({ title: 'Erreur', description: 'Impossible de modifier le statut.', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Agent CTO</CardTitle>
              <CardDescription className="text-xs">
                Auto-optimisation des prompts d'audit via Claude 3.5 Sonnet
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
              {enabled ? 'Actif' : 'Inactif'}
            </Badge>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span>{stats.total} analyses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>{stats.approved} approuvées</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span>{stats.rejected} rejetées</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
