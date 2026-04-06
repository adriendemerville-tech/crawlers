import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bot, Search, Plug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function FelixAgentBridgeControls() {
  const [seoEnabled, setSeoEnabled] = useState(true);
  const [ctoEnabled, setCtoEnabled] = useState(true);
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
      }
    } catch (e) {
      console.error('Load bridge config error:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateBridge = async (bridge: 'felix_seo_bridge' | 'felix_cto_bridge', enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current config
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

      const label = bridge === 'felix_seo_bridge' ? 'Agent SEO' : 'Agent CTO';
      toast.success(`Pont Félix → ${label} ${enabled ? 'activé' : 'désactivé'}`);
    } catch (e) {
      console.error('Update bridge error:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const toggleSeo = (val: boolean) => {
    setSeoEnabled(val);
    updateBridge('felix_seo_bridge', val);
  };

  const toggleCto = (val: boolean) => {
    setCtoEnabled(val);
    updateBridge('felix_cto_bridge', val);
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
          <Switch id="seo-bridge" checked={seoEnabled} onCheckedChange={toggleSeo} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="cto-bridge" className="text-sm cursor-pointer">
              Félix → Agent CTO
            </Label>
          </div>
          <Switch id="cto-bridge" checked={ctoEnabled} onCheckedChange={toggleCto} />
        </div>
        <p className="text-xs text-muted-foreground">
          Commandes <code>/seo</code> et <code>/cto</code> dans Félix. Admin créateur uniquement.
        </p>
      </CardContent>
    </Card>
  );
}
