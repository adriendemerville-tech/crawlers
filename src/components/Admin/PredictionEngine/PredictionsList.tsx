import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Brain, Loader2, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PdfAudit {
  id: string;
  client_id: string;
  file_path: string;
  status: string;
  extracted_data: any;
  created_at: string;
}

interface Prediction {
  id: string;
  audit_id: string;
  predicted_increase_pct: number;
  predicted_traffic: number;
  baseline_traffic: number;
  prediction_details: any;
  created_at: string;
}

export function PredictionsList() {
  const { toast } = useToast();
  const [audits, setAudits] = useState<PdfAudit[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [auditsRes, predsRes] = await Promise.all([
      supabase.from('pdf_audits').select('*').order('created_at', { ascending: false }),
      supabase.from('predictions').select('*').order('created_at', { ascending: false }),
    ]);
    if (auditsRes.data) setAudits(auditsRes.data as unknown as PdfAudit[]);
    if (predsRes.data) setPredictions(predsRes.data as unknown as Prediction[]);
    setLoading(false);
  };

  const generatePrediction = async (audit: PdfAudit) => {
    setGenerating(audit.id);
    try {
      // Try to fetch GSC data if available
      let gscData = null;
      try {
        const { data } = await supabase.functions.invoke('gsc-auth', {
          body: { action: 'fetch', user_id: audit.client_id },
        });
        if (data && !data.error) gscData = data;
      } catch {
        // GSC not connected, proceed without
      }

      const { data, error } = await supabase.functions.invoke('generate-prediction', {
        body: {
          audit_id: audit.id,
          client_id: audit.client_id,
          gsc_data: gscData || { total_clicks: 0, total_impressions: 0, avg_position: 0 },
        },
      });

      if (error) throw error;

      toast({ title: 'Prédiction générée ✅' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const hasPrediction = (auditId: string) => predictions.some(p => p.audit_id === auditId);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Audits & Prédictions</h3>

      {audits.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun audit PDF déposé</CardContent></Card>
      ) : (
        audits.map((audit) => {
          const pred = predictions.find(p => p.audit_id === audit.id);
          return (
            <Card key={audit.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{audit.file_path.split('/').pop()}</span>
                      <Badge variant={audit.status === 'processed' ? 'default' : audit.status === 'error' ? 'destructive' : 'secondary'}>
                        {audit.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(audit.created_at).toLocaleDateString('fr-FR')}
                      {audit.extracted_data?.errors != null && ` • ${audit.extracted_data.errors} erreurs • Score: ${audit.extracted_data.technical_score}/100`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {pred ? (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-primary">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-bold">+{pred.predicted_increase_pct.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {pred.baseline_traffic} → {pred.predicted_traffic} clics/mois
                        </p>
                      </div>
                    ) : audit.status === 'processed' ? (
                      <Button
                        size="sm"
                        onClick={() => generatePrediction(audit)}
                        disabled={generating === audit.id}
                      >
                        {generating === audit.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Prédire
                      </Button>
                    ) : null}
                  </div>
                </div>

                {pred?.prediction_details?.reasoning && (
                  <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                    {pred.prediction_details.reasoning}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
