import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RoutingRow {
  feature: string;
  label: string;
  enabled: boolean;
  provider: 'groq' | 'lovable';
  model: string;
  original_model: string;
  description: string | null;
  updated_at: string;
}

export function AIRoutingControl() {
  const [rows, setRows] = useState<RoutingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_routing_overrides')
      .select('*')
      .order('feature');
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setRows((data ?? []) as RoutingRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const updateRow = async (feature: string, patch: Partial<RoutingRow>) => {
    setSavingId(feature);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ai_routing_overrides')
      .update({ ...patch, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('feature', feature);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setRows((prev) => prev.map((r) => (r.feature === feature ? { ...r, ...patch } : r)));
      toast({ title: patch.enabled === false ? 'Modèle d\'origine restauré' : 'Mise à jour' });
    }
    setSavingId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-4">
      <header className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6" /> Routing AI — Override Groq
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Bascule certaines tâches de formatage / classification vers Groq (ultra-rapide, faible coût).
          Désactiver le toggle restaure instantanément le modèle d'origine.
          Cache 30 s côté edge — la propagation est quasi-immédiate.
        </p>
      </header>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div
            key={r.feature}
            className="border border-border rounded-lg p-4 flex items-start justify-between gap-4 hover:border-foreground/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{r.label}</h3>
                {r.enabled ? (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                    Groq actif
                  </Badge>
                ) : (
                  <Badge variant="outline">Origine</Badge>
                )}
              </div>
              {r.description && (
                <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Actif → </span>
                  <span className={r.enabled ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}>
                    {r.enabled ? `groq · ${r.model}` : `lovable · ${r.original_model}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Origine : </span>
                  <span>{r.original_model}</span>
                </div>
              </div>
              <code className="block text-[10px] text-muted-foreground mt-2">{r.feature}</code>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Switch
                checked={r.enabled}
                disabled={savingId === r.feature}
                onCheckedChange={(checked) => updateRow(r.feature, { enabled: checked })}
              />
              {r.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateRow(r.feature, { enabled: false })}
                  disabled={savingId === r.feature}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        Pour ajouter une nouvelle fonctionnalité au routeur : insère une ligne dans <code>ai_routing_overrides</code>
        avec un <code>feature</code> unique, puis appelle <code>callRoutedAI('mon_feature', ...)</code> depuis l'edge function.
      </p>
    </div>
  );
}
