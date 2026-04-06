import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bot, Search, Plug, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type BridgeKey = 'felix_seo_bridge' | 'felix_cto_bridge' | 'felix_supervisor_bridge';

export function FelixAgentBridgeControls() {
  const [seoEnabled, setSeoEnabled] = useState(true);
  const [ctoEnabled, setCtoEnabled] = useState(true);
  const [supervisorEnabled, setSupervisorEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('admin_dashboard_config')
        .select('card_order')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.card_order) {
        const config = data.card_order as any;
        if (config.felix_seo_bridge === false) setSeoEnabled(false);
        if (config.felix_cto_bridge === false) setCtoEnabled(false);
        if (config.felix_supervisor_bridge === false) setSupervisorEnabled(false);
      }
    } catch (e) {
      console.error('Load bridge config error:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateBridge = async (bridge: BridgeKey, enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('admin_dashboard_config')
        .select('card_order')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentConfig = (existing?.card_order as any) || {};
      const newConfig = { ...currentConfig, [bridge]: enabled };

      if (existing) {
        await supabase
          .from('admin_dashboard_config')
          .update({ card_order: newConfig } as any)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('admin_dashboard_config')
          .insert({ user_id: user.id, card_order: newConfig } as any);
      }

      const labels: Record<BridgeKey, string> = {
        felix_seo_bridge: 'Agent SEO',
        felix_cto_bridge: 'Agent CTO',
        felix_supervisor_bridge: 'Supervisor',
      };
      toast.success(`Pont Félix → ${labels[bridge]} ${enabled ? 'activé' : 'désactivé'}`);
    } catch (e) {
      console.error('Update bridge error:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (loading) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">Ponts Félix → Agents</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="seo-bridge" className="text-sm cursor-pointer">
              Félix → Agent SEO
            </Label>
          </div>
          <Switch id="seo-bridge" checked={seoEnabled} onCheckedChange={(val) => { setSeoEnabled(val); updateBridge('felix_seo_bridge', val); }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="cto-bridge" className="text-sm cursor-pointer">
              Félix → Agent CTO
            </Label>
          </div>
          <Switch id="cto-bridge" checked={ctoEnabled} onCheckedChange={(val) => { setCtoEnabled(val); updateBridge('felix_cto_bridge', val); }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="supervisor-bridge" className="text-sm cursor-pointer">
              Félix → Supervisor
            </Label>
          </div>
          <Switch id="supervisor-bridge" checked={supervisorEnabled} onCheckedChange={(val) => { setSupervisorEnabled(val); updateBridge('felix_supervisor_bridge', val); }} />
        </div>
        <p className="text-xs text-muted-foreground">
          Commandes <code>/seo</code>, <code>/cto</code> et <code>/supervisor</code> dans Félix. Admin créateur uniquement.
        </p>
      </CardContent>
    </Card>
  );
}
