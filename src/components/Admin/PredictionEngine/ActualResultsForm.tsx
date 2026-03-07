import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onSaved: () => void;
}

interface Prediction {
  id: string;
  predicted_traffic: number;
  baseline_traffic: number;
  predicted_increase_pct: number;
  created_at: string;
}

export function ActualResultsForm({ onSaved }: Props) {
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState('');
  const [realTraffic, setRealTraffic] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('predictions').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setPredictions(data as unknown as Prediction[]);
    });
  }, []);

  const handleSave = async () => {
    if (!selectedPrediction || !realTraffic) return;

    setSaving(true);
    try {
      const pred = predictions.find(p => p.id === selectedPrediction);
      if (!pred) throw new Error('Prediction not found');

      const real = parseInt(realTraffic);
      const accuracyGap = real > 0 ? 1 - Math.abs(real - pred.predicted_traffic) / real : 0;

      const { error } = await supabase.from('actual_results').insert({
        prediction_id: selectedPrediction,
        real_traffic_after_90_days: real,
        accuracy_gap: Math.max(0, Math.min(1, accuracyGap)),
      } as any);

      if (error) throw error;

      toast({ title: 'Résultat enregistré ✅', description: `Précision: ${(accuracyGap * 100).toFixed(1)}%` });
      setSelectedPrediction('');
      setRealTraffic('');
      onSaved();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selected = predictions.find(p => p.id === selectedPrediction);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Enregistrer un résultat réel
        </CardTitle>
        <CardDescription>
          Comparez le trafic réel après 90 jours avec la prédiction pour alimenter le score de fiabilité.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Prédiction</Label>
          <Select value={selectedPrediction} onValueChange={setSelectedPrediction}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une prédiction" />
            </SelectTrigger>
            <SelectContent>
              {predictions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {new Date(p.created_at).toLocaleDateString('fr-FR')} — Prédit: {p.predicted_traffic} clics (+{p.predicted_increase_pct.toFixed(1)}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected && (
          <div className="text-sm bg-muted/50 p-3 rounded-lg space-y-1">
            <div>Trafic de base: <strong>{selected.baseline_traffic}</strong> clics/mois</div>
            <div>Trafic prédit: <strong>{selected.predicted_traffic}</strong> clics/mois</div>
            <div>Augmentation prédite: <strong>+{selected.predicted_increase_pct.toFixed(1)}%</strong></div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Trafic réel après 90 jours (clics/mois)</Label>
          <Input
            type="number"
            value={realTraffic}
            onChange={(e) => setRealTraffic(e.target.value)}
            placeholder="Ex: 1250"
          />
        </div>

        <Button onClick={handleSave} disabled={!selectedPrediction || !realTraffic || saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer le résultat
        </Button>
      </CardContent>
    </Card>
  );
}
