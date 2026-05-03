import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Gauge, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Period = 'day' | 'week';

interface Props {
  targetId: string;
  targetLabel: string;
}

export function ParmenionThrottleControl({ targetId, targetLabel }: Props) {
  const { toast } = useToast();
  const [maxContent, setMaxContent] = useState<number>(3);
  const [period, setPeriod] = useState<Period>('day');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('parmenion_targets')
        .select('max_content_per_period, throttle_period')
        .eq('id', targetId)
        .maybeSingle();
      if (data) {
        setMaxContent((data as any).max_content_per_period ?? 3);
        setPeriod(((data as any).throttle_period as Period) ?? 'day');
      }
      setLoading(false);
    })();
  }, [targetId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('parmenion_targets')
      .update({ max_content_per_period: maxContent, throttle_period: period })
      .eq('id', targetId);
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Limite mise à jour', description: `${maxContent} contenu(s) max / ${period === 'day' ? 'jour' : 'semaine'} pour ${targetLabel}.` });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          Limite de production de contenu
        </CardTitle>
        <CardDescription>
          Nombre maximum de nouveaux contenus que Parménion peut créer sur ce CMS, par période.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`max-${targetId}`}>Nombre max</Label>
          <Input
            id={`max-${targetId}`}
            type="number"
            min={0}
            max={500}
            value={maxContent}
            onChange={(e) => setMaxContent(Math.max(0, parseInt(e.target.value || '0', 10)))}
            disabled={loading}
            className="w-28"
          />
        </div>
        <div className="space-y-1">
          <Label>Période</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)} disabled={loading}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Par jour</SelectItem>
              <SelectItem value="week">Par semaine</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={save} disabled={loading || saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <p className="text-xs text-muted-foreground basis-full">
          0 = aucune création (mises à jour uniquement). Au-delà de la limite, Parménion saute le cycle de création.
        </p>
      </CardContent>
    </Card>
  );
}
