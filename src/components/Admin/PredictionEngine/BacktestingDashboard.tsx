import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ActualResult {
  id: string;
  prediction_id: string;
  real_traffic_after_90_days: number;
  accuracy_gap: number | null;
  context_data: Record<string, any> | null;
  recorded_at: string;
}

interface PredictionWithResult {
  id: string;
  predicted_traffic: number;
  baseline_traffic: number;
  predicted_increase_pct: number;
  domain: string | null;
  created_at: string;
  actual: ActualResult | null;
}

interface BacktestMetrics {
  totalPairs: number;
  mape: number;           // Mean Absolute Percentage Error
  medianApe: number;
  accuracy70: number;     // % of predictions within 30% of actual
  accuracy90: number;     // % of predictions within 10% of actual
  directionAccuracy: number; // % where predicted direction (up/down) was correct
  avgBias: number;        // positive = optimistic, negative = pessimistic
  byDeployment: Record<string, { count: number; mape: number }>;
}

function computeBacktestMetrics(pairs: PredictionWithResult[]): BacktestMetrics {
  const withActual = pairs.filter(p => p.actual && p.actual.real_traffic_after_90_days > 0);
  if (withActual.length === 0) {
    return { totalPairs: 0, mape: 0, medianApe: 0, accuracy70: 0, accuracy90: 0, directionAccuracy: 0, avgBias: 0, byDeployment: {} };
  }

  const apes: number[] = [];
  const biases: number[] = [];
  let directionCorrect = 0;
  const deploymentGroups: Record<string, number[]> = {};

  for (const p of withActual) {
    const predicted = p.predicted_traffic;
    const actual = p.actual!.real_traffic_after_90_days;
    const ape = Math.abs(predicted - actual) / actual;
    apes.push(ape);

    // Bias: positive = overpredicted, negative = underpredicted
    biases.push((predicted - actual) / actual);

    // Direction accuracy
    const predictedUp = p.predicted_increase_pct > 0;
    const actualUp = actual > p.baseline_traffic;
    if (predictedUp === actualUp) directionCorrect++;

    // Group by deployment status
    const deployment = (p.actual?.context_data as any)?.deployment_status || 'unknown';
    if (!deploymentGroups[deployment]) deploymentGroups[deployment] = [];
    deploymentGroups[deployment].push(ape);
  }

  apes.sort((a, b) => a - b);
  const mape = (apes.reduce((s, v) => s + v, 0) / apes.length) * 100;
  const medianApe = (apes[Math.floor(apes.length / 2)]) * 100;
  const accuracy70 = (apes.filter(a => a <= 0.3).length / apes.length) * 100;
  const accuracy90 = (apes.filter(a => a <= 0.1).length / apes.length) * 100;
  const directionAccuracy = (directionCorrect / withActual.length) * 100;
  const avgBias = (biases.reduce((s, v) => s + v, 0) / biases.length) * 100;

  const byDeployment: Record<string, { count: number; mape: number }> = {};
  for (const [key, values] of Object.entries(deploymentGroups)) {
    byDeployment[key] = {
      count: values.length,
      mape: (values.reduce((s, v) => s + v, 0) / values.length) * 100,
    };
  }

  return { totalPairs: withActual.length, mape, medianApe, accuracy70, accuracy90, directionAccuracy, avgBias, byDeployment };
}

export function BacktestingDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [pairs, setPairs] = useState<PredictionWithResult[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch predictions with their actual results
      const { data: predictions } = await supabase
        .from('predictions')
        .select('id, predicted_traffic, baseline_traffic, predicted_increase_pct, domain, created_at')
        .order('created_at', { ascending: false });

      const { data: results } = await supabase
        .from('actual_results')
        .select('*');

      if (!predictions) { setLoading(false); return; }

      const resultsMap = new Map<string, ActualResult>();
      for (const r of (results || [])) {
        resultsMap.set(r.prediction_id, r as unknown as ActualResult);
      }

      const combined: PredictionWithResult[] = (predictions as any[]).map(p => ({
        ...p,
        actual: resultsMap.get(p.id) || null,
      }));

      setPairs(combined);
      setMetrics(computeBacktestMetrics(combined));
    } catch (err: any) {
      toast({ title: 'Erreur chargement backtesting', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const mapeColor = (mape: number) => mape <= 15 ? 'text-green-500' : mape <= 30 ? 'text-yellow-500' : 'text-red-500';
  const mapeGrade = (mape: number) => mape <= 10 ? 'A' : mape <= 15 ? 'B' : mape <= 25 ? 'C' : mape <= 40 ? 'D' : 'F';

  if (loading) {
    return <div className="flex justify-center p-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!metrics || metrics.totalPairs === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-yellow-500" />
          <p className="font-medium">Pas encore de données de backtesting</p>
          <p className="text-sm mt-1">Les résultats apparaîtront lorsque des prédictions auront été comparées aux données réelles à J+90.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className={`text-3xl font-bold ${mapeColor(metrics.mape)}`}>
              {metrics.mape.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">MAPE</p>
            <Badge variant={metrics.mape <= 15 ? 'default' : metrics.mape <= 30 ? 'secondary' : 'destructive'} className="mt-1">
              Grade {mapeGrade(metrics.mape)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold">{metrics.accuracy70.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Précision ±30%</p>
            <p className="text-xs text-muted-foreground">{metrics.totalPairs} paires</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold">{metrics.directionAccuracy.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Direction correcte</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {metrics.directionAccuracy >= 70 
                ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                : <AlertTriangle className="h-3 w-3 text-yellow-500" />
              }
              <span className="text-xs">{metrics.directionAccuracy >= 70 ? 'Fiable' : 'À améliorer'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className={`text-3xl font-bold ${metrics.avgBias > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
              {metrics.avgBias > 0 ? '+' : ''}{metrics.avgBias.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Biais moyen</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {metrics.avgBias > 0 
                ? <><TrendingUp className="h-3 w-3 text-orange-500" /><span className="text-xs">Optimiste</span></>
                : <><TrendingDown className="h-3 w-3 text-blue-500" /><span className="text-xs">Pessimiste</span></>
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Breakdown */}
      {Object.keys(metrics.byDeployment).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              MAPE par type de déploiement
            </CardTitle>
            <CardDescription>
              Compare la précision des prédictions selon que le code correctif a été déployé ou non.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.byDeployment)
                .sort((a, b) => a[1].mape - b[1].mape)
                .map(([status, data]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{status}</Badge>
                      <span className="text-sm text-muted-foreground">{data.count} prédictions</span>
                    </div>
                    <div className={`text-sm font-bold ${mapeColor(data.mape)}`}>
                      MAPE {data.mape.toFixed(1)}%
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Pairs Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dernières comparaisons (prédit vs réel)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pairs.filter(p => p.actual).slice(0, 20).map(p => {
              const ape = p.actual!.real_traffic_after_90_days > 0
                ? Math.abs(p.predicted_traffic - p.actual!.real_traffic_after_90_days) / p.actual!.real_traffic_after_90_days * 100
                : 0;
              return (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                  <div>
                    <span className="font-medium">{p.domain || '—'}</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(p.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">Prédit: {p.predicted_traffic}</span>
                    <span>Réel: {p.actual!.real_traffic_after_90_days}</span>
                    <Badge variant={ape <= 15 ? 'default' : ape <= 30 ? 'secondary' : 'destructive'}>
                      {ape.toFixed(0)}% err.
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={loadData} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Rafraîchir
      </Button>
    </div>
  );
}
