import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Brain, TrendingUp, Target, RefreshCw, FileText, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScoreGauge200 } from '@/components/ExpertAudit/ScoreGauge200';
import { PdfUploader } from './PdfUploader';
import { PredictionsList } from './PredictionsList';
import { ActualResultsForm } from './ActualResultsForm';
import { BacktestingDashboard } from './BacktestingDashboard';

interface SystemMetrics {
  current_reliability_score: number;
  total_audits_processed: number;
  total_predictions_made: number;
}

export function PredictionsDashboard() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    const { data } = await supabase
      .from('system_metrics')
      .select('*')
      .limit(1)
      .single();
    if (data) setMetrics(data as unknown as SystemMetrics);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const reliabilityColor = (metrics?.current_reliability_score ?? 0) >= 70
    ? 'text-green-500' : (metrics?.current_reliability_score ?? 0) >= 40
    ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Fiabilité Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${reliabilityColor}`}>
              {loading ? '...' : `${(metrics?.current_reliability_score ?? 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(metrics?.current_reliability_score ?? 0) >= 70
                ? '✅ Mode visible pour les clients'
                : '🔒 Mode Shadow — prédictions masquées'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Audits Traités
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.total_audits_processed ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">PDFs analysés par IA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Prédictions Générées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.total_predictions_made ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Volume d'apprentissage</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Déposer un PDF
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Prédictions
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <Target className="h-4 w-4" />
            Résultats réels
          </TabsTrigger>
          <TabsTrigger value="backtest" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Backtesting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <PdfUploader onUploadComplete={fetchMetrics} />
        </TabsContent>

        <TabsContent value="predictions">
          <PredictionsList />
        </TabsContent>

        <TabsContent value="results">
          <ActualResultsForm onSaved={fetchMetrics} />
        </TabsContent>

        <TabsContent value="backtest">
          <BacktestingDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
